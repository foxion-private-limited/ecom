import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  verifyGstRegistration,
  revokeGstVerification,
  checkProductionReadiness,
} from "@/lib/services/invoiceSettingsService";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const body = await req.json();
    const reference = body.reference || "Verified by Administrator";
    const effectiveDate = body.effectiveDate ? new Date(body.effectiveDate) : null;

    const settings = await verifyGstRegistration(
      reference,
      user.name || user.email || "Admin",
      effectiveDate
    );

    const readiness = checkProductionReadiness(settings);

    return NextResponse.json({
      success: true,
      message: "GST registration verified successfully",
      settings,
      productionReadiness: readiness,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const settings = await revokeGstVerification(user.name || user.email || "Admin");
    const readiness = checkProductionReadiness(settings);

    return NextResponse.json({
      success: true,
      message: "GST registration verification revoked",
      settings,
      productionReadiness: readiness,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
