import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { Transaction } from "@/lib/models/Transaction";
import { generateAccountingExcel } from "@/lib/excel/excelExporter";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const accountType = searchParams.get("accountType") || "ALL";
    const origin = searchParams.get("origin") || searchParams.get("transactionOrigin") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const category = searchParams.get("category") || undefined;

    await connectDB();

    const query: any = { isArchived: { $ne: true }, accountType: "MAIN" };

    if (origin && origin !== "ALL") {
      if (origin === "PRE_COMPANY") {
        query.transactionOrigin = "PRE_COMPANY";
      } else {
        query.$or = [{ transactionOrigin: "COMPANY" }, { transactionOrigin: { $exists: false } }];
      }
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
          const [sYear, sMonth, sDay] = startDate.split("-").map(Number);
          query.date.$gte = new Date(Date.UTC(sYear, sMonth - 1, sDay, 0, 0, 0, 0));
        } else {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          query.date.$gte = start;
        }
      }
      if (endDate) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
          const [eYear, eMonth, eDay] = endDate.split("-").map(Number);
          query.date.$lte = new Date(Date.UTC(eYear, eMonth - 1, eDay, 23, 59, 59, 999));
        } else {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          query.date.$lte = end;
        }
      }
    }

    if (category && category !== "ALL") {
      query.category = category;
    }

    const transactions = await Transaction.find(query)
      .sort({ date: 1, createdAt: 1 })
      .lean();

    if (transactions.length === 0) {
      return NextResponse.json(
        { error: "No transactions found matching the selected export criteria" },
        { status: 404 }
      );
    }

    const isPreCompany = origin === "PRE_COMPANY";
    const title = isPreCompany ? "Foxion Pre-Company Transactions" : "Foxion Accounts";
    const buffer = generateAccountingExcel(transactions as any, title);

    const nowStr = new Date().toISOString().slice(0, 10);
    const filename = isPreCompany
      ? `Foxion_Pre_Company_Transactions_${nowStr}.xlsx`
      : `Foxion_Accounts_${nowStr}.xlsx`;

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
  } catch (error: any) {
    console.error("Excel export error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to export Excel" },
      { status: 500 }
    );
  }
}
