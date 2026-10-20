import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { getTransactions } from "@/lib/services/transactionService";
import {
  generateAccountingExcel,
  TransactionExportItem,
  getAccountingExportFilename,
} from "@/lib/excel/excelExporter";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const accountType = searchParams.get("accountType") || "MAIN";
    const origin = searchParams.get("origin") || searchParams.get("transactionOrigin") || undefined;
    const scope = (searchParams.get("scope") as "ALL" | "MONTH" | "RANGE" | null) || undefined;
    const month = searchParams.get("month") || undefined;
    const year = searchParams.get("year") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const category = searchParams.get("category") || undefined;
    const paymentMode = searchParams.get("paymentMode") || undefined;
    const bankOrCash = (searchParams.get("bankOrCash") as "Bank" | "Cash" | "Personal Bank" | "Personal Cash" | "ALL") || undefined;
    const paymentSource = searchParams.get("paymentSource") || undefined;
    const paidBy = searchParams.get("paidBy") || undefined;
    const partyName = searchParams.get("partyName") || undefined;
    const search = searchParams.get("search") || undefined;

    await connectDB();

    const result = await getTransactions({
      accountType,
      transactionOrigin: (origin as "COMPANY" | "PRE_COMPANY" | "ALL") || "COMPANY",
      startDate,
      endDate,
      category,
      paymentMode,
      bankOrCash,
      paymentSource,
      paidBy,
      partyName,
      search,
      unpaginated: true,
    });

    if (result.transactions.length === 0) {
      return NextResponse.json(
        { error: "No transactions found matching the selected export criteria" },
        { status: 404 }
      );
    }

    const isPreCompany = origin === "PRE_COMPANY";
    const title = isPreCompany ? "Foxion Pre-Company Transactions" : "Foxion Accounts";
    const buffer = generateAccountingExcel(result.transactions as unknown as TransactionExportItem[], title);

    const filename = getAccountingExportFilename({
      scope,
      month,
      year,
      startDate,
      endDate,
      origin,
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Export-Count": String(result.transactions.length),
        "Access-Control-Expose-Headers": "Content-Disposition, X-Export-Count",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to export Excel";
    console.error("Excel export error:", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      transactions,
      origin,
      title: customTitle,
      scope,
      month,
      year,
      startDate,
      endDate,
      filename: customFilename,
    } = body as {
      transactions?: TransactionExportItem[];
      origin?: "COMPANY" | "PRE_COMPANY";
      title?: string;
      scope?: "ALL" | "MONTH" | "RANGE";
      month?: number | string;
      year?: number | string;
      startDate?: string;
      endDate?: string;
      filename?: string;
    };

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json(
        { error: "No transactions provided for export" },
        { status: 400 }
      );
    }

    const isPreCompany = origin === "PRE_COMPANY";
    const title = customTitle || (isPreCompany ? "Foxion Pre-Company Transactions" : "Foxion Accounts");
    const buffer = generateAccountingExcel(transactions, title);

    const filename =
      customFilename ||
      getAccountingExportFilename({
        scope,
        month,
        year,
        startDate,
        endDate,
        origin,
      });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Export-Count": String(transactions.length),
        "Access-Control-Expose-Headers": "Content-Disposition, X-Export-Count",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to export Excel";
    console.error("Excel POST export error:", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
