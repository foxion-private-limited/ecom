import { NextResponse } from "next/server";
import {
  getProfitAndLossReport,
  getGSTReport,
  getCashFlowReport,
  getEcommerceAnalyticsReport,
} from "@/lib/services/reportService";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params;
    const { searchParams } = new URL(req.url);

    const preset = (searchParams.get("preset") as any) || "THIS_MONTH";
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const accountType = (searchParams.get("accountType") as any) || "ALL";

    const filter = { preset, startDate, endDate, accountType };

    switch (type.toLowerCase()) {
      case "pnl":
      case "profit-and-loss": {
        const report = await getProfitAndLossReport(filter);
        return NextResponse.json(report);
      }
      case "gst": {
        const report = await getGSTReport(filter);
        return NextResponse.json(report);
      }
      case "cashflow": {
        const report = await getCashFlowReport(filter);
        return NextResponse.json(report);
      }
      case "ecommerce": {
        const report = await getEcommerceAnalyticsReport(filter);
        return NextResponse.json(report);
      }
      default:
        return NextResponse.json(
          { error: `Unknown report type: ${type}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("Report error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate report" },
      { status: 500 }
    );
  }
}
