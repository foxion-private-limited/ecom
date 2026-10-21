import { NextResponse } from "next/server";
import { parseExcelBuffer } from "@/lib/excel/excelParser";
import { validateExcelRows } from "@/lib/excel/excelValidator";
import { parseIndianDate, getISTCalendarDate } from "@/lib/utils";
import { getPreviousTransactionBalance } from "@/lib/services/transactionService";
import { connectDB } from "@/lib/db/connection";
import { Transaction } from "@/lib/models/Transaction";
import { getColumnHeaderForField } from "@/lib/excel/excelParser";
import { ExcelValidationErrorItem } from "@/lib/excel/types";

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

    // Check dates against existing transactions in MAIN account
    await connectDB();
    const datesToCheck: string[] = [];
    const dateIntervalQueries: Record<string, unknown>[] = [];
    for (const r of validationSummary.rows) {
      if (r.data.date) {
        const cal = getISTCalendarDate(r.data.date);
        if (cal && !datesToCheck.includes(cal.dateStr)) {
          datesToCheck.push(cal.dateStr);
          dateIntervalQueries.push({ date: { $gte: cal.start, $lte: cal.end } });
        }
      }
    }

    if (datesToCheck.length > 0) {
      const existingTxs = await Transaction.find({
        accountType: "MAIN",
        isArchived: { $ne: true },
        $or: [
          { normalizedDate: { $in: datesToCheck } },
          ...dateIntervalQueries,
        ],
      }).lean();

      if (existingTxs.length > 0) {
        const occupiedDates = new Set<string>();
        for (const tx of existingTxs) {
          const cal = getISTCalendarDate(tx.date);
          if (cal) occupiedDates.add(cal.dateStr);
          if (tx.normalizedDate) occupiedDates.add(tx.normalizedDate);
        }

        // Mark colliding rows as invalid
        for (const r of validationSummary.rows) {
          if (!r.data.date) continue;
          const cal = getISTCalendarDate(r.data.date);
          if (cal && occupiedDates.has(cal.dateStr)) {
            const errMessage = `A transaction already exists for ${cal.displayDate}`;
            const howToFix = `A transaction is already recorded for ${cal.displayDate} in the MAIN account. Duplicate transaction dates are not permitted.`;
            const errItem: ExcelValidationErrorItem = {
              sheetName: r.sheetName,
              rowNumber: r.rowNumber,
              field: "date",
              columnHeader: getColumnHeaderForField("date"),
              currentValue: cal.displayDate,
              code: "DUPLICATE_TRANSACTION_DATE",
              error: errMessage,
              howToFix,
              message: errMessage,
              suggestion: howToFix,
            };
            r.isValid = false;
            r.errors.push(errMessage);
            r.errorItems.push(errItem);
            validationSummary.allErrors.push(errItem);
          }
        }

        validationSummary.validCount = validationSummary.rows.filter((r) => r.isValid).length;
        validationSummary.invalidRowCount = validationSummary.rows.filter((r) => !r.isValid).length;
        validationSummary.totalErrorsCount = validationSummary.allErrors.length;
        validationSummary.errorCount = validationSummary.invalidRowCount;
      }
    }

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
