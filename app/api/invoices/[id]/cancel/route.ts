import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { cancelInvoice } from "@/lib/services/taxInvoiceService";
import { cancelInvoiceSchema } from "@/lib/invoices/validation";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = cancelInvoiceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const cancelled = await cancelInvoice(
      id,
      parsed.data.reason,
      user.name || user.email || "System"
    );

    return NextResponse.json({
      success: true,
      message: `Invoice ${cancelled.serialNumber} has been cancelled`,
      invoice: cancelled,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
