import { NextResponse } from "next/server";
import { getProducts, createProduct } from "@/lib/services/inventoryService";
import { productSchema } from "@/lib/validations";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const category = searchParams.get("category") || undefined;
    const stockStatus = (searchParams.get("stockStatus") as any) || "ALL";
    const search = searchParams.get("search") || undefined;
    const sortBy = (searchParams.get("sortBy") as any) || "createdAt";
    const sortOrder = (searchParams.get("sortOrder") as any) || "desc";
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
  } catch (error: any) {
    console.error("GET products error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch products" },
      { status: 500 }
    );
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

    const product = await createProduct(parsed.data as any, user?.email || "System");

    return NextResponse.json({ success: true, product });
  } catch (error: any) {
    console.error("POST product error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create product" },
      { status: 500 }
    );
  }
}
