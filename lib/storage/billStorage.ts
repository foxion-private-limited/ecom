import fs from "fs/promises";
import path from "path";
import { connectDB } from "@/lib/db/connection";
import { Bill, IBill } from "@/lib/models/Bill";
import mongoose from "mongoose";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "public/uploads";

export interface SaveBillOptions {
  fileBuffer: Buffer;
  originalName: string;
  mimeType: string;
  category?: string;
  relatedType?: "TRANSACTION" | "PURCHASE" | "EXPENSE";
  relatedId?: string;
  uploadedBy?: string;
}

export async function saveBillDocument(options: SaveBillOptions): Promise<IBill> {
  await connectDB();

  const {
    fileBuffer,
    originalName,
    mimeType,
    category,
    relatedType,
    relatedId,
    uploadedBy = "System",
  } = options;

  // Validate mime type
  const allowedMimes = [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ];
  if (!allowedMimes.includes(mimeType.toLowerCase())) {
    throw new Error(
      `Unsupported file format: ${mimeType}. Allowed formats: PDF, JPG, PNG, WEBP`
    );
  }

  // Max 15MB
  if (fileBuffer.length > 15 * 1024 * 1024) {
    throw new Error("File size exceeds 15MB limit");
  }

  const billsDir = path.join(process.cwd(), UPLOAD_DIR, "bills");
  await fs.mkdir(billsDir, { recursive: true });

  const ext = path.extname(originalName) || ".pdf";
  const uniqueName = `bill_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
  const filePath = path.join(billsDir, uniqueName);

  await fs.writeFile(filePath, fileBuffer);

  const publicUrl = `/uploads/bills/${uniqueName}`;

  const bill = await Bill.create({
    filename: uniqueName,
    originalName,
    mimeType,
    size: fileBuffer.length,
    url: publicUrl,
    uploadedBy,
    category,
    relatedType,
    relatedId: relatedId ? new mongoose.Types.ObjectId(relatedId) : undefined,
  });

  return bill;
}

export async function getBillById(id: string) {
  await connectDB();
  return Bill.findById(id).lean();
}

export async function getBills(limit: number = 50) {
  await connectDB();
  return Bill.find().sort({ createdAt: -1 }).limit(limit).lean();
}
