import { NextResponse } from "next/server";
import {
  getProductCategories,
  createProductCategory,
} from "@/lib/services/categoryService";
import { productCategorySchema } from "@/lib/validations";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || undefined;
    const categories = await getProductCategories({ search });
    return NextResponse.json(categories);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch product categories";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = productCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const category = await createProductCategory(parsed.data);
    return NextResponse.json({ success: true, category }, { status: 201 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to create product category";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
