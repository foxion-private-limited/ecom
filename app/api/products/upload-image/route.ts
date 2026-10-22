import { NextResponse } from "next/server";
import {
  validateImageBuffer,
  uploadImageToGridFS,
} from "@/lib/services/imageStorageService";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string" || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "No image file provided. Please select an image to upload." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate actual binary contents and size limits
    const validation = validateImageBuffer(buffer);
    if (!validation.isValid || !validation.contentType) {
      return NextResponse.json(
        { error: validation.error || "Invalid image file" },
        { status: 400 }
      );
    }

    const uploadResult = await uploadImageToGridFS({
      buffer,
      filename: file instanceof File ? file.name : "product-image",
      contentType: validation.contentType,
    });

    return NextResponse.json({
      success: true,
      imageId: uploadResult.fileId,
      imageUrl: `/api/products/images/${uploadResult.fileId}`,
      contentType: uploadResult.contentType,
      size: uploadResult.size,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to upload product image";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
