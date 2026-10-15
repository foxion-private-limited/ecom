import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getInvoiceById,
  updateInvoiceDraft,
  deleteInvoiceDraft,
} from "@/lib/services/taxInvoiceService";
import { updateInvoiceDraftSchema } from "@/lib/invoices/validation";
import { getInvoiceSettings } from "@/lib/services/invoiceSettingsService";
import { buildInvoiceViewModel } from "@/lib/invoices/viewModel";
import { renderInvoiceHtml } from "@/lib/invoices/template";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const { id } = await params;
    const invoice = await getInvoiceById(id);

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);

    // If HTML preview is requested
    if (searchParams.get("html") === "true") {
      const settings = await getInvoiceSettings();
      const lineItemTotals = {
        taxableSubtotal: invoice.taxSummary?.taxableSubtotal || 0,
        totalDiscount: invoice.taxSummary?.totalDiscount || 0,
        cgstTotal: invoice.taxSummary?.cgstTotal || 0,
        sgstTotal: invoice.taxSummary?.sgstTotal || 0,
        igstTotal: invoice.taxSummary?.igstTotal || 0,
        totalGst: invoice.taxSummary?.totalGst || 0,
        grossTotal: invoice.taxSummary?.grossTotal || 0,
        roundOff: invoice.taxSummary?.roundOff || 0,
        amountPayable: invoice.taxSummary?.amountPayable || 0,
        lineItems: invoice.lineItems,
      };

      const viewModel = buildInvoiceViewModel(invoice, settings, lineItemTotals);
      const html = renderInvoiceHtml(viewModel);

      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return NextResponse.json({ success: true, invoice });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(
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
    const parsed = updateInvoiceDraftSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await updateInvoiceDraft(
      id,
      parsed.data,
      user.name || user.email || "System"
    );

    return NextResponse.json({ success: true, invoice: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const { id } = await params;
    await deleteInvoiceDraft(id);

    return NextResponse.json({ success: true, message: "Draft deleted" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
