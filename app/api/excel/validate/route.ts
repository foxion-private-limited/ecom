import { NextResponse } from "next/server";
import { parseExcelBuffer } from "@/lib/excel/excelParser";
import { validateExcelRows } from "@/lib/excel/excelValidator";

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

    // Validate rows
    const validationSummary = validateExcelRows(rows, file.name);

    return NextResponse.json({
      success: true,
      headers,
      summary: validationSummary,
    });
  } catch (error: any) {
    console.error("Excel validation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to parse and validate Excel file" },
      { status: 500 }
    );
  }
}
