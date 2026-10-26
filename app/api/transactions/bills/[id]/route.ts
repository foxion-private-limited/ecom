import { NextResponse } from "next/server";
import {
  getBillFromGridFS,
  deleteBillFromGridFS,
  isBillReferencedByOtherTransactions,
} from "@/lib/services/billStorageService";
import { Readable } from "stream";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const billData = await getBillFromGridFS(id);

    if (!billData) {
      return NextResponse.json({ error: "Bill attachment not found" }, { status: 404 });
    }

    const webStream = Readable.toWeb(
      billData.stream as Readable
    ) as ReadableStream<Uint8Array>;

    const safeFilename = encodeURIComponent(billData.originalName).replace(
      /['()]/g,
      escape
    );

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": billData.contentType,
        "Content-Length": billData.length.toString(),
        "Content-Disposition": `inline; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`,
        "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load bill";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const inUse = await isBillReferencedByOtherTransactions(id);
    if (inUse) {
      return NextResponse.json(
        { error: "Bill is referenced by an active transaction and cannot be deleted" },
        { status: 400 }
      );
    }

    const deleted = await deleteBillFromGridFS(id);
    if (!deleted) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Bill attachment deleted" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete bill";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
