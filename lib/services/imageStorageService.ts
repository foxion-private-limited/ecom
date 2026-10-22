import mongoose from "mongoose";
import { Readable } from "stream";
import { connectDB } from "@/lib/db/connection";
import { Product } from "@/lib/models/Product";

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export type SupportedImageMime = "image/jpeg" | "image/png" | "image/webp";

export interface ImageValidationResult {
  isValid: boolean;
  contentType?: SupportedImageMime;
  error?: string;
}

/**
 * Validates actual binary content of an image file using magic bytes.
 * Never trusts client MIME types or file extensions alone.
 */
export function validateImageBuffer(buffer: Buffer): ImageValidationResult {
  if (!buffer || buffer.length === 0) {
    return { isValid: false, error: "Empty file received" };
  }

  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    return {
      isValid: false,
      error: `File size exceeds 5 MB limit (${(buffer.length / (1024 * 1024)).toFixed(2)} MB). Please choose a smaller image.`,
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

  return {
    isValid: false,
    error: "Invalid image format. Supported formats are JPEG, PNG, and WebP.",
  };
}

/**
 * Gets the GridFS bucket for product images
 */
function getImagesBucket(): mongoose.mongo.GridFSBucket {
  if (!mongoose.connection.db) {
    throw new Error("MongoDB database connection is not active");
  }
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: "product_images",
  });
}

/**
 * Uploads an image binary buffer to MongoDB GridFS with metadata.
 * Returns the generated GridFS fileId and metadata.
 */
export async function uploadImageToGridFS(params: {
  buffer: Buffer;
  filename?: string;
  contentType: SupportedImageMime;
}): Promise<{ fileId: string; contentType: string; size: number }> {
  await connectDB();
  const bucket = getImagesBucket();

  const safeFilename = `prod_img_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  return new Promise((resolve, reject) => {
    const readable = new Readable();
    readable.push(params.buffer);
    readable.push(null);

    const uploadStream = bucket.openUploadStream(safeFilename, {
      metadata: {
        originalName: params.filename || "product-image",
        contentType: params.contentType,
        size: params.buffer.length,
        uploadedAt: new Date(),
      },
    });

    readable
      .pipe(uploadStream)
      .on("error", (err) => reject(err))
      .on("finish", () => {
        resolve({
          fileId: uploadStream.id.toString(),
          contentType: params.contentType,
          size: params.buffer.length,
        });
      });
  });
}

/**
 * Retrieves an image stream and metadata from MongoDB GridFS by fileId.
 */
export async function getImageFromGridFS(fileId: string): Promise<{
  stream: NodeJS.ReadableStream;
  contentType: string;
  length: number;
  filename: string;
} | null> {
  await connectDB();
  if (!fileId || !mongoose.Types.ObjectId.isValid(fileId)) {
    return null;
  }

  const objId = new mongoose.Types.ObjectId(fileId);
  const bucket = getImagesBucket();

  const files = await bucket.find({ _id: objId }).toArray();
  if (!files || files.length === 0) {
    return null;
  }

  const file = files[0];
  const downloadStream = bucket.openDownloadStream(objId);

  return {
    stream: downloadStream,
    contentType:
      (file.metadata?.contentType as string) ||
      (file as unknown as { contentType?: string }).contentType ||
      "image/jpeg",
    length: file.length,
    filename: file.filename,
  };
}

/**
 * Deletes a file from GridFS by fileId.
 */
export async function deleteImageFromGridFS(fileId: string): Promise<boolean> {
  await connectDB();
  if (!fileId || !mongoose.Types.ObjectId.isValid(fileId)) {
    return false;
  }

  const objId = new mongoose.Types.ObjectId(fileId);
  const bucket = getImagesBucket();

  try {
    const files = await bucket.find({ _id: objId }).toArray();
    if (!files || files.length === 0) {
      return false;
    }
    await bucket.delete(objId);
    return true;
  } catch (err) {
    console.warn(`[GridFS] Failed to delete image ${fileId}:`, err);
    return false;
  }
}

/**
 * Checks if a GridFS fileId is still referenced by another product.
 */
export async function isImageReferencedByOtherProducts(
  fileId: string,
  excludeProductId?: string
): Promise<boolean> {
  await connectDB();
  if (!fileId || !mongoose.Types.ObjectId.isValid(fileId)) {
    return false;
  }

  const query: Record<string, unknown> = {
    $or: [
      { imageId: new mongoose.Types.ObjectId(fileId) },
      { imageUrl: `/api/products/images/${fileId}` },
    ],
  };

  if (excludeProductId && mongoose.Types.ObjectId.isValid(excludeProductId)) {
    query._id = { $ne: new mongoose.Types.ObjectId(excludeProductId) };
  }

  const count = await Product.countDocuments(query);
  return count > 0;
}

/**
 * Cleans up a GridFS image only if it is no longer referenced by any other product.
 */
export async function cleanupImageIfUnreferenced(
  fileId: string,
  excludeProductId?: string
): Promise<boolean> {
  const isReferenced = await isImageReferencedByOtherProducts(
    fileId,
    excludeProductId
  );
  if (!isReferenced) {
    return deleteImageFromGridFS(fileId);
  }
  return false;
}
