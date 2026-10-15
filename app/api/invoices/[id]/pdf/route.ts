import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getInvoiceById } from "@/lib/services/taxInvoiceService";
import { getInvoicePdfBuffer } from "@/lib/services/invoiceStorageService";
import { getInvoiceSettings } from "@/lib/services/invoiceSettingsService";
import { buildInvoiceViewModel } from "@/lib/invoices/viewModel";
import { renderInvoiceHtml } from "@/lib/invoices/template";
import { renderHtmlToPdf } from "@/lib/invoices/pdfRenderer";

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
    const isDownload = searchParams.get("download") === "true";

    // 1. If issued and has stored PDF in GridFS, serve the permanent canonical archive
    if (invoice.pdfGridFsId) {
      const { buffer, filename } = await getInvoicePdfBuffer(invoice.pdfGridFsId);
      const disposition = isDownload ? "attachment" : "inline";

      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `${disposition}; filename="${encodeURIComponent(filename)}"`,
          "Content-Length": buffer.length.toString(),
          "Cache-Control": "private, max-age=86400",
        },
      });
    }

    // 2. If draft (or test preview), generate temporary preview PDF on demand
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
    const pdfBuffer = await renderHtmlToPdf(html);

    const filename = `PREVIEW_${invoice.mode}_${invoice._id}.pdf`;
    const disposition = isDownload ? "attachment" : "inline";

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
