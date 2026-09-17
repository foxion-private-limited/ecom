import { NextResponse } from "next/server";
import { processOrderReturn } from "@/lib/services/orderService";
import { getCurrentUser } from "@/lib/auth/session";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id } = await params;
    const body = await req.json();

    const returnedProductIds = body.returnedProductIds || [];
    const remarks = body.remarks || "Customer return";

    const updatedOrder = await processOrderReturn(
      id,
      returnedProductIds,
      remarks,
      user?.email || "System"
    );

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
