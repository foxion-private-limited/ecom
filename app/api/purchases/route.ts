import { NextResponse } from "next/server";
import { getPurchases, createPurchase } from "@/lib/services/purchaseService";
import { purchaseSchema } from "@/lib/validations";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const supplierName = searchParams.get("supplierName") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const result = await getPurchases({
      startDate,
      endDate,
      supplierName,
      search,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();

    const parsed = purchaseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const purchase = await createPurchase(parsed.data as any, user?.email || "System");

    return NextResponse.json({ success: true, purchase });
  } catch (error: any) {
    console.error("Create purchase error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
