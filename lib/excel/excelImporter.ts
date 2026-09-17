import { connectDB } from "@/lib/db/connection";
import { Transaction, AccountType } from "@/lib/models/Transaction";
import { ImportBatch } from "@/lib/models/ImportBatch";
import { Category } from "@/lib/models/Category";
import { ExcelAccountingRow, ExcelImportResult } from "./types";

export async function importAccountingBatch(
  validRows: ExcelAccountingRow[],
  accountType: AccountType,
  filename: string,
  userEmail: string = "System"
): Promise<ExcelImportResult> {
  await connectDB();

  const batchId = `BATCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  let importedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  try {
    // 1. Ensure unique categories exist
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
      // Check for exact duplicate within same batch or recent transactions to prevent duplicate import
      const isDuplicate = await Transaction.findOne({
        accountType,
        date: new Date(row.date),
        description: row.description,
        debit: row.debit,
        credit: row.credit,
        invoiceOrderId: row.invoiceOrderId || undefined,
      });

      if (isDuplicate) {
        skippedCount++;
        continue;
      }

      txDocs.push({
        accountType,
        date: new Date(row.date),
        description: row.description,
        category: row.category,
        debit: row.debit,
        credit: row.credit,
        paymentMode: row.paymentMode,
        bankOrCash: row.bankOrCash,
        partyName: row.partyName,
        invoiceOrderId: row.invoiceOrderId,
        gstApplicable: row.gstApplicable,
        gstAmount: row.gstAmount,
        tdsTcsAmount: row.tdsTcsAmount,
        remarks: row.remarks,
        billAvailable: row.billAvailable,
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
      totalRows: validRows.length + skippedCount,
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
  } catch (err: any) {
    console.error("[Excel Importer] Batch import failed:", err);
    errors.push(err.message || "Failed to save imported rows");
    return {
      success: false,
      batchId,
      importedCount,
      skippedCount,
      errors,
    };
  }
}
