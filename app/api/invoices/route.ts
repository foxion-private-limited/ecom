import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  createInvoiceDraft,
  listInvoices,
  getInvoiceStats,
} from "@/lib/services/taxInvoiceService";
import { createInvoiceDraftSchema, listInvoicesSchema } from "@/lib/invoices/validation";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    if (searchParams.get("stats") === "true") {
      const stats = await getInvoiceStats();
      return NextResponse.json({ success: true, stats });
    }

    const rawParams = {
      mode: searchParams.get("mode") || "ALL",
      status: searchParams.get("status") || "ALL",
      financialYear: searchParams.get("financialYear") || undefined,
      search: searchParams.get("search") || undefined,
      page: searchParams.get("page") || "1",
      limit: searchParams.get("limit") || "50",
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
    };

    const parsed = listInvoicesSchema.parse(rawParams);
    const result = await listInvoices(parsed);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

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

    const invoice = await createInvoiceDraft(
      parsed.data,
      user.name || user.email || "System"
    );

    return NextResponse.json({ success: true, invoice }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
