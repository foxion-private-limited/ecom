import assert from "assert";
import mongoose from "mongoose";
import { Transaction } from "../lib/models/Transaction";
import {
  createTransaction,
  updateTransaction,
  checkTransactionDateConflict,
  getTransactions,
  getPreviousTransactionBalance,
  calculateImportBalances,
} from "../lib/services/transactionService";
import { importAccountingBatch } from "../lib/excel/excelImporter";
import { validateExcelRows } from "../lib/excel/excelValidator";
import { generateAccountingExcel } from "../lib/excel/excelExporter";
import { parseIndianDate, getISTCalendarDate } from "../lib/utils";
import { ExcelAccountingRow } from "../lib/excel/types";
import { connectDB } from "../lib/db/connection";
import { GET as checkDateGET } from "../app/api/transactions/check-date/route";
import { POST as validatePOST } from "../app/api/excel/validate/route";
import * as XLSX from "xlsx";

async function setup() {
  await connectDB();
  // Ensure any old unique index on date/normalizedDate in MongoDB is dropped if present
  try {
    const indexes = await Transaction.collection.indexes();
    for (const idx of indexes) {
      if (idx.name && idx.name.includes("normalizedDate") && idx.unique) {
        console.log(`Dropping legacy unique index: ${idx.name}`);
        await Transaction.collection.dropIndex(idx.name);
      }
    }
  } catch (err) {
    console.warn("Index check note:", err);
  }
}

async function teardown() {
  await mongoose.disconnect();
  const mem = (global as { mongooseCache?: { memoryServer?: { stop: () => Promise<boolean> } } }).mongooseCache?.memoryServer;
  if (mem && typeof mem.stop === "function") {
    await mem.stop();
  }
}

async function runAllTests() {
  console.log("🧪 Running Verification: Allow Duplicate Transaction Dates Suite...\n");

  await setup();

  try {
    // --------------------------------------------------------------------------
    // Scenario 1: Manually add two Debit transactions on the same date — both must succeed
    // --------------------------------------------------------------------------
    console.log("▶ Scenario 1: Manually add two Debit transactions on the same date — both must succeed");
    {
      await Transaction.deleteMany({});

      const sameDate = parseIndianDate("15/05/2026")!;

      const debit1 = await createTransaction({
        accountType: "MAIN",
        transactionOrigin: "COMPANY",
        date: sameDate,
        description: "Office Supplies",
        category: "Office",
        debit: 1500,
        credit: 0,
        paymentMode: "UPI",
        bankOrCash: "Bank",
        paymentSource: "Company Bank",
      });

      const debit2 = await createTransaction({
        accountType: "MAIN",
        transactionOrigin: "COMPANY",
        date: sameDate,
        description: "Printing Paper",
        category: "Printing",
        debit: 800,
        credit: 0,
        paymentMode: "UPI",
        bankOrCash: "Bank",
        paymentSource: "Company Bank",
      });

      assert.ok(debit1._id, "Debit 1 must have an _id");
      assert.ok(debit2._id, "Debit 2 must have an _id");
      assert.notStrictEqual(String(debit1._id), String(debit2._id));
      assert.strictEqual(debit1.normalizedDate, "2026-05-15");
      assert.strictEqual(debit2.normalizedDate, "2026-05-15");

      const count = await Transaction.countDocuments({ normalizedDate: "2026-05-15" });
      assert.strictEqual(count, 2, "Both Debit transactions on same date must exist in database");

      console.log("   ✅ Successfully added two Debit transactions on the exact same date (15/05/2026).");
    }

    // --------------------------------------------------------------------------
    // Scenario 2: Manually add Debit and Credit transactions on the same date — both must succeed
    // --------------------------------------------------------------------------
    console.log("\n▶ Scenario 2: Manually add Debit and Credit transactions on the same date — both must succeed");
    {
      const sameDate = parseIndianDate("20/06/2026")!;

      const creditTx = await createTransaction({
        accountType: "MAIN",
        transactionOrigin: "COMPANY",
        date: sameDate,
        description: "Client Payment Received",
        category: "Sales",
        debit: 0,
        credit: 25000,
        paymentMode: "Bank Transfer",
        bankOrCash: "Bank",
        paymentSource: "Company Bank",
      });

      const debitTx = await createTransaction({
        accountType: "MAIN",
        transactionOrigin: "COMPANY",
        date: sameDate,
        description: "Shipping Cost",
        category: "Logistics",
        debit: 2000,
        credit: 0,
        paymentMode: "UPI",
        bankOrCash: "Bank",
        paymentSource: "Company Bank",
      });

      assert.ok(creditTx._id);
      assert.ok(debitTx._id);
      assert.strictEqual(creditTx.normalizedDate, "2026-06-20");
      assert.strictEqual(debitTx.normalizedDate, "2026-06-20");

      const count = await Transaction.countDocuments({ normalizedDate: "2026-06-20" });
      assert.strictEqual(count, 2, "Both Credit and Debit transactions on same date must exist in database");

      // Verify updateTransaction also permits keeping or changing to same date as another transaction
      const updatedDebit = await updateTransaction(String(debitTx._id), {
        description: "Updated Shipping Cost",
        debit: 2500,
      });
      assert.strictEqual(updatedDebit?.debit, 2500);

      // Verify checkTransactionDateConflict reports false
      const conflictCheck = await checkTransactionDateConflict({
        date: sameDate,
        accountType: "MAIN",
      });
      assert.strictEqual(conflictCheck.exists, false, "checkTransactionDateConflict must report false");

      console.log("   ✅ Successfully added Debit and Credit transactions on the same date (20/06/2026) and updated without error.");
    }

    // --------------------------------------------------------------------------
    // Scenario 3: Import multiple rows with the same date — all valid rows must be accepted
    // --------------------------------------------------------------------------
    console.log("\n▶ Scenario 3: Import multiple rows with the same date — all valid rows must be accepted");
    {
      const rowsWithSameDate: Partial<ExcelAccountingRow>[] = [
        {
          slNo: 1,
          date: parseIndianDate("01/07/2026")!,
          description: "Batch Item 1",
          category: "Raw Material",
          debit: 5000,
          credit: 0,
          bankOrCash: "Bank",
          paymentSource: "Company Bank",
          paymentMode: "UPI",
          transactionOrigin: "COMPANY",
          __excelRowNumber: 2,
        },
        {
          slNo: 2,
          date: parseIndianDate("01/07/2026")!,
          description: "Batch Item 2",
          category: "Packaging",
          debit: 3000,
          credit: 0,
          bankOrCash: "Bank",
          paymentSource: "Company Bank",
          paymentMode: "UPI",
          transactionOrigin: "COMPANY",
          __excelRowNumber: 3,
        },
        {
          slNo: 3,
          date: parseIndianDate("01/07/2026")!,
          description: "Batch Item 3 (Sale)",
          category: "Sales",
          debit: 0,
          credit: 12000,
          bankOrCash: "Bank",
          paymentSource: "Company Bank",
          paymentMode: "UPI",
          transactionOrigin: "COMPANY",
          __excelRowNumber: 4,
        },
      ];

      // Test validateExcelRows
      const validationSummary = validateExcelRows(rowsWithSameDate, "import_test.xlsx");
      assert.strictEqual(validationSummary.validCount, 3, "All 3 rows on same date must be marked valid");
      assert.strictEqual(validationSummary.invalidRowCount, 0, "No rows marked invalid due to same date");
      assert.strictEqual(validationSummary.totalErrorsCount, 0, "No errors should be recorded");
      assert.strictEqual(validationSummary.rows.every((r) => r.isValid), true, "Every row must be marked valid");

      // Test importAccountingBatch
      const importResult = await importAccountingBatch(
        rowsWithSameDate as ExcelAccountingRow[],
        "MAIN",
        "import_test.xlsx",
        "admin@foxion.com",
        "COMPANY"
      );

      assert.strictEqual(importResult.success, true, "Import batch must succeed");
      assert.strictEqual(importResult.importedCount, 3, "All 3 rows must be imported");

      const dbRows = await Transaction.find({ normalizedDate: "2026-07-01" });
      assert.strictEqual(dbRows.length, 3, "Database must store all 3 imported rows on 2026-07-01");

      console.log("   ✅ Validated and imported 3 transactions sharing the exact same date (01/07/2026).");
    }

    // --------------------------------------------------------------------------
    // Scenario 4: Import a transaction whose date matches an existing transaction in DB — must be accepted
    // --------------------------------------------------------------------------
    console.log("\n▶ Scenario 4: Import a transaction whose date matches an existing transaction — it must be accepted");
    {
      // 01/07/2026 already has 3 transactions in DB from Scenario 3.
      // Now import another batch with 01/07/2026
      const matchingRow: Partial<ExcelAccountingRow>[] = [
        {
          slNo: 4,
          date: parseIndianDate("01/07/2026")!,
          description: "Subsequent Import Same Date",
          category: "Logistics",
          debit: 1500,
          credit: 0,
          bankOrCash: "Bank",
          paymentSource: "Company Bank",
          paymentMode: "UPI",
          transactionOrigin: "COMPANY",
          __excelRowNumber: 2,
        },
      ];

      const importResult = await importAccountingBatch(
        matchingRow as ExcelAccountingRow[],
        "MAIN",
        "second_import.xlsx",
        "admin@foxion.com",
        "COMPANY"
      );

      assert.strictEqual(importResult.success, true, "Importing row with date existing in DB must succeed");
      assert.strictEqual(importResult.importedCount, 1);

      const dbRows = await Transaction.find({ normalizedDate: "2026-07-01" });
      assert.strictEqual(dbRows.length, 4, "Total of 4 transactions on 2026-07-01 must now exist in DB");

      console.log("   ✅ Successfully imported transaction with date (01/07/2026) already present in DB.");
    }

    // --------------------------------------------------------------------------
    // Scenario 5: Invalid dates and other invalid transaction data must still be rejected
    // --------------------------------------------------------------------------
    console.log("\n▶ Scenario 5: Invalid dates and other invalid transaction data must still be rejected");
    {
      // 5a. Invalid date format
      const invalidDateRows: Partial<ExcelAccountingRow>[] = [
        {
          slNo: 1,
          date: "not-a-valid-date" as unknown as Date,
          description: "Invalid Date Row",
          category: "Misc",
          debit: 100,
          credit: 0,
          __rawValues: { date: "not-a-valid-date" },
        },
      ];
      const resDate = validateExcelRows(invalidDateRows, "test.xlsx");
      assert.strictEqual(resDate.rows[0].isValid, false, "Invalid date format must be rejected");
      assert.strictEqual(resDate.invalidRowCount, 1, "Must have 1 invalid row");
      assert.ok(resDate.allErrors.some((e) => e.code === "INVALID_DATE"), "Must report INVALID_DATE error");

      // 5b. Missing description
      const missingDescRows: Partial<ExcelAccountingRow>[] = [
        {
          slNo: 2,
          date: parseIndianDate("10/08/2026")!,
          description: "",
          category: "Misc",
          debit: 100,
          credit: 0,
          __rawValues: { description: "" },
        },
      ];
      const resDesc = validateExcelRows(missingDescRows, "test.xlsx");
      assert.strictEqual(resDesc.rows[0].isValid, false, "Missing description must be rejected");
      assert.strictEqual(resDesc.invalidRowCount, 1);
      assert.ok(resDesc.allErrors.some((e) => e.code === "MISSING_REQUIRED_FIELD" && e.field === "description"));

      // 5c. Missing category
      const missingCatRows: Partial<ExcelAccountingRow>[] = [
        {
          slNo: 3,
          date: parseIndianDate("10/08/2026")!,
          description: "Valid Desc",
          category: "",
          debit: 100,
          credit: 0,
          __rawValues: { category: "" },
        },
      ];
      const resCat = validateExcelRows(missingCatRows, "test.xlsx");
      assert.strictEqual(resCat.rows[0].isValid, false, "Missing category must be rejected");
      assert.strictEqual(resCat.invalidRowCount, 1);
      assert.ok(resCat.allErrors.some((e) => e.code === "MISSING_REQUIRED_FIELD" && e.field === "category"));

      // 5d. Both debit and credit 0
      const zeroAmountRows: Partial<ExcelAccountingRow>[] = [
        {
          slNo: 4,
          date: parseIndianDate("10/08/2026")!,
          description: "Valid Desc",
          category: "Misc",
          debit: 0,
          credit: 0,
          __rawValues: { debit: 0, credit: 0 },
        },
      ];
      const resZero = validateExcelRows(zeroAmountRows, "test.xlsx");
      assert.strictEqual(resZero.rows[0].isValid, false, "Both debit and credit 0 must be rejected");
      assert.strictEqual(resZero.invalidRowCount, 1);
      assert.ok(resZero.allErrors.some((e) => e.code === "ZERO_AMOUNT" || e.field === "amount"));

      // 5e. Negative amount
      const negAmountRows: Partial<ExcelAccountingRow>[] = [
        {
          slNo: 5,
          date: parseIndianDate("10/08/2026")!,
          description: "Valid Desc",
          category: "Misc",
          debit: -500,
          credit: 0,
          __rawValues: { debit: -500, credit: 0 },
        },
      ];
      const resNeg = validateExcelRows(negAmountRows, "test.xlsx");
      assert.strictEqual(resNeg.rows[0].isValid, false, "Negative debit amount must be rejected");
      assert.strictEqual(resNeg.invalidRowCount, 1);
      assert.ok(resNeg.allErrors.some((e) => e.code === "NEGATIVE_AMOUNT"));

      console.log("   ✅ All required field, invalid date, negative amount, and zero amount validations are preserved.");
    }

    // --------------------------------------------------------------------------
    // Scenario 6: Verify balances, account separation, imports, exports, and transaction ordering
    // --------------------------------------------------------------------------
    console.log("\n▶ Scenario 6: Verify balances, account separation, imports, exports, and transaction ordering");
    {
      await Transaction.deleteMany({});

      // Create an opening balance in MAIN account
      const txCompany1 = await createTransaction({
        accountType: "MAIN",
        transactionOrigin: "COMPANY",
        date: parseIndianDate("01/09/2026")!,
        description: "Initial Company Capital",
        category: "Capital",
        debit: 0,
        credit: 100000,
        paymentMode: "Bank Transfer",
        bankOrCash: "Bank",
        paymentSource: "Company Bank",
      });

      // Add two transactions on 02/09/2026 in MAIN (COMPANY)
      const txCompany2 = await createTransaction({
        accountType: "MAIN",
        transactionOrigin: "COMPANY",
        date: parseIndianDate("02/09/2026")!,
        description: "Raw Material A",
        category: "Material",
        debit: 30000,
        credit: 0,
        paymentMode: "UPI",
        bankOrCash: "Bank",
        paymentSource: "Company Bank",
      });

      const txCompany3 = await createTransaction({
        accountType: "MAIN",
        transactionOrigin: "COMPANY",
        date: parseIndianDate("02/09/2026")!,
        description: "Sales Revenue",
        category: "Sales",
        debit: 0,
        credit: 50000,
        paymentMode: "Bank Transfer",
        bankOrCash: "Bank",
        paymentSource: "Company Bank",
      });

      // Add transaction in PRE_COMPANY origin
      const txPreCompany = await createTransaction({
        accountType: "MAIN",
        transactionOrigin: "PRE_COMPANY",
        date: parseIndianDate("02/09/2026")!,
        description: "Pre-incorporation founder expense",
        category: "Setup",
        debit: 5000,
        credit: 0,
        paymentMode: "Cash",
        bankOrCash: "Personal Cash",
        paymentSource: "Personal Cash",
      });

      // 6a. Check account separation
      const companyTxs = await getTransactions({ transactionOrigin: "COMPANY", unpaginated: true });
      const preCompanyTxs = await getTransactions({ transactionOrigin: "PRE_COMPANY", unpaginated: true });

      assert.strictEqual(companyTxs.pagination.total, 3, "COMPANY transactions count must be 3");
      assert.strictEqual(preCompanyTxs.pagination.total, 1, "PRE_COMPANY transactions count must be 1");
      assert.strictEqual(preCompanyTxs.transactions[0].description, "Pre-incorporation founder expense");

      // 6b. Verify deterministic ordering: sort by date asc, createdAt asc, _id asc
      // Balance = Previous + Credit - Debit
      // 01/09: 0 + 100,000 = 100,000
      // 02/09 Tx2: 100,000 - 30,000 = 70,000
      // 02/09 Tx3: 70,000 + 50,000 = 120,000
      assert.strictEqual(companyTxs.transactions[0].calculatedBalance, 100000);
      assert.strictEqual(companyTxs.transactions[1].calculatedBalance, 70000);
      assert.strictEqual(companyTxs.transactions[2].calculatedBalance, 120000);

      // 6c. Verify calculateImportBalances on same date rows
      const importRows: { date: string; debit: number; credit: number; slNo: number; excelRowNumber: number; balance?: number }[] = [
        { date: "05/09/2026", debit: 1000, credit: 0, slNo: 1, excelRowNumber: 2 },
        { date: "05/09/2026", debit: 0, credit: 4000, slNo: 2, excelRowNumber: 3 },
      ];
      const calculated = calculateImportBalances(importRows, 120000);
      // Row 1: 120,000 - 1000 = 119,000
      // Row 2: 119,000 + 4000 = 123,000
      assert.strictEqual(calculated[0].balance, 119000);
      assert.strictEqual(calculated[1].balance, 123000);

      // 6d. Verify export generation works with duplicate dates
      const exportItems = companyTxs.transactions.map((tx, idx) => ({
        slNo: idx + 1,
        date: tx.date,
        description: tx.description,
        category: tx.category,
        debit: tx.debit,
        credit: tx.credit,
        balance: tx.calculatedBalance,
        paymentMode: tx.paymentMode,
        bankOrCash: tx.bankOrCash,
        paymentSource: tx.paymentSource,
        transactionOrigin: tx.transactionOrigin,
        partyName: tx.partyName,
        paidBy: tx.paidBy,
        invoiceOrderId: tx.invoiceOrderId,
        gstApplicable: tx.gstApplicable,
        gstAmount: tx.gstAmount,
        tdsTcsAmount: tx.tdsTcsAmount,
        remarks: tx.remarks,
        billAvailable: tx.billAvailable,
        createdAt: tx.createdAt,
        _id: String(tx._id),
      }));

      const excelBuf = generateAccountingExcel(exportItems, "Foxion Ledger");
      assert.ok(excelBuf.length > 0, "Generated Excel buffer must not be empty");

      // Parse generated buffer to ensure it is valid
      const parsedWorkbook = XLSX.read(excelBuf, { type: "buffer" });
      assert.ok(parsedWorkbook.SheetNames.length > 0, "Workbook must have sheets");

      console.log("   ✅ Verified account separation (COMPANY vs PRE_COMPANY), running balances, deterministic sorting, and Excel export.");
    }

    console.log("\n🎉 ALL 6 SCENARIOS PASSED SUCCESSFULLY!");
  } finally {
    await teardown();
  }
}

runAllTests().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
