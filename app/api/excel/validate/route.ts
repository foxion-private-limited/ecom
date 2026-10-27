import { NextResponse } from "next/server";
import { parseExcelBuffer } from "@/lib/excel/excelParser";
import { validateExcelRows } from "@/lib/excel/excelValidator";
import { parseIndianDate } from "@/lib/utils";
import { getPreviousTransactionBalance } from "@/lib/services/transactionService";
import { connectDB } from "@/lib/db/connection";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No Excel file provided" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse Excel sheet
    const { headers, rows } = parseExcelBuffer(buffer);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "The provided Excel file is empty or contains no valid data rows" },
        { status: 400 }
      );
    }

    // Extract origin if provided (default COMPANY)
    const originParam = formData.get("origin");
    const origin: "COMPANY" | "PRE_COMPANY" = originParam === "PRE_COMPANY" ? "PRE_COMPANY" : "COMPANY";
    const accountType = (formData.get("accountType") as string) || "MAIN";

    // Validate rows
    const validationSummary = validateExcelRows(rows, file.name, { origin });

    await connectDB();

    // Determine earliest transaction date across all rows
    let earliestDate: Date | null = null;
    for (const r of validationSummary.rows) {
      if (r.data.date) {
        const d = parseIndianDate(r.data.date as string | Date);
        if (d && !isNaN(d.getTime())) {
          if (!earliestDate || d.getTime() < earliestDate.getTime()) {
            earliestDate = d;
          }
        }
      }
    }

    let openingBalance = 0;
    if (earliestDate) {
      openingBalance = await getPreviousTransactionBalance(earliestDate, accountType, origin);
    }

    return NextResponse.json({
      success: true,
      headers,
      summary: validationSummary,
      openingBalance,
      earliestDate: earliestDate ? earliestDate.toISOString() : null,
      occupiedDbDates: [],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to parse and validate Excel file";
    console.error("Excel validation error:", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
