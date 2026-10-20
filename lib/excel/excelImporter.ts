import { connectDB } from "@/lib/db/connection";
import { Transaction, AccountType, TransactionOrigin } from "@/lib/models/Transaction";
import { ImportBatch } from "@/lib/models/ImportBatch";
import { Category } from "@/lib/models/Category";
import { ExcelAccountingRow, ExcelImportResult } from "./types";
import { parseIndianDate } from "@/lib/utils";
import {
  getPreviousTransactionBalance,
  calculateImportBalances,
} from "@/lib/services/transactionService";

export async function importAccountingBatch(
  validRows: ExcelAccountingRow[],
  accountType: AccountType = "MAIN",
  filename: string,
  userEmail: string = "System",
  origin: TransactionOrigin = "COMPANY",
  options?: { initialBalance?: number }
): Promise<ExcelImportResult> {
  await connectDB();

  const batchId = `BATCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  let importedCount = 0;
  const skippedCount = 0;
  const errors: string[] = [];

  try {
    // 1. Ensure unique categories exist in DB
    const categoryNames = Array.from(
      new Set(validRows.map((r) => r.category).filter(Boolean))
    );
    for (const catName of categoryNames) {
      const existing = await Category.findOne({
        name: { $regex: new RegExp(`^${catName.trim()}$`, "i") },
      });
      if (!existing) {
        await Category.create({
          name: catName.trim(),
          slug: catName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          type: "EXPENSE",
          isActive: true,
        });
      }
    }

    // 2. Identify earliest transaction date and resolve legitimate opening balance
    let earliestDate: Date | null = null;
    for (const r of validRows) {
      const parsed = parseIndianDate(r.date);
      if (parsed && !isNaN(parsed.getTime())) {
        if (!earliestDate || parsed.getTime() < earliestDate.getTime()) {
          earliestDate = parsed;
        }
      }
    }

    const openingBalance = earliestDate
      ? await getPreviousTransactionBalance(earliestDate, accountType, origin, options)
      : (options?.initialBalance ?? 0);

    // Calculate sequential balances chronologically from opening balance
    const balancedRows = calculateImportBalances(validRows, openingBalance);

    // 3. Prepare transaction documents with sequential balances
    const txDocs = [];
    for (const row of balancedRows) {
      const parsedDate = parseIndianDate(row.date) || new Date();
      const rowOrigin = row.transactionOrigin || origin;
      const bankOrCash = row.bankOrCash || (rowOrigin === "PRE_COMPANY" ? "Personal Bank" : "Bank");
      let paymentSource = row.paymentSource;
      if (!paymentSource) {
        if (bankOrCash === "Personal Bank") paymentSource = "Personal Bank";
        else if (bankOrCash === "Personal Cash") paymentSource = "Personal Cash";
        else if (bankOrCash === "Cash") paymentSource = "Company Cash";
        else paymentSource = "Company Bank";
      }

      txDocs.push({
        accountType,
        transactionOrigin: rowOrigin,
        paidBy: row.paidBy?.trim() || undefined,
        paymentSource,
        date: parsedDate,
        description: row.description,
        category: row.category,
        debit: Number(row.debit) || 0,
        credit: Number(row.credit) || 0,
        balance: row.balance,
        paymentMode: row.paymentMode || (bankOrCash.includes("Cash") ? "Cash" : "UPI"),
        bankOrCash,
        partyName: row.partyName?.trim() || undefined,
        invoiceOrderId: row.invoiceOrderId?.trim() || undefined,
        gstApplicable: !!row.gstApplicable,
        gstAmount: Number(row.gstAmount) || 0,
        tdsTcsAmount: Number(row.tdsTcsAmount) || 0,
        remarks: row.remarks?.trim() || undefined,
        billAvailable: !!row.billAvailable,
        source: "EXCEL_IMPORT",
        importBatchId: batchId,
        createdBy: userEmail,
      });
    }

    if (txDocs.length > 0) {
      await Transaction.insertMany(txDocs);
      importedCount = txDocs.length;
    }

    // 3. Record the ImportBatch document
    await ImportBatch.create({
      batchId,
      filename,
      accountType,
      origin,
      totalRows: validRows.length,
      validRows: validRows.length,
      importedRows: importedCount,
      warningCount: skippedCount,
      errorCount: 0,
      status: "COMPLETED",
      importedBy: userEmail,
    });

    return {
      success: true,
      batchId,
      importedCount,
      skippedCount,
      errors,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save imported rows";
    console.error("[Excel Importer] Batch import failed:", message);
    errors.push(message);
    return {
      success: false,
      batchId,
      importedCount,
      skippedCount,
      errors,
    };
  }
}
