import { NextResponse } from "next/server";
import {
  getImageFromGridFS,
  deleteImageFromGridFS,
  isImageReferencedByOtherProducts,
} from "@/lib/services/imageStorageService";
import { Readable } from "stream";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const imageData = await getImageFromGridFS(id);

    if (!imageData) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const webStream = Readable.toWeb(
      imageData.stream as Readable
    ) as ReadableStream<Uint8Array>;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": imageData.contentType,
        "Content-Length": imageData.length.toString(),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load image";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Safety check: is it referenced by any product?
    const inUse = await isImageReferencedByOtherProducts(id);
    if (inUse) {
      return NextResponse.json(
        { error: "Image is currently referenced by another product and cannot be deleted" },
        { status: 400 }
      );
    }

    const deleted = await deleteImageFromGridFS(id);
    if (!deleted) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Image deleted" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete image";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
