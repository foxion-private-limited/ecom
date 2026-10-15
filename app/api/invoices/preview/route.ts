import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { generateLivePreview } from "@/lib/services/taxInvoiceService";
import { createInvoiceDraftSchema } from "@/lib/invoices/validation";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createInvoiceDraftSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { html, totals, viewModel } = await generateLivePreview(parsed.data);

    return NextResponse.json({
      success: true,
      html,
      totals,
      viewModel,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
