import mongoose from "mongoose";
import { Readable } from "stream";
import { connectDB } from "@/lib/db/connection";
import { Transaction } from "@/lib/models/Transaction";
import { Bill } from "@/lib/models/Bill";

export const MAX_BILL_SIZE_BYTES = 5 * 1024 * 1024;

export type SupportedBillMime =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "application/pdf";

export interface BillValidationResult {
  isValid: boolean;
  contentType?: SupportedBillMime;
  error?: string;
}

export interface StoredBillResult {
  fileId: mongoose.Types.ObjectId;
  url: string;
  originalName: string;
  mimeType: SupportedBillMime;
  size: number;
}

/**
 * Validates actual binary content of an image or PDF file using magic bytes.
 * Never trusts client MIME types or file extensions alone.
 */
export function validateBillBuffer(buffer: Buffer): BillValidationResult {
  if (!buffer || buffer.length === 0) {
    return { isValid: false, error: "Empty file received" };
  }

  if (buffer.length > MAX_BILL_SIZE_BYTES) {
    return {
      isValid: false,
      error: `File size exceeds 5 MB limit (${(buffer.length / (1024 * 1024)).toFixed(2)} MB). Please choose a smaller file.`,
    };
  }

  // 1. JPEG: starts with FF D8 FF
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { isValid: true, contentType: "image/jpeg" };
  }

  // 2. PNG: starts with 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { isValid: true, contentType: "image/png" };
  }

  // 3. WebP: RIFF (0..3) ... WEBP (8..11)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return { isValid: true, contentType: "image/webp" };
  }

  // 4. PDF: starts with %PDF- (25 50 44 46)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x25 && // %
    buffer[1] === 0x50 && // P
    buffer[2] === 0x44 && // D
    buffer[3] === 0x46 // F
  ) {
    return { isValid: true, contentType: "application/pdf" };
  }

  return {
    isValid: false,
    error: "Invalid file format. Supported formats are JPG, JPEG, PNG, WEBP, and PDF.",
  };
}

/**
 * Gets the GridFS bucket for transaction bills
 */
function getBillsBucket(): mongoose.mongo.GridFSBucket {
  if (!mongoose.connection.db) {
    throw new Error("MongoDB database connection is not active");
  }
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: "transaction_bills",
  });
}

/**
 * Uploads a bill/receipt binary buffer to MongoDB GridFS.
 */
export async function uploadBillToGridFS(params: {
  buffer: Buffer;
  filename?: string;
  contentType: SupportedBillMime;
}): Promise<StoredBillResult> {
  await connectDB();
  const bucket = getBillsBucket();

  const rawFilename = params.filename || "bill-receipt";
  const sanitizedName = rawFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const safeStorageFilename = `bill_${Date.now()}_${Math.random().toString(36).slice(2, 9)}_${sanitizedName}`;

  return new Promise((resolve, reject) => {
    const readable = new Readable();
    readable.push(params.buffer);
    readable.push(null);

    const uploadStream = bucket.openUploadStream(safeStorageFilename, {
      metadata: {
        originalName: rawFilename,
        contentType: params.contentType,
        size: params.buffer.length,
        uploadedAt: new Date(),
      },
    });

    readable
      .pipe(uploadStream)
      .on("error", (err) => reject(err))
      .on("finish", () => {
        const fileId = uploadStream.id as mongoose.Types.ObjectId;
        resolve({
          fileId,
          url: `/api/transactions/bills/${fileId.toString()}`,
          originalName: rawFilename,
          mimeType: params.contentType,
          size: params.buffer.length,
        });
      });
  });
}

/**
 * Retrieves a bill stream and metadata from MongoDB GridFS by fileId.
 */
export async function getBillFromGridFS(fileId: string | mongoose.Types.ObjectId): Promise<{
  stream: NodeJS.ReadableStream;
  contentType: string;
  length: number;
  filename: string;
  originalName: string;
} | null> {
  await connectDB();
  const idStr = String(fileId);
  if (!mongoose.Types.ObjectId.isValid(idStr)) {
    return null;
  }

  const objId = new mongoose.Types.ObjectId(idStr);
  const bucket = getBillsBucket();

  const files = await bucket.find({ _id: objId }).toArray();
  if (!files || files.length === 0) {
    return null;
  }

  const file = files[0];
  const downloadStream = bucket.openDownloadStream(objId);

  const originalName =
    (file.metadata?.originalName as string) ||
    file.filename ||
    "bill-attachment";

  const contentType =
    (file.metadata?.contentType as string) ||
    (file as unknown as { contentType?: string }).contentType ||
    (originalName.endsWith(".pdf") ? "application/pdf" : "image/jpeg");

  return {
    stream: downloadStream,
    contentType,
    length: file.length,
    filename: file.filename,
    originalName,
  };
}

/**
 * Deletes a file from GridFS by fileId.
 */
export async function deleteBillFromGridFS(
  fileId: string | mongoose.Types.ObjectId
): Promise<boolean> {
  await connectDB();
  const idStr = String(fileId);
  if (!mongoose.Types.ObjectId.isValid(idStr)) {
    return false;
  }

  const objId = new mongoose.Types.ObjectId(idStr);
  const bucket = getBillsBucket();

  try {
    const files = await bucket.find({ _id: objId }).toArray();
    if (!files || files.length === 0) {
      return false;
    }
    await bucket.delete(objId);
    return true;
  } catch (err) {
    console.warn(`[GridFS] Failed to delete bill ${idStr}:`, err);
    return false;
  }
}

/**
 * Checks if a bill fileId is still referenced by any active transaction.
 */
export async function isBillReferencedByOtherTransactions(
  fileId: string | mongoose.Types.ObjectId,
  excludeTransactionId?: string | mongoose.Types.ObjectId
): Promise<boolean> {
  await connectDB();
  const idStr = String(fileId);
  if (!mongoose.Types.ObjectId.isValid(idStr)) {
    return false;
  }

  const objId = new mongoose.Types.ObjectId(idStr);
  const query: Record<string, unknown> = {
    $or: [
      { "attachment.fileId": objId },
      { "attachment.url": `/api/transactions/bills/${idStr}` },
      { billId: objId },
    ],
  };

  if (excludeTransactionId) {
    const excIdStr = String(excludeTransactionId);
    if (mongoose.Types.ObjectId.isValid(excIdStr)) {
      query._id = { $ne: new mongoose.Types.ObjectId(excIdStr) };
    }
  }

  const count = await Transaction.countDocuments(query);
  return count > 0;
}

/**
 * Cleans up a GridFS bill only if it is no longer referenced by any other transaction.
 * Also cleans up any associated Bill record safely.
 */
export async function cleanupBillIfUnreferenced(
  fileId: string | mongoose.Types.ObjectId,
  excludeTransactionId?: string | mongoose.Types.ObjectId
): Promise<boolean> {
  try {
    const isReferenced = await isBillReferencedByOtherTransactions(
      fileId,
      excludeTransactionId
    );
    if (!isReferenced) {
      const deleted = await deleteBillFromGridFS(fileId);
      // Clean up Bill document if present
      const idStr = String(fileId);
      if (mongoose.Types.ObjectId.isValid(idStr)) {
        await Bill.deleteMany({
          $or: [
            { _id: new mongoose.Types.ObjectId(idStr) },
            { url: `/api/transactions/bills/${idStr}` },
          ],
        }).catch(() => { });
      }
      return deleted;
    }
    return false;
  } catch (err) {
    console.warn(`[GridFS] Safe cleanup ignored error:`, err);
    return false;
  }
}
