import { NextResponse } from "next/server";
import {
  getProductById,
  updateProduct,
  archiveProduct,
  deleteProduct,
  getProductDetailMetrics,
} from "@/lib/services/inventoryService";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const product = await getProductById(id);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const metrics = await getProductDetailMetrics(id);

    return NextResponse.json({
      product,
      metrics,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch product";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const updated = await updateProduct(id, body);
    if (!updated) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, product: updated });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to update product";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const permanent = searchParams.get("permanent") === "true";

    if (permanent) {
      const deleted = await deleteProduct(id);
      if (!deleted) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: "Product deleted" });
    }

    const archived = await archiveProduct(id);
    if (!archived) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: "Product archived" });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to delete product";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
