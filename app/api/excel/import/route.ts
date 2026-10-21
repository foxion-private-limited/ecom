import { NextResponse } from "next/server";
import { importAccountingBatch } from "@/lib/excel/excelImporter";
import { getCurrentUser } from "@/lib/auth/session";
import { ExcelAccountingRow } from "@/lib/excel/types";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const { rows, filename, origin, openingBalance } = body as {
      rows?: ExcelAccountingRow[];
      accountType?: string;
      filename?: string;
      origin?: string;
      openingBalance?: number;
    };

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
      targetOrigin,
      typeof openingBalance === "number" ? { initialBalance: openingBalance } : undefined
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.errors[0] || "Import failed",
          errors: result.errors,
          batchId: result.batchId,
          importedCount: result.importedCount,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to import rows";
    console.error("Excel import error:", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
