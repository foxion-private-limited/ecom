import { NextResponse } from "next/server";
import { importAccountingBatch } from "@/lib/excel/excelImporter";
import { getCurrentUser } from "@/lib/auth/session";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const { rows, accountType, filename } = await req.json();

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "No valid rows provided for import" },
        { status: 400 }
      );
    }

    if (!accountType || !["MAIN", "ECOMMERCE"].includes(accountType)) {
      return NextResponse.json(
        { error: "Valid accountType ('MAIN' or 'ECOMMERCE') is required" },
        { status: 400 }
      );
    }

    const result = await importAccountingBatch(
      rows,
      accountType,
      filename || "import.xlsx",
      user?.email || "System"
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Excel import error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to import rows" },
      { status: 500 }
    );
  }
}
