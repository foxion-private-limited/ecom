/**
 * Concurrency-safe invoice number allocation.
 *
 * Format: {PREFIX}/{FY_CODE}/{ZERO_PADDED_SEQ}
 * Example: INV/26-27/001
 *
 * Test invoices use the same format with a "TEST-" internal key prefix
 * to keep counters isolated. The serial number itself is distinct enough
 * via the mode stored on the invoice document.
 *
 * Numbers are allocated atomically via MongoDB findOneAndUpdate $inc,
 * preventing duplicates under concurrent requests.
 */

import { connectDB } from "@/lib/db/connection";
import { InvoiceCounter } from "@/lib/models/InvoiceCounter";

function buildCounterKey(mode: "TEST" | "PRODUCTION", financialYear: string, prefix: string): string {
  return `${mode}::${financialYear}::${prefix}`;
}

function padSequence(seq: number, minDigits: number = 3): string {
  return String(seq).padStart(minDigits, "0");
}

/**
 * Allocate the next sequential invoice number for the given mode + FY + prefix.
 * This is atomic: concurrent calls will each receive a unique number.
 *
 * @returns The formatted serial number, e.g. "INV/26-27/001"
 */
export async function allocateInvoiceNumber(
  mode: "TEST" | "PRODUCTION",
  financialYear: string,
  prefix: string
): Promise<string> {
  await connectDB();

  const key = buildCounterKey(mode, financialYear, prefix);

  const counter = await InvoiceCounter.findOneAndUpdate(
    { key },
    {
      $inc: { lastSequence: 1 },
      $setOnInsert: { mode, financialYear, prefix },
    },
    { upsert: true, returnDocument: "after" }
  );

  if (!counter) {
    throw new Error("Failed to allocate invoice number — counter document not returned");
  }

  const seq = counter.lastSequence;
  return `${prefix}/${financialYear}/${padSequence(seq)}`;
}

/**
 * Preview the NEXT number that would be allocated (without actually allocating it).
 * Used only for display purposes; do NOT use as the actual issued number.
 */
export async function peekNextInvoiceNumber(
  mode: "TEST" | "PRODUCTION",
  financialYear: string,
  prefix: string
): Promise<string> {
  await connectDB();

  const key = buildCounterKey(mode, financialYear, prefix);
  const counter = await InvoiceCounter.findOne({ key }).lean();
  const nextSeq = (counter?.lastSequence ?? 0) + 1;
  return `${prefix}/${financialYear}/${padSequence(nextSeq)}`;
}
