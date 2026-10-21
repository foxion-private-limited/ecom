import { NextResponse } from "next/server";
import { updateTransaction, archiveTransaction } from "@/lib/services/transactionService";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const updated = await updateTransaction(id, body);
    if (!updated) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, transaction: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update transaction";
    const isConflict = message.includes("already exists for this date");
    return NextResponse.json({ error: message }, { status: isConflict ? 409 : 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const archived = await archiveTransaction(id);
    if (!archived) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to archive transaction";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
