import { NextResponse } from "next/server";
import {
  getProfitAndLossReport,
  getGSTReport,
  getCashFlowReport,
  getEcommerceAnalyticsReport,
  getSalesReport,
  getPurchasesReport,
  getExpensesReport,
  getInventoryReport,
} from "@/lib/services/reportService";
import { DateRangePreset } from "@/lib/services/dashboardService";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params;
    const { searchParams } = new URL(req.url);

    const preset = (searchParams.get("preset") as DateRangePreset) || "THIS_MONTH";
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const category = searchParams.get("category") || undefined;
    const platform = searchParams.get("platform") || undefined;

    const filter = { preset, startDate, endDate, category, platform };

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
      case "sales": {
        const report = await getSalesReport(filter);
        return NextResponse.json(report);
      }
      case "purchases": {
        const report = await getPurchasesReport(filter);
        return NextResponse.json(report);
      }
      case "expenses": {
        const report = await getExpensesReport(filter);
        return NextResponse.json(report);
      }
      case "inventory": {
        const report = await getInventoryReport();
        return NextResponse.json(report);
      }
      default:
        return NextResponse.json(
          { error: `Unknown report type: ${type}` },
          { status: 400 }
        );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate report";
    console.error("Report error:", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
