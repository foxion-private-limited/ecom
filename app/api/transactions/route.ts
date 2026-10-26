import { NextResponse } from "next/server";
import { getTransactions, createTransaction } from "@/lib/services/transactionService";
import { transactionSchema } from "@/lib/validations";
import { getCurrentUser } from "@/lib/auth/session";
import mongoose from "mongoose";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const accountType = (searchParams.get("accountType") as any) || "ALL";
    const transactionOrigin = ((searchParams.get("transactionOrigin") || searchParams.get("origin")) as any) || undefined;
    const paymentSource = searchParams.get("paymentSource") || undefined;
    const paidBy = searchParams.get("paidBy") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const category = searchParams.get("category") || undefined;
    const paymentMode = searchParams.get("paymentMode") || undefined;
    const bankOrCash = (searchParams.get("bankOrCash") as any) || undefined;
    const partyName = searchParams.get("partyName") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const result = await getTransactions({
      accountType,
      transactionOrigin,
      paymentSource,
      paidBy,
      startDate,
      endDate,
      category,
      paymentMode,
      bankOrCash,
      partyName,
      search,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch transactions";
    console.error("GET transactions error:", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

import {
  validateBillBuffer,
  uploadBillToGridFS,
  deleteBillFromGridFS,
} from "@/lib/services/billStorageService";

export async function POST(req: Request) {
  let uploadedFileId: mongoose.Types.ObjectId | null = null;
  try {
    const user = await getCurrentUser();
    const contentType = req.headers.get("content-type") || "";

    let rawData: Record<string, unknown> = {};

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const payloadStr = formData.get("payload") || formData.get("data");

      if (typeof payloadStr === "string") {
        try {
          rawData = JSON.parse(payloadStr);
        } catch {
          return NextResponse.json(
            { error: "Invalid JSON format in payload field" },
            { status: 400 }
          );
        }
      } else {
        // Parse individual form fields
        formData.forEach((val, key) => {
          if (key === "billFile" || key === "file" || key === "attachment") return;
          if (typeof val === "string") {
            if (val === "true") rawData[key] = true;
            else if (val === "false") rawData[key] = false;
            else if (!isNaN(Number(val)) && val.trim() !== "" && (key === "debit" || key === "credit" || key === "gstAmount" || key === "tdsTcsAmount")) {
              rawData[key] = Number(val);
            } else {
              rawData[key] = val;
            }
          }
        });
      }

      const file = (formData.get("billFile") || formData.get("file") || formData.get("attachment")) as File | null;

      if (file && file.size > 0 && typeof file.arrayBuffer === "function") {
        const debitAmount = Number(rawData.debit || 0);
        const creditAmount = Number(rawData.credit || 0);

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

        rawData.attachment = {
          fileId: stored.fileId.toString(),
          url: stored.url,
          originalName: stored.originalName,
          mimeType: stored.mimeType,
          size: stored.size,
        };
        rawData.billAvailable = true;
      }
    } else {
      rawData = await req.json();

      if (rawData.attachment && Number(rawData.credit || 0) > 0) {
        return NextResponse.json(
          { error: "Bill attachments are only permitted for Debit transactions" },
          { status: 400 }
        );
      }
    }

    const parsed = transactionSchema.safeParse(rawData);
    if (!parsed.success) {
      if (uploadedFileId) {
        await deleteBillFromGridFS(uploadedFileId).catch(() => {});
      }
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { billId, attachment, ...rest } = parsed.data;

    const tx = await createTransaction(
      {
        ...rest,
        attachment: attachment
          ? {
              ...attachment,
              fileId: attachment.fileId ? new mongoose.Types.ObjectId(attachment.fileId) : undefined,
            }
          : undefined,
        billId: attachment?.fileId
          ? new mongoose.Types.ObjectId(attachment.fileId)
          : billId
          ? new mongoose.Types.ObjectId(billId)
          : undefined,
      },
      user?.email || "System"
    );

    return NextResponse.json({ success: true, transaction: tx });
  } catch (error: unknown) {
    if (uploadedFileId) {
      await deleteBillFromGridFS(uploadedFileId).catch(() => {});
    }
    const message = error instanceof Error ? error.message : "Failed to create transaction";
    console.error("POST transaction error:", message);
    const isConflict = message.includes("already exists for this date");
    const isDebitOnlyError = message.includes("Debit transactions");
    return NextResponse.json(
      { error: message },
      { status: isConflict ? 409 : isDebitOnlyError ? 400 : 500 }
    );
  }
}
