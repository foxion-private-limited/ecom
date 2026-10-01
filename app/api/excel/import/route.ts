import { NextResponse } from "next/server";
import { importAccountingBatch } from "@/lib/excel/excelImporter";
import { getCurrentUser } from "@/lib/auth/session";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const { rows, accountType, filename, origin } = await req.json();

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "No valid rows provided for import" },
        { status: 400 }
      );
    }

    const targetAccountType = "MAIN";
    const targetOrigin = origin === "PRE_COMPANY" ? "PRE_COMPANY" : "COMPANY";

    const result = await importAccountingBatch(
      rows,
      targetAccountType,
      filename || "import.xlsx",
      user?.email || "System",
      targetOrigin
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
