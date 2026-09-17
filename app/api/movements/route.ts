import { NextResponse } from "next/server";
import { getStockMovements } from "@/lib/services/inventoryService";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId") || undefined;
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const movements = await getStockMovements(productId, limit);
    return NextResponse.json(movements);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
