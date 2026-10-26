import { NextResponse } from "next/server";
import mongoose from "mongoose";
import {
  updateTransaction,
  archiveTransaction,
  deleteTransactionPermanently,
} from "@/lib/services/transactionService";
import {
  validateBillBuffer,
  uploadBillToGridFS,
  deleteBillFromGridFS,
} from "@/lib/services/billStorageService";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let uploadedFileId: mongoose.Types.ObjectId | null = null;
  try {
    const { id } = await params;
    const contentType = req.headers.get("content-type") || "";

    let updateData: Record<string, unknown> = {};

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const payloadStr = formData.get("payload") || formData.get("data");

      if (typeof payloadStr === "string") {
        try {
          updateData = JSON.parse(payloadStr);
        } catch {
          return NextResponse.json(
            { error: "Invalid JSON format in payload field" },
            { status: 400 }
          );
        }
      } else {
        formData.forEach((val, key) => {
          if (
            key === "billFile" ||
            key === "file" ||
            key === "attachment" ||
            key === "removeAttachment"
          )
            return;
          if (typeof val === "string") {
            if (val === "true") updateData[key] = true;
            else if (val === "false") updateData[key] = false;
            else if (
              !isNaN(Number(val)) &&
              val.trim() !== "" &&
              (key === "debit" ||
                key === "credit" ||
                key === "gstAmount" ||
                key === "tdsTcsAmount")
            ) {
              updateData[key] = Number(val);
            } else {
              updateData[key] = val;
            }
          }
        });
      }

      const removeAttachment = formData.get("removeAttachment");
      if (removeAttachment === "true") {
        updateData.attachment = null;
      }

      const file = (formData.get("billFile") ||
        formData.get("file") ||
        formData.get("attachment")) as File | null;

      if (file && file.size > 0 && typeof file.arrayBuffer === "function") {
        const debitAmount = Number(updateData.debit ?? 0);
        const creditAmount = Number(updateData.credit ?? 0);

        if (creditAmount > 0 || debitAmount <= 0) {
          return NextResponse.json(
            { error: "Bill attachments are only permitted for Debit transactions" },
            { status: 400 }
          );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const validation = validateBillBuffer(buffer);

        if (!validation.isValid || !validation.contentType) {
          return NextResponse.json(
            { error: validation.error || "Invalid file format or size limit exceeded" },
            { status: 400 }
          );
        }

        const stored = await uploadBillToGridFS({
          buffer,
          filename: file.name,
          contentType: validation.contentType,
        });

        uploadedFileId = stored.fileId;

        updateData.attachment = {
          fileId: stored.fileId,
          url: stored.url,
          originalName: stored.originalName,
          mimeType: stored.mimeType,
          size: stored.size,
        };
        updateData.billAvailable = true;
      }
    } else {
      updateData = await req.json();

      if (updateData.attachment && Number(updateData.credit || 0) > 0) {
        return NextResponse.json(
          { error: "Bill attachments are only permitted for Debit transactions" },
          { status: 400 }
        );
      }
    }

    const updated = await updateTransaction(id, updateData);
    if (!updated) {
      if (uploadedFileId) {
        await deleteBillFromGridFS(uploadedFileId).catch(() => {});
      }
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, transaction: updated });
  } catch (error: unknown) {
    if (uploadedFileId) {
      await deleteBillFromGridFS(uploadedFileId).catch(() => {});
    }
    const message = error instanceof Error ? error.message : "Failed to update transaction";
    const isConflict = message.includes("already exists for this date");
    const isDebitOnly = message.includes("Debit transactions");
    return NextResponse.json(
      { error: message },
      { status: isConflict ? 409 : isDebitOnly ? 400 : 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const permanent = searchParams.get("permanent") === "true";

    if (permanent) {
      const deleted = await deleteTransactionPermanently(id);
      if (!deleted) {
        return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: "Transaction deleted permanently" });
    }

    const archived = await archiveTransaction(id);
    if (!archived) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete/archive transaction";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
