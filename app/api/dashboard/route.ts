import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/services/dashboardService";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const preset = (searchParams.get("preset") as any) || "THIS_MONTH";
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const data = await getDashboardData({
      preset,
      startDate,
      endDate,
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Dashboard data error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load dashboard data" },
      { status: 500 }
    );
  }
}
