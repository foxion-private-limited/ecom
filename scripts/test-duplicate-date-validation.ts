import assert from "assert";
import mongoose from "mongoose";
import { Transaction } from "../lib/models/Transaction";
import {
  createTransaction,
  updateTransaction,
  checkTransactionDateConflict,
  getTransactions,
} from "../lib/services/transactionService";
import { importAccountingBatch } from "../lib/excel/excelImporter";
import { validateExcelRows } from "../lib/excel/excelValidator";
import { parseIndianDate, getISTCalendarDate } from "../lib/utils";
import { ExcelAccountingRow } from "../lib/excel/types";
import { connectDB } from "../lib/db/connection";
import { GET as checkDateGET, POST as checkDatePOST } from "../app/api/transactions/check-date/route";

async function setup() {
  await connectDB();
}

async function teardown() {
  await mongoose.disconnect();
  const mem = (global as { mongooseCache?: { memoryServer?: { stop: () => Promise<boolean> } } }).mongooseCache?.memoryServer;
  if (mem && typeof mem.stop === "function") {
    await mem.stop();
  }
}

async function runAllTests() {
  console.log("🧪 Starting Foxion Duplicate Date Validation Test Suite...\n");

  await setup();

  try {
    // --------------------------------------------------------------------------
    // Test 1: Adding a transaction on an unused date succeeds
    // --------------------------------------------------------------------------
    console.log("▶ Test 1: Adding a transaction on an unused date succeeds");
    {
      await Transaction.deleteMany({});

      const tx = await createTransaction({
        accountType: "MAIN",
        transactionOrigin: "COMPANY",
        date: parseIndianDate("10/08/2026")!,
        description: "Initial Deposit",
        category: "Capital",
        debit: 0,
        credit: 50000,
        paymentMode: "Bank Transfer",
        bankOrCash: "Bank",
      });

      assert.ok(tx._id, "Transaction should be created with an _id");
      assert.strictEqual(tx.normalizedDate, "2026-08-10");
      console.log("   ✅ Transaction created successfully on unused date 10/08/2026.");
    }

    // --------------------------------------------------------------------------
    // Test 2: Adding a transaction on an occupied date displays error and does not save
    // --------------------------------------------------------------------------
    console.log("\n▶ Test 2: Adding a transaction on an occupied date is rejected and not saved");
    {
      const initialCount = await Transaction.countDocuments({ isArchived: { $ne: true } });

      let thrownError: Error | null = null;
      try {
        await createTransaction({
          accountType: "MAIN",
          transactionOrigin: "COMPANY",
          date: parseIndianDate("10/08/2026")!,
          description: "Conflicting Transaction",
          category: "Sales",
          debit: 0,
          credit: 1000,
          paymentMode: "UPI",
          bankOrCash: "Bank",
        });
      } catch (err: unknown) {
        thrownError = err as Error;
      }

      assert.ok(thrownError, "Should throw an error when adding duplicate date");
      assert.ok(
        thrownError.message.includes("A transaction already exists for this date. Please select another date."),
        `Expected error message, got: ${thrownError.message}`
      );

      const finalCount = await Transaction.countDocuments({ isArchived: { $ne: true } });
      assert.strictEqual(finalCount, initialCount, "Transaction count must not change after rejected insert");
      console.log("   ✅ Duplicate date correctly rejected with exact required message.");
    }

    // --------------------------------------------------------------------------
    // Test 3: Changing the date to an unused date clears the error and saves
    // --------------------------------------------------------------------------
    console.log("\n▶ Test 3: Changing the date to an unused date succeeds");
    {
      const tx = await createTransaction({
        accountType: "MAIN",
        transactionOrigin: "COMPANY",
        date: parseIndianDate("11/08/2026")!,
        description: "Next Day Transaction",
        category: "Purchases",
        debit: 5000,
        credit: 0,
        paymentMode: "Bank Transfer",
        bankOrCash: "Bank",
      });

      assert.ok(tx._id);
      assert.strictEqual(tx.normalizedDate, "2026-08-11");
      console.log("   ✅ Transaction on 11/08/2026 created successfully.");
    }

    // --------------------------------------------------------------------------
    // Test 4: Editing a transaction without changing its date works (not duplicate of itself)
    // --------------------------------------------------------------------------
    console.log("\n▶ Test 4: Editing a transaction without changing its date works (not duplicate of itself)");
    {
      const existing = await Transaction.findOne({ normalizedDate: "2026-08-10" });
      assert.ok(existing);

      const updated = await updateTransaction(String(existing._id), {
        description: "Updated Description for Initial Deposit",
        credit: 55000,
        date: existing.date,
      });

      assert.ok(updated);
      assert.strictEqual(updated.description, "Updated Description for Initial Deposit");
      assert.strictEqual(updated.credit, 55000);
      assert.strictEqual(updated.normalizedDate, "2026-08-10");
      console.log("   ✅ Existing transaction successfully updated while retaining its date.");
    }

    // --------------------------------------------------------------------------
    // Test 5: Editing a transaction to another transaction's date is rejected
    // --------------------------------------------------------------------------
    console.log("\n▶ Test 5: Editing a transaction to another transaction's date is rejected");
    {
      const txOn11th = await Transaction.findOne({ normalizedDate: "2026-08-11" });
      assert.ok(txOn11th);

      let editError: Error | null = null;
      try {
        await updateTransaction(String(txOn11th._id), {
          date: parseIndianDate("10/08/2026")!, // date occupied by another transaction
          description: "Attempted collision",
        });
      } catch (err: unknown) {
        editError = err as Error;
      }

      assert.ok(editError, "Should throw error when changing date to occupied date");
      assert.ok(
        editError.message.includes("A transaction already exists for this date. Please select another date."),
        `Expected error message, got: ${editError.message}`
      );

      // Verify the record was NOT changed in DB
      const refreshed = await Transaction.findById(txOn11th._id);
      assert.strictEqual(refreshed?.normalizedDate, "2026-08-11");
      console.log("   ✅ Editing to occupied date rejected, record unchanged.");
    }

    // --------------------------------------------------------------------------
    // Test 6: check-date API route returns correct validation response
    // --------------------------------------------------------------------------
    console.log("\n▶ Test 6: check-date API endpoint responds correctly for occupied and unused dates");
    {
      // Check occupied date
      const reqOccupied = new Request("http://localhost:3000/api/transactions/check-date?date=2026-08-10&accountType=MAIN");
      const resOccupied = await checkDateGET(reqOccupied);
      const dataOccupied = await resOccupied.json();
      assert.strictEqual(dataOccupied.exists, true);
      assert.strictEqual(dataOccupied.message, "A transaction already exists for this date. Please select another date.");

      // Check occupied date with excludeId of the transaction itself
      const existing = await Transaction.findOne({ normalizedDate: "2026-08-10" });
      const reqSelf = new Request(`http://localhost:3000/api/transactions/check-date?date=2026-08-10&accountType=MAIN&excludeId=${existing!._id}`);
      const resSelf = await checkDateGET(reqSelf);
      const dataSelf = await resSelf.json();
      assert.strictEqual(dataSelf.exists, false, "Self-exclusion must report exists: false");

      // Check unused date
      const reqUnused = new Request("http://localhost:3000/api/transactions/check-date?date=2026-08-20&accountType=MAIN");
      const resUnused = await checkDateGET(reqUnused);
      const dataUnused = await resUnused.json();
      assert.strictEqual(dataUnused.exists, false);
      assert.strictEqual(dataUnused.message, undefined);

      // Verify POST endpoint
      const reqPost = new Request("http://localhost:3000/api/transactions/check-date", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: "2026-08-10", accountType: "MAIN" }),
      });
      const resPost = await checkDatePOST(reqPost);
      const dataPost = await resPost.json();
      assert.strictEqual(dataPost.exists, true);

      // Direct service check
      const directCheck = await checkTransactionDateConflict({
        date: "10/08/2026",
        accountType: "MAIN",
      });
      assert.strictEqual(directCheck.exists, true);
      assert.strictEqual(directCheck.conflictingDate, "10/08/2026");

      console.log("   ✅ check-date GET & POST API endpoints and service verified.");
    }

    // --------------------------------------------------------------------------
    // Test 7: Excel file with duplicate dates within the file is rejected
    // --------------------------------------------------------------------------
    console.log("\n▶ Test 7: Importing an Excel file with duplicate dates within the file is rejected");
    {
      const rowsWithInternalDuplicates: ExcelAccountingRow[] = [
        {
          slNo: 1,
          excelRowNumber: 2,
          date: "15/08/2026",
          description: "Independence Day promo",
          category: "Advertising",
          debit: 2000,
          credit: 0,
          paymentMode: "Bank Transfer",
          bankOrCash: "Bank",
          gstApplicable: false,
          gstAmount: 0,
          tdsTcsAmount: 0,
          billAvailable: false,
        },
        {
          slNo: 2,
          excelRowNumber: 3,
          date: "15/08/2026", // Same date!
          description: "Independence Day banner",
          category: "Advertising",
          debit: 1000,
          credit: 0,
          paymentMode: "Bank Transfer",
          bankOrCash: "Bank",
          gstApplicable: false,
          gstAmount: 0,
          tdsTcsAmount: 0,
          billAvailable: false,
        },
      ];

      // 1. In validator:
      const validation = validateExcelRows(rowsWithInternalDuplicates, "test.xlsx");
      assert.strictEqual(validation.invalidRowCount, 1);
      const dupErr = validation.allErrors.find((e) => e.code === "DUPLICATE_DATE_IN_FILE");
      assert.ok(dupErr, "Validator must flag DUPLICATE_DATE_IN_FILE");

      // 2. In importer:
      const beforeCount = await Transaction.countDocuments({ isArchived: { $ne: true } });
      const result = await importAccountingBatch(rowsWithInternalDuplicates, "MAIN", "test.xlsx");
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.importedCount, 0);
      assert.ok(result.errors[0].includes("contains duplicate transaction dates"));

      const afterCount = await Transaction.countDocuments({ isArchived: { $ne: true } });
      assert.strictEqual(afterCount, beforeCount, "No partial writes when file has internal duplicate dates");
      console.log("   ✅ Excel import with internal duplicate dates rejected atomically without writes.");
    }

    // --------------------------------------------------------------------------
    // Test 8: Importing an Excel file containing an existing DB transaction date is rejected
    // --------------------------------------------------------------------------
    console.log("\n▶ Test 8: Importing an Excel file with a date existing in DB is rejected without partial writes");
    {
      // 10/08/2026 already exists in DB from Test 1
      const importRows: ExcelAccountingRow[] = [
        {
          slNo: 1,
          excelRowNumber: 2,
          date: "12/08/2026",
          description: "New transaction",
          category: "General",
          debit: 500,
          credit: 0,
          paymentMode: "Bank Transfer",
          bankOrCash: "Bank",
          gstApplicable: false,
          gstAmount: 0,
          tdsTcsAmount: 0,
          billAvailable: false,
        },
        {
          slNo: 2,
          excelRowNumber: 3,
          date: "10/08/2026", // ALREADY IN DB!
          description: "Duplicate of existing DB date",
          category: "General",
          debit: 0,
          credit: 2000,
          paymentMode: "Bank Transfer",
          bankOrCash: "Bank",
          gstApplicable: false,
          gstAmount: 0,
          tdsTcsAmount: 0,
          billAvailable: false,
        },
      ];

      const beforeCount = await Transaction.countDocuments({ isArchived: { $ne: true } });
      const beforeBalances = await getTransactions({ accountType: "MAIN" });

      const result = await importAccountingBatch(importRows, "MAIN", "test_db_conflict.xlsx");
      assert.strictEqual(result.success, false, "Import must fail when date exists in DB");
      assert.strictEqual(result.importedCount, 0, "Imported count must be 0");
      assert.ok(
        result.errors[0].includes("Import failed: A transaction already exists for 10/08/2026."),
        `Expected error message matching prompt, got: ${result.errors[0]}`
      );

      const afterCount = await Transaction.countDocuments({ isArchived: { $ne: true } });
      assert.strictEqual(afterCount, beforeCount, "Database must not have any partial writes");

      const afterBalances = await getTransactions({ accountType: "MAIN" });
      assert.strictEqual(
        afterBalances.summary.netBalance,
        beforeBalances.summary.netBalance,
        "Account balance must remain unchanged after rejected import"
      );

      console.log("   ✅ Excel import with DB conflict rejected with exact required message and zero writes.");
    }

    // --------------------------------------------------------------------------
    // Test 9: Date comparison across IST and UTC timezone boundaries
    // --------------------------------------------------------------------------
    console.log("\n▶ Test 9: Date comparisons work correctly across IST and UTC storage boundaries");
    {
      // In IST (UTC+5:30), 2026-08-15 00:00:00 IST is 2026-08-14 18:30:00 UTC
      // And 2026-08-15 23:59:59 IST is 2026-08-15 18:29:59 UTC
      const earlyMorningIST = new Date("2026-08-14T18:35:00.000Z"); // 00:05:00 IST on Aug 15
      const lateNightIST = new Date("2026-08-15T18:25:00.000Z"); // 23:55:00 IST on Aug 15

      const cal1 = getISTCalendarDate(earlyMorningIST);
      const cal2 = getISTCalendarDate(lateNightIST);

      assert.ok(cal1 && cal2);
      assert.strictEqual(cal1.dateStr, "2026-08-15");
      assert.strictEqual(cal2.dateStr, "2026-08-15");
      assert.strictEqual(cal1.displayDate, "15/08/2026");
      assert.strictEqual(cal2.displayDate, "15/08/2026");

      // Save a transaction using early morning IST
      await createTransaction({
        accountType: "MAIN",
        transactionOrigin: "COMPANY",
        date: earlyMorningIST,
        description: "Early morning IST tx",
        category: "General",
        debit: 100,
        credit: 0,
        paymentMode: "UPI",
        bankOrCash: "Bank",
      });

      // Try creating another transaction with late night IST on the same calendar day
      let tzError: Error | null = null;
      try {
        await createTransaction({
          accountType: "MAIN",
          transactionOrigin: "COMPANY",
          date: lateNightIST,
          description: "Late night IST tx",
          category: "General",
          debit: 200,
          credit: 0,
          paymentMode: "UPI",
          bankOrCash: "Bank",
          gstApplicable: false,
          gstAmount: 0,
          tdsTcsAmount: 0,
          billAvailable: false,
        });
      } catch (err: unknown) {
        tzError = err as Error;
      }

      assert.ok(tzError, "Should detect duplicate date across timezone boundaries on same IST calendar day");
      assert.ok(tzError.message.includes("A transaction already exists for this date. Please select another date."));
      console.log("   ✅ Timezone normalization correctly treats early and late IST timestamps as same day.");
    }

    // --------------------------------------------------------------------------
    // Test 10: Successful Excel import on valid, distinct, unused dates succeeds completely
    // --------------------------------------------------------------------------
    console.log("\n▶ Test 10: Successful Excel import on unused distinct dates succeeds completely");
    {
      const validBatch: ExcelAccountingRow[] = [
        {
          slNo: 1,
          excelRowNumber: 2,
          date: "01/09/2026",
          description: "September Rent",
          category: "Rent",
          debit: 15000,
          credit: 0,
          paymentMode: "Bank Transfer",
          bankOrCash: "Bank",
          gstApplicable: false,
          gstAmount: 0,
          tdsTcsAmount: 0,
          billAvailable: false,
        },
        {
          slNo: 2,
          excelRowNumber: 3,
          date: "02/09/2026",
          description: "September Client Retainer",
          category: "Sales",
          debit: 0,
          credit: 40000,
          paymentMode: "Bank Transfer",
          bankOrCash: "Bank",
          gstApplicable: false,
          gstAmount: 0,
          tdsTcsAmount: 0,
          billAvailable: false,
        },
      ];

      const result = await importAccountingBatch(validBatch, "MAIN", "september.xlsx");
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.importedCount, 2);
      assert.strictEqual(result.errors.length, 0);

      const rentTx = await Transaction.findOne({ normalizedDate: "2026-09-01" });
      const retainerTx = await Transaction.findOne({ normalizedDate: "2026-09-02" });
      assert.ok(rentTx && retainerTx);
      assert.strictEqual(rentTx.normalizedDate, "2026-09-01");
      assert.strictEqual(retainerTx.normalizedDate, "2026-09-02");

      console.log("   ✅ Valid import batch saved all records with normalized dates and correct balances.");
    }

    console.log("\n🎉 ALL 10 DUPLICATE DATE VALIDATION TESTS PASSED WITH 100% SUCCESS!");
  } finally {
    await teardown();
  }
}

runAllTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
