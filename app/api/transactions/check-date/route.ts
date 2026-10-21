import { NextResponse } from "next/server";
import { checkTransactionDateConflict } from "@/lib/services/transactionService";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const accountType = searchParams.get("accountType") || "MAIN";
    const origin = searchParams.get("origin") || searchParams.get("transactionOrigin") || undefined;
    const excludeId = searchParams.get("excludeId") || undefined;

    if (!dateParam) {
      return NextResponse.json(
        { error: "Date parameter is required" },
        { status: 400 }
      );
    }

    const conflict = await checkTransactionDateConflict({
      date: dateParam,
      accountType,
      origin,
      excludeId,
    });

    return NextResponse.json({
      exists: conflict.exists,
      conflictingDate: conflict.conflictingDate,
      message: conflict.exists
        ? "A transaction already exists for this date. Please select another date."
        : undefined,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to check transaction date";
    console.error("GET check-date error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { date, accountType = "MAIN", origin, transactionOrigin, excludeId } = body;

    if (!date) {
      return NextResponse.json(
        { error: "Date parameter is required" },
        { status: 400 }
      );
    }

    const conflict = await checkTransactionDateConflict({
      date,
      accountType,
      origin: origin || transactionOrigin,
      excludeId,
    });

    return NextResponse.json({
      exists: conflict.exists,
      conflictingDate: conflict.conflictingDate,
      message: conflict.exists
        ? "A transaction already exists for this date. Please select another date."
        : undefined,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to check transaction date";
    console.error("POST check-date error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
