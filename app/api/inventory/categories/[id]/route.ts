import { NextResponse } from "next/server";
import {
  getProductCategoryById,
  updateProductCategory,
  deleteProductCategory,
} from "@/lib/services/categoryService";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const category = await getProductCategoryById(id);
    if (!category) {
      return NextResponse.json(
        { error: "Product category not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(category);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch product category";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const updated = await updateProductCategory(id, body);
    return NextResponse.json({ success: true, category: updated });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to update product category";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return PUT(req, { params });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await deleteProductCategory(id);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to delete product category";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
