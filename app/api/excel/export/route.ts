import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { Transaction } from "@/lib/models/Transaction";
import { generateAccountingExcel } from "@/lib/excel/excelExporter";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const accountType = searchParams.get("accountType") || "ALL";
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const category = searchParams.get("category") || undefined;

    await connectDB();

    const query: any = { isArchived: { $ne: true } };

    if (accountType !== "ALL") {
      query.accountType = accountType;
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    if (category && category !== "ALL") {
      query.category = category;
    }

    const transactions = await Transaction.find(query)
      .sort({ date: 1, createdAt: 1 })
      .lean();

    const title = `Foxion_${accountType}_Accounts`;
    const buffer = generateAccountingExcel(transactions as any, title);

    const nowStr = new Date().toISOString().slice(0, 10);
    const filename = `Foxion_${accountType}_Accounts_${nowStr}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
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
