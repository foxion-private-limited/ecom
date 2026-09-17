import { connectDB } from "@/lib/db/connection";
import { Transaction, AccountType } from "@/lib/models/Transaction";
import { ImportBatch } from "@/lib/models/ImportBatch";
import { Category } from "@/lib/models/Category";
import { ExcelAccountingRow, ExcelImportResult } from "./types";
import { parseIndianDate } from "@/lib/utils";

export async function importAccountingBatch(
  validRows: ExcelAccountingRow[],
  accountType: AccountType,
  filename: string,
  userEmail: string = "System"
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
          type: accountType === "ECOMMERCE" ? "INCOME" : "EXPENSE",
          isActive: true,
        });
      }
    }

    // 2. Prepare transaction documents
    const txDocs = [];
    for (const row of validRows) {
      const parsedDate = parseIndianDate(row.date) || new Date();

      txDocs.push({
        accountType,
        date: parsedDate,
        description: row.description,
        category: row.category,
        debit: Number(row.debit) || 0,
        credit: Number(row.credit) || 0,
        paymentMode: row.paymentMode || "Bank Transfer",
        bankOrCash: row.bankOrCash || "Bank",
        partyName: row.partyName,
        invoiceOrderId: row.invoiceOrderId,
        gstApplicable: !!row.gstApplicable,
        gstAmount: Number(row.gstAmount) || 0,
        tdsTcsAmount: Number(row.tdsTcsAmount) || 0,
        remarks: row.remarks,
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
