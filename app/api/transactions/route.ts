import { NextResponse } from "next/server";
import { getTransactions, createTransaction } from "@/lib/services/transactionService";
import { transactionSchema } from "@/lib/validations";
import { getCurrentUser } from "@/lib/auth/session";
import mongoose from "mongoose";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const accountType = (searchParams.get("accountType") as any) || "ALL";
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const category = searchParams.get("category") || undefined;
    const paymentMode = searchParams.get("paymentMode") || undefined;
    const bankOrCash = (searchParams.get("bankOrCash") as any) || undefined;
    const partyName = searchParams.get("partyName") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const result = await getTransactions({
      accountType,
      startDate,
      endDate,
      category,
      paymentMode,
      bankOrCash,
      partyName,
      search,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("GET transactions error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();

    const parsed = transactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { billId, ...rest } = parsed.data;

    const tx = await createTransaction(
      {
        ...rest,
        billId: billId ? new mongoose.Types.ObjectId(billId) : undefined,
      },
      user?.email || "System"
    );

    return NextResponse.json({ success: true, transaction: tx });
  } catch (error: any) {
    console.error("POST transaction error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create transaction" },
      { status: 500 }
    );
  }
}
