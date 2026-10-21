import { connectDB } from "@/lib/db/connection";
import { Transaction, AccountType, TransactionOrigin } from "@/lib/models/Transaction";
import { ImportBatch } from "@/lib/models/ImportBatch";
import { Category } from "@/lib/models/Category";
import { ExcelAccountingRow, ExcelImportResult } from "./types";
import { parseIndianDate, getISTCalendarDate } from "@/lib/utils";
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
    // 1. Pre-validation: Check for duplicate transaction dates within the Excel file itself
    const seenImportDates = new Map<string, number>(); // dateStr -> rowNumber
    const internalDuplicates: { dateStr: string; displayDate: string; rows: number[] }[] = [];

    validRows.forEach((row, idx) => {
      const rowNum = row.excelRowNumber ?? (row.slNo ? Number(row.slNo) : idx + 1);
      const cal = getISTCalendarDate(row.date);
      if (!cal) return;

      if (seenImportDates.has(cal.dateStr)) {
        const firstRow = seenImportDates.get(cal.dateStr)!;
        const existing = internalDuplicates.find((d) => d.dateStr === cal.dateStr);
        if (existing) {
          existing.rows.push(rowNum);
        } else {
          internalDuplicates.push({
            dateStr: cal.dateStr,
            displayDate: cal.displayDate,
            rows: [firstRow, rowNum],
          });
        }
      } else {
        seenImportDates.set(cal.dateStr, rowNum);
      }
    });

    if (internalDuplicates.length > 0) {
      const details = internalDuplicates
        .map((d) => `${d.displayDate} (rows ${d.rows.join(", ")})`)
        .join("; ");
      const msg = `Import failed: The import file contains duplicate transaction dates: ${details}. Each transaction in the MAIN account must have a unique date.`;
      errors.push(msg);
      return {
        success: false,
        batchId,
        importedCount: 0,
        skippedCount: 0,
        errors,
      };
    }

    // 2. Pre-validation: Check transaction dates against existing database records in the MAIN account
    const importDateStrs = Array.from(seenImportDates.keys());
    if (importDateStrs.length > 0) {
      const dateIntervalQueries = importDateStrs.map((d) => {
        const [y, m, day] = d.split("-").map(Number);
        const start = new Date(Date.UTC(y, m - 1, day, 0, 0, 0) - 5.5 * 3600 * 1000);
        const end = new Date(Date.UTC(y, m - 1, day, 23, 59, 59, 999) - 5.5 * 3600 * 1000);
        return { date: { $gte: start, $lte: end } };
      });

      const existingInDb = await Transaction.find({
        accountType: "MAIN",
        isArchived: { $ne: true },
        $or: [
          { normalizedDate: { $in: importDateStrs } },
          ...dateIntervalQueries,
        ],
      }).lean();

      if (existingInDb.length > 0) {
        const dbDateMap = new Map<string, string>(); // dateStr -> displayDate
        for (const tx of existingInDb) {
          const cal = getISTCalendarDate(tx.date);
          if (cal) {
            dbDateMap.set(cal.dateStr, cal.displayDate);
          }
          if (tx.normalizedDate && !dbDateMap.has(tx.normalizedDate)) {
            dbDateMap.set(tx.normalizedDate, cal ? cal.displayDate : tx.normalizedDate);
          }
        }

        // Map which imported rows conflict
        const conflictingRowsMap = new Map<string, number[]>(); // displayDate -> rowNumbers[]
        validRows.forEach((row, idx) => {
          const rowNum = row.excelRowNumber ?? (row.slNo ? Number(row.slNo) : idx + 1);
          const cal = getISTCalendarDate(row.date);
          if (cal && dbDateMap.has(cal.dateStr)) {
            const disp = cal.displayDate;
            const current = conflictingRowsMap.get(disp) || [];
            current.push(rowNum);
            conflictingRowsMap.set(disp, current);
          }
        });

        const conflictingDates = Array.from(conflictingRowsMap.keys());
        let mainErrMsg = "";
        if (conflictingDates.length === 1) {
          const date = conflictingDates[0];
          const rows = conflictingRowsMap.get(date) || [];
          mainErrMsg = `Import failed: A transaction already exists for ${date}.`;
          if (rows.length > 0) {
            mainErrMsg += ` (Affects row ${rows.join(", ")})`;
          }
        } else {
          const details = conflictingDates
            .map((d) => `${d} (row ${conflictingRowsMap.get(d)?.join(", ")})`)
            .join(", ");
          mainErrMsg = `Import failed: Transactions already exist for the following dates: ${details}.`;
        }

        errors.push(mainErrMsg);
        return {
          success: false,
          batchId,
          importedCount: 0,
          skippedCount: 0,
          errors,
        };
      }
    }

    // 3. Ensure unique categories exist in DB (only executed after all validations pass)
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

    // 4. Identify earliest transaction date and resolve legitimate opening balance
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

    // 5. Prepare transaction documents with sequential balances and normalized dates
    const txDocs = [];
    for (const row of balancedRows) {
      const parsedDate = parseIndianDate(row.date) || new Date();
      const cal = getISTCalendarDate(parsedDate);
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
        normalizedDate: cal?.dateStr,
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

    // 6. Record the ImportBatch document
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
    let message = err instanceof Error ? err.message : "Failed to save imported rows";
    if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000) {
      message = "Import failed: A transaction already exists for one of the dates in this import.";
    }
    console.error("[Excel Importer] Batch import failed:", message);
    errors.push(message);
    return {
      success: false,
      batchId,
      importedCount: 0,
      skippedCount: 0,
      errors,
    };
  }
}
