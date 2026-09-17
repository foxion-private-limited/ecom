import { NextResponse } from "next/server";
import { getOrders, createOrder } from "@/lib/services/orderService";
import { orderSchema } from "@/lib/validations";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const platform = searchParams.get("platform") || undefined;
    const orderStatus = searchParams.get("orderStatus") || undefined;
    const paymentStatus = searchParams.get("paymentStatus") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const result = await getOrders({
      platform,
      orderStatus,
      paymentStatus,
      startDate,
      endDate,
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

    const parsed = orderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const order = await createOrder(parsed.data as any, user?.email || "System");

    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    console.error("Create order error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
