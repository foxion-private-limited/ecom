import mongoose from "mongoose";
import crypto from "crypto";
import { Readable } from "stream";
import { connectDB } from "@/lib/db/connection";

const PDF_BUCKET_NAME = "taxinvoicepdfs";
const PNG_BUCKET_NAME = "taxinvoicepngs";

export interface StoredFileMetadata {
  invoiceId: string;
  serialNumber?: string;
  mode: "TEST" | "PRODUCTION";
  financialYear?: string;
  mimeType: string;
  originalFilename: string;
  checksum: string;
  templateVersion: string;
  page?: number;
  createdAt: Date;
}

/**
 * Compute SHA-256 checksum of a buffer.
 */
export function computeSha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Get or initialize a GridFSBucket.
 */
async function getBucket(bucketName: string): Promise<mongoose.mongo.GridFSBucket> {
  const m = await connectDB();
  const db = m.connection.db;
  if (!db) {
    throw new Error("MongoDB database connection is not available for GridFS");
  }
  return new mongoose.mongo.GridFSBucket(db, { bucketName });
}

/**
 * Save an invoice PDF buffer permanently in GridFS.
 * Returns the GridFS ObjectId and the SHA-256 checksum.
 */
export async function saveInvoicePdf(
  pdfBuffer: Buffer,
  metadata: Omit<StoredFileMetadata, "checksum" | "mimeType" | "createdAt"> & {
    checksum?: string;
  }
): Promise<{ fileId: mongoose.Types.ObjectId; checksum: string }> {
  const bucket = await getBucket(PDF_BUCKET_NAME);
  const checksum = metadata.checksum || computeSha256(pdfBuffer);

  const fileMetadata: StoredFileMetadata = {
    ...metadata,
    mimeType: "application/pdf",
    checksum,
    createdAt: new Date(),
  };

  return new Promise<{ fileId: mongoose.Types.ObjectId; checksum: string }>(
    (resolve, reject) => {
      const uploadStream = bucket.openUploadStream(metadata.originalFilename, {
        metadata: fileMetadata,
      });

      const readable = new Readable();
      readable.push(pdfBuffer);
      readable.push(null);

      readable
        .pipe(uploadStream)
        .on("error", (err) => reject(err))
        .on("finish", () => {
          resolve({
            fileId: uploadStream.id as mongoose.Types.ObjectId,
            checksum,
          });
        });
    }
  );
}

/**
 * Save an invoice PNG page buffer in GridFS.
 */
export async function saveInvoicePng(
  pngBuffer: Buffer,
  metadata: Omit<StoredFileMetadata, "checksum" | "mimeType" | "createdAt"> & {
    page: number;
    checksum?: string;
  }
): Promise<{ fileId: mongoose.Types.ObjectId; checksum: string }> {
  const bucket = await getBucket(PNG_BUCKET_NAME);
  const checksum = metadata.checksum || computeSha256(pngBuffer);

  const fileMetadata: StoredFileMetadata = {
    ...metadata,
    mimeType: "image/png",
    checksum,
    createdAt: new Date(),
  };

  return new Promise<{ fileId: mongoose.Types.ObjectId; checksum: string }>(
    (resolve, reject) => {
      const uploadStream = bucket.openUploadStream(metadata.originalFilename, {
        metadata: fileMetadata,
      });

      const readable = new Readable();
      readable.push(pngBuffer);
      readable.push(null);

      readable
        .pipe(uploadStream)
        .on("error", (err) => reject(err))
        .on("finish", () => {
          resolve({
            fileId: uploadStream.id as mongoose.Types.ObjectId,
            checksum,
          });
        });
    }
  );
}

/**
 * Read a PDF file from GridFS as a Buffer.
 */
export async function getInvoicePdfBuffer(
  fileId: mongoose.Types.ObjectId | string
): Promise<{ buffer: Buffer; metadata: StoredFileMetadata | null; filename: string }> {
  const bucket = await getBucket(PDF_BUCKET_NAME);
  const id = typeof fileId === "string" ? new mongoose.Types.ObjectId(fileId) : fileId;

  // Retrieve file metadata from files collection
  const files = await bucket.find({ _id: id }).toArray();
  if (!files || files.length === 0) {
    throw new Error(`Invoice PDF with ID ${id.toString()} not found in GridFS`);
  }

  const fileDoc = files[0];
  const filename = fileDoc.filename;
  const metadata = (fileDoc.metadata as StoredFileMetadata | undefined) ?? null;

  return new Promise((resolve, reject) => {
    const downloadStream = bucket.openDownloadStream(id);
    const chunks: Buffer[] = [];

    downloadStream.on("data", (chunk: Buffer) => chunks.push(chunk));
    downloadStream.on("error", (err) => reject(err));
    downloadStream.on("end", () => {
      resolve({
        buffer: Buffer.concat(chunks),
        metadata,
        filename,
      });
    });
  });
}

/**
 * Read a PNG file from GridFS as a Buffer.
 */
export async function getInvoicePngBuffer(
  fileId: mongoose.Types.ObjectId | string
): Promise<{ buffer: Buffer; metadata: StoredFileMetadata | null; filename: string }> {
  const bucket = await getBucket(PNG_BUCKET_NAME);
  const id = typeof fileId === "string" ? new mongoose.Types.ObjectId(fileId) : fileId;

  const files = await bucket.find({ _id: id }).toArray();
  if (!files || files.length === 0) {
    throw new Error(`Invoice PNG with ID ${id.toString()} not found in GridFS`);
  }

  const fileDoc = files[0];
  const filename = fileDoc.filename;
  const metadata = (fileDoc.metadata as StoredFileMetadata | undefined) ?? null;

  return new Promise((resolve, reject) => {
    const downloadStream = bucket.openDownloadStream(id);
    const chunks: Buffer[] = [];

    downloadStream.on("data", (chunk: Buffer) => chunks.push(chunk));
    downloadStream.on("error", (err) => reject(err));
    downloadStream.on("end", () => {
      resolve({
        buffer: Buffer.concat(chunks),
        metadata,
        filename,
      });
    });
  });
}

/**
 * Delete a file from GridFS (used for cleanup or rollback on issuance failure).
 */
export async function deleteInvoiceFile(
  fileId: mongoose.Types.ObjectId | string,
  bucketType: "pdf" | "png" = "pdf"
): Promise<void> {
  try {
    const bucket = await getBucket(bucketType === "pdf" ? PDF_BUCKET_NAME : PNG_BUCKET_NAME);
    const id = typeof fileId === "string" ? new mongoose.Types.ObjectId(fileId) : fileId;
    await bucket.delete(id);
  } catch (err) {
    console.warn(`[GridFS] Failed to delete file ${fileId}:`, err);
  }
}
