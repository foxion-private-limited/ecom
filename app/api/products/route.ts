import { NextResponse } from "next/server";
import { getProducts, createProduct } from "@/lib/services/inventoryService";
import { productSchema } from "@/lib/validations";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const category = searchParams.get("category") || undefined;
    const stockStatus =
      (searchParams.get("stockStatus") as
        | "ALL"
        | "GOOD"
        | "LOW"
        | "OUT"
        | null) || "ALL";
    const search = searchParams.get("search") || undefined;
    const sortBy =
      (searchParams.get("sortBy") as
        | "name"
        | "price"
        | "stock"
        | "createdAt"
        | null) || "createdAt";
    const sortOrder =
      (searchParams.get("sortOrder") as "asc" | "desc" | null) || "desc";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const result = await getProducts({
      category,
      stockStatus,
      search,
      sortBy,
      sortOrder,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch products";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();

    const parsed = productSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const product = await createProduct(parsed.data, user?.email || "System");

    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to create product";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
