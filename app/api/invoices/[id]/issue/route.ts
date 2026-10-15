import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { issueInvoice } from "@/lib/services/taxInvoiceService";

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
    let body: { idempotencyKey?: string; exportPng?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is acceptable
    }

    const issued = await issueInvoice(
      id,
      user.name || user.email || "System",
      {
        idempotencyKey: body.idempotencyKey,
        exportPng: body.exportPng,
      }
    );

    return NextResponse.json({
      success: true,
      message: `Invoice ${issued.serialNumber} successfully issued`,
      invoice: issued,
      pdfUrl: `/api/invoices/${issued._id}/pdf`,
      pngUrls: issued.pngGridFsIds?.map(
        (_, idx) => `/api/invoices/${issued._id}/png?page=${idx + 1}`
      ) || [],
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
