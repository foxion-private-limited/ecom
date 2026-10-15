import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getInvoiceSettings,
  updateInvoiceSettings,
  checkProductionReadiness,
} from "@/lib/services/invoiceSettingsService";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const settings = await getInvoiceSettings();
    const readiness = checkProductionReadiness(settings);

    return NextResponse.json({
      success: true,
      settings,
      productionReadiness: readiness,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const body = await req.json();
    const updated = await updateInvoiceSettings(
      body,
      user.name || user.email || "System"
    );

    const readiness = checkProductionReadiness(updated);

    return NextResponse.json({
      success: true,
      message: "Invoice settings updated",
      settings: updated,
      productionReadiness: readiness,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
