import assert from "assert";
import mongoose from "mongoose";
import * as XLSX from "xlsx";
import { Transaction } from "../lib/models/Transaction";
import {
  getTransactions,
  getPreviousTransactionBalance,
  calculateImportBalances,
} from "../lib/services/transactionService";
import { importAccountingBatch } from "../lib/excel/excelImporter";
import {
  generateAccountingExcel,
  TransactionExportItem,
  getAccountingExportFilename,
} from "../lib/excel/excelExporter";
import { GET as exportRouteGET } from "../app/api/excel/export/route";
import { parseIndianDate, formatIndianDate } from "../lib/utils";
import { ExcelAccountingRow } from "../lib/excel/types";

import { connectDB } from "../lib/db/connection";

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
  console.log("🧪 Starting Comprehensive Excel Import & Export Balance Mismatch Test Suite...\n");

  await setup();

  try {
    // --------------------------------------------------------------------------
    // Test 1: Importing transactions when earlier account transactions already exist
    // --------------------------------------------------------------------------
    console.log("▶ Test 1: Importing transactions when earlier account transactions exist");
    {
      await Transaction.deleteMany({});

      // Seed 3 historical transactions as given in prompt
      // 01/01/2026: Opening transaction, Credit ₹10,000, Debit ₹0, Balance ₹10,000
      // 05/01/2026: Purchase, Credit ₹0, Debit ₹2,000, Balance ₹8,000
      // 10/01/2026: Payment received, Credit ₹5,000, Debit ₹0, Balance ₹13,000
      await Transaction.insertMany([
        {
          accountType: "MAIN",
          transactionOrigin: "COMPANY",
          date: parseIndianDate("01/01/2026")!,
          description: "Opening transaction",
          category: "General",
          debit: 0,
          credit: 10000,
          paymentMode: "Bank Transfer",
          bankOrCash: "Bank",
          paymentSource: "Company Bank",
        },
        {
          accountType: "MAIN",
          transactionOrigin: "COMPANY",
          date: parseIndianDate("05/01/2026")!,
          description: "Purchase",
          category: "Purchases",
          debit: 2000,
          credit: 0,
          paymentMode: "Bank Transfer",
          bankOrCash: "Bank",
          paymentSource: "Company Bank",
        },
        {
          accountType: "MAIN",
          transactionOrigin: "COMPANY",
          date: parseIndianDate("10/01/2026")!,
          description: "Payment received",
          category: "Sales",
          debit: 0,
          credit: 5000,
          paymentMode: "UPI",
          bankOrCash: "Bank",
          paymentSource: "Company Bank",
        },
      ]);

      // Excel transactions to import
      // 15/01/2026: Expense ₹3,000
      // 20/01/2026: Payment ₹2,000
      // 25/01/2026: Expense ₹1,000
      const importRows: ExcelAccountingRow[] = [
        {
          slNo: 1,
          date: "15/01/2026",
          description: "Expense",
          category: "Office Expenses",
          debit: 3000,
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
          date: "20/01/2026",
          description: "Payment",
          category: "Sales",
          debit: 0,
          credit: 2000,
          paymentMode: "UPI",
          bankOrCash: "Bank",
          gstApplicable: false,
          gstAmount: 0,
          tdsTcsAmount: 0,
          billAvailable: false,
        },
        {
          slNo: 3,
          date: "25/01/2026",
          description: "Expense",
          category: "Office Expenses",
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

      const earliestDate = parseIndianDate("15/01/2026")!;
      const openingBal = await getPreviousTransactionBalance(earliestDate, "MAIN", "COMPANY");
      assert.strictEqual(
        openingBal,
        13000,
        `Expected opening balance of ₹13,000 before 15/01/2026, got ${openingBal}`
      );

      const balancedRows = calculateImportBalances(importRows, openingBal);
      assert.strictEqual(balancedRows[0].balance, 10000, `Expected Row 1 balance ₹10,000, got ${balancedRows[0].balance}`);
      assert.strictEqual(balancedRows[1].balance, 12000, `Expected Row 2 balance ₹12,000, got ${balancedRows[1].balance}`);
      assert.strictEqual(balancedRows[2].balance, 11000, `Expected Row 3 balance ₹11,000, got ${balancedRows[2].balance}`);

      // Perform import batch
      const importResult = await importAccountingBatch(importRows, "MAIN", "test.xlsx", "test@foxion.in", "COMPANY");
      assert.strictEqual(importResult.success, true, "Import batch should succeed");
      assert.strictEqual(importResult.importedCount, 3, "Should import 3 transactions");

      // Verify the full ledger view calculation
      const ledgerResult = await getTransactions({ accountType: "MAIN", transactionOrigin: "COMPANY", unpaginated: true });
      assert.strictEqual(ledgerResult.transactions.length, 6, "Expected 6 transactions in ledger");

      const tx15 = ledgerResult.transactions.find((t) => formatIndianDate(t.date) === "15/01/2026");
      const tx20 = ledgerResult.transactions.find((t) => formatIndianDate(t.date) === "20/01/2026");
      const tx25 = ledgerResult.transactions.find((t) => formatIndianDate(t.date) === "25/01/2026");

      assert.strictEqual(tx15?.calculatedBalance, 10000, `Ledger tx 15/01/2026 balance must be 10,000, got ${tx15?.calculatedBalance}`);
      assert.strictEqual(tx20?.calculatedBalance, 12000, `Ledger tx 20/01/2026 balance must be 12,000, got ${tx20?.calculatedBalance}`);
      assert.strictEqual(tx25?.calculatedBalance, 11000, `Ledger tx 25/01/2026 balance must be 11,000, got ${tx25?.calculatedBalance}`);

      console.log("   ✅ Imported transactions correctly used ₹13,000 previous balance (10k, 12k, 11k verified).");
    }

    // --------------------------------------------------------------------------
    // Test 2: Importing transactions when previous balance is non-zero
    // --------------------------------------------------------------------------
    console.log("\n▶ Test 2: Importing transactions when previous balance is non-zero");
    {
      const earliestDate = parseIndianDate("15/01/2026")!;
      const openingBal = await getPreviousTransactionBalance(earliestDate, "MAIN", "COMPANY");
      assert.strictEqual(openingBal, 13000, `Previous balance must be strictly non-zero (13000), got ${openingBal}`);
      assert(openingBal > 0, "Previous balance must be strictly positive");
      console.log("   ✅ Non-zero previous balance verified.");
    }

    // --------------------------------------------------------------------------
    // Test 3: Importing transactions when account contains future-dated transactions
    // --------------------------------------------------------------------------
    console.log("\n▶ Test 3: Importing transactions when account contains future-dated transactions");
    {
      // Add future transaction dated 30/01/2026 and 05/02/2026
      await Transaction.insertMany([
        {
          accountType: "MAIN",
          transactionOrigin: "COMPANY",
          date: parseIndianDate("30/01/2026")!,
          description: "Future Payment Inward",
          category: "Sales",
          debit: 0,
          credit: 50000,
          paymentMode: "Bank Transfer",
          bankOrCash: "Bank",
        },
        {
          accountType: "MAIN",
          transactionOrigin: "COMPANY",
          date: parseIndianDate("05/02/2026")!,
          description: "Future Advance",
          category: "Sales",
          debit: 0,
          credit: 25000,
          paymentMode: "Bank Transfer",
          bankOrCash: "Bank",
        },
      ]);

      // Query opening balance for an import dated 15/01/2026
      const earliestDate = parseIndianDate("15/01/2026")!;
      const openingBal = await getPreviousTransactionBalance(earliestDate, "MAIN", "COMPANY");

      // Must STILL be 13,000! Future transactions on 30/01 and 05/02 MUST NOT influence it!
      assert.strictEqual(
        openingBal,
        13000,
        `Future transactions must NOT affect opening balance. Expected ₹13,000, got ${openingBal}`
      );
      console.log("   ✅ Critical date rule verified: future-dated transactions have zero effect on opening balance.");
    }

    // --------------------------------------------------------------------------
    // Test 4: Importing transactions spanning multiple dates out of order
    // --------------------------------------------------------------------------
    console.log("\n▶ Test 4: Importing transactions spanning multiple dates");
    {
      const unOrderedRows: ExcelAccountingRow[] = [
        {
          slNo: 1,
          date: "25/01/2026",
          description: "Expense Jan 25",
          category: "Office Expenses",
          debit: 1000,
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
          date: "15/01/2026",
          description: "Expense Jan 15",
          category: "Office Expenses",
          debit: 3000,
          credit: 0,
          paymentMode: "Bank Transfer",
          bankOrCash: "Bank",
          gstApplicable: false,
          gstAmount: 0,
          tdsTcsAmount: 0,
          billAvailable: false,
        },
        {
          slNo: 3,
          date: "20/01/2026",
          description: "Payment Jan 20",
          category: "Sales",
          debit: 0,
          credit: 2000,
          paymentMode: "UPI",
          bankOrCash: "Bank",
          gstApplicable: false,
          gstAmount: 0,
          tdsTcsAmount: 0,
          billAvailable: false,
        },
      ];

      // Calculate balances with opening balance 13000
      const sortedResult = calculateImportBalances(unOrderedRows, 13000);

      // Verify sorted chronologically
      assert.strictEqual(sortedResult[0].date, "15/01/2026");
      assert.strictEqual(sortedResult[0].balance, 10000);

      assert.strictEqual(sortedResult[1].date, "20/01/2026");
      assert.strictEqual(sortedResult[1].balance, 12000);

      assert.strictEqual(sortedResult[2].date, "25/01/2026");
      assert.strictEqual(sortedResult[2].balance, 11000);

      console.log("   ✅ Chronological sorting across multiple dates verified.");
    }

    // --------------------------------------------------------------------------
    // Test 5: Importing multiple transactions on the same date
    // --------------------------------------------------------------------------
    console.log("\n▶ Test 5: Importing multiple transactions on the same date");
    {
      const sameDateRows: ExcelAccountingRow[] = [
        {
          excelRowNumber: 2,
          slNo: 1,
          date: "15/01/2026",
          description: "Transaction A",
          category: "General",
          debit: 3000,
          credit: 0,
          paymentMode: "Bank Transfer",
          bankOrCash: "Bank",
          gstApplicable: false,
          gstAmount: 0,
          tdsTcsAmount: 0,
          billAvailable: false,
        },
        {
          excelRowNumber: 3,
          slNo: 2,
          date: "15/01/2026",
          description: "Transaction B",
          category: "General",
          debit: 0,
          credit: 500,
          paymentMode: "UPI",
          bankOrCash: "Bank",
          gstApplicable: false,
          gstAmount: 0,
          tdsTcsAmount: 0,
          billAvailable: false,
        },
        {
          excelRowNumber: 4,
          slNo: 3,
          date: "15/01/2026",
          description: "Transaction C",
          category: "General",
          debit: 100,
          credit: 0,
          paymentMode: "Bank Transfer",
          bankOrCash: "Bank",
          gstApplicable: false,
          gstAmount: 0,
          tdsTcsAmount: 0,
          billAvailable: false,
        },
      ];

      const balanced = calculateImportBalances(sameDateRows, 13000);
      assert.strictEqual(balanced[0].description, "Transaction A");
      assert.strictEqual(balanced[0].balance, 10000, "13000 - 3000 = 10000");

      assert.strictEqual(balanced[1].description, "Transaction B");
      assert.strictEqual(balanced[1].balance, 10500, "10000 + 500 = 10500");

      assert.strictEqual(balanced[2].description, "Transaction C");
      assert.strictEqual(balanced[2].balance, 10400, "10500 - 100 = 10400");

      console.log("   ✅ Deterministic order & sequential balances on same date verified.");
    }

    // --------------------------------------------------------------------------
    // Test 6: Importing into an account with no prior transactions but established opening balance
    // --------------------------------------------------------------------------
    console.log("\n▶ Test 6: Importing into account with no prior transactions but established opening balance");
    {
      await Transaction.deleteMany({});

      const openingBal = await getPreviousTransactionBalance(
        parseIndianDate("01/03/2026")!,
        "MAIN",
        "COMPANY",
        { initialBalance: 25000 }
      );
      assert.strictEqual(openingBal, 25000, `Expected established opening balance 25000, got ${openingBal}`);

      const rows: ExcelAccountingRow[] = [
        {
          slNo: 1,
          date: "01/03/2026",
          description: "Initial expense",
          category: "Office Expenses",
          debit: 5000,
          credit: 0,
          paymentMode: "Bank Transfer",
          bankOrCash: "Bank",
          gstApplicable: false,
          gstAmount: 0,
          tdsTcsAmount: 0,
          billAvailable: false,
        },
      ];

      const balanced = calculateImportBalances(rows, openingBal);
      assert.strictEqual(balanced[0].balance, 20000, `Expected 25000 - 5000 = 20000, got ${balanced[0].balance}`);

      console.log("   ✅ Established opening balance on empty account verified.");
    }

    // --------------------------------------------------------------------------
    // Test 7: Exporting all account transactions without changing their displayed balances
    // --------------------------------------------------------------------------
    console.log("\n▶ Test 7: Exporting all account transactions without changing displayed balances");
    {
      await Transaction.deleteMany({});

      await Transaction.insertMany([
        {
          accountType: "MAIN",
          transactionOrigin: "COMPANY",
          date: parseIndianDate("01/01/2026")!,
          description: "Opening",
          category: "General",
          debit: 0,
          credit: 10000,
          paymentMode: "Bank Transfer",
          bankOrCash: "Bank",
        },
        {
          accountType: "MAIN",
          transactionOrigin: "COMPANY",
          date: parseIndianDate("05/01/2026")!,
          description: "Purchase",
          category: "Purchases",
          debit: 2000,
          credit: 0,
          paymentMode: "Bank Transfer",
          bankOrCash: "Bank",
        },
        {
          accountType: "MAIN",
          transactionOrigin: "COMPANY",
          date: parseIndianDate("10/01/2026")!,
          description: "Payment",
          category: "Sales",
          debit: 0,
          credit: 5000,
          paymentMode: "UPI",
          bankOrCash: "Bank",
        },
      ]);

      const ledger = await getTransactions({ accountType: "MAIN", transactionOrigin: "COMPANY", unpaginated: true });
      assert.strictEqual(ledger.transactions.length, 3);

      // Verify displayed balances
      const displayedBalances = ledger.transactions.map((t) => t.calculatedBalance);
      assert.deepStrictEqual(displayedBalances, [10000, 8000, 13000]);

      // Generate Excel export buffer
      const buffer = generateAccountingExcel(ledger.transactions as unknown as TransactionExportItem[], "Foxion Accounts");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const exportedData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      assert.strictEqual(exportedData.length, 3, "Exported rows count must be 3");
      assert.strictEqual(exportedData[0]["Balance"], 10000, "Exported row 1 balance must match frontend displayed 10000");
      assert.strictEqual(exportedData[1]["Balance"], 8000, "Exported row 2 balance must match frontend displayed 8000");
      assert.strictEqual(exportedData[2]["Balance"], 13000, "Exported row 3 balance must match frontend displayed 13000");

      console.log("   ✅ Full export preserved exact displayed balances [10000, 8000, 13000].");
    }

    // --------------------------------------------------------------------------
    // Test 8: Exporting a selected month while preserving the frontend's balances
    // --------------------------------------------------------------------------
    console.log("\n▶ Test 8: Exporting a selected month while preserving the frontend's balances");
    {
      // Seed transactions in February
      await Transaction.insertMany([
        {
          accountType: "MAIN",
          transactionOrigin: "COMPANY",
          date: parseIndianDate("15/02/2026")!,
          description: "Feb Salary",
          category: "Salaries",
          debit: 4000,
          credit: 0,
          paymentMode: "Bank Transfer",
          bankOrCash: "Bank",
        },
        {
          accountType: "MAIN",
          transactionOrigin: "COMPANY",
          date: parseIndianDate("20/02/2026")!,
          description: "Feb Sales",
          category: "Sales",
          debit: 0,
          credit: 9000,
          paymentMode: "UPI",
          bankOrCash: "Bank",
        },
      ]);

      // Complete ledger displayed balances on /accounts/main
      const fullLedger = await getTransactions({
        accountType: "MAIN",
        transactionOrigin: "COMPANY",
        unpaginated: true,
      });
      assert.strictEqual(fullLedger.transactions.length, 5);
      // Previous Jan end balance was 13,000
      // 15/02: 13,000 - 4,000 = 9,000
      // 20/02: 9,000 + 9,000 = 18,000
      assert.strictEqual(fullLedger.transactions[3].calculatedBalance, 9000);
      assert.strictEqual(fullLedger.transactions[4].calculatedBalance, 18000);

      // Month export for February 2026 (startDate: 2026-02-01, endDate: 2026-02-28)
      const febLedger = await getTransactions({
        accountType: "MAIN",
        transactionOrigin: "COMPANY",
        startDate: "2026-02-01",
        endDate: "2026-02-28",
        unpaginated: true,
      });

      assert.strictEqual(febLedger.transactions.length, 2);
      assert.strictEqual(febLedger.transactions[0].calculatedBalance, 9000, "Feb Tx 1 calculatedBalance must be 9000");
      assert.strictEqual(febLedger.transactions[1].calculatedBalance, 18000, "Feb Tx 2 calculatedBalance must be 18000");

      const buffer = generateAccountingExcel(febLedger.transactions as unknown as TransactionExportItem[], "Foxion Accounts");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const exportedData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      assert.strictEqual(exportedData.length, 2);
      assert.strictEqual(exportedData[0]["Balance"], 9000, "Export row 1 balance must match frontend displayed 9000");
      assert.strictEqual(exportedData[1]["Balance"], 18000, "Export row 2 balance must match frontend displayed 18000");

      console.log("   ✅ Month export preserved exact frontend displayed balances [9000, 18000].");
    }

    // --------------------------------------------------------------------------
    // Test 9: Exporting a custom date range while preserving the frontend's balances
    // --------------------------------------------------------------------------
    console.log("\n▶ Test 9: Exporting a custom date range while preserving frontend's balances");
    {
      const rangeLedger = await getTransactions({
        accountType: "MAIN",
        transactionOrigin: "COMPANY",
        startDate: "2026-01-05",
        endDate: "2026-01-10",
        unpaginated: true,
      });

      assert.strictEqual(rangeLedger.transactions.length, 2);
      // On /accounts/main, 05/01 is 8000 and 10/01 is 13000
      assert.strictEqual(rangeLedger.transactions[0].calculatedBalance, 8000, "05/01 ledger balance must be 8000");
      assert.strictEqual(rangeLedger.transactions[1].calculatedBalance, 13000, "10/01 ledger balance must be 13000");

      const buffer = generateAccountingExcel(rangeLedger.transactions as unknown as TransactionExportItem[], "Foxion Accounts");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const exportedData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      assert.strictEqual(exportedData.length, 2);
      assert.strictEqual(exportedData[0]["Balance"], 8000, "Export custom range row 1 must match frontend 8000");
      assert.strictEqual(exportedData[1]["Balance"], 13000, "Export custom range row 2 must match frontend 13000");

      console.log("   ✅ Custom date range export preserved exact frontend displayed balances [8000, 13000].");
    }

    // --------------------------------------------------------------------------
    // Test 10: Import and export do not introduce negative balances or mismatches solely due to 0 starting
    // --------------------------------------------------------------------------
    console.log("\n▶ Test 10: Verifying no spurious negative balances or mismatches");
    {
      await Transaction.deleteMany({});

      // Seed account with ₹50,000 credit
      await Transaction.create({
        accountType: "MAIN",
        transactionOrigin: "COMPANY",
        date: parseIndianDate("01/01/2026")!,
        description: "Initial Capital",
        category: "General",
        debit: 0,
        credit: 50000,
        paymentMode: "Bank Transfer",
        bankOrCash: "Bank",
      });

      // Import an expense of ₹15,000 on 10/01/2026
      // If started from 0, it would be -₹15,000 (wrong negative balance!)
      // With fix, it should be 50,000 - 15,000 = +₹35,000 (positive!)
      const importRows: ExcelAccountingRow[] = [
        {
          slNo: 1,
          date: "10/01/2026",
          description: "Office Renovation",
          category: "Office Expenses",
          debit: 15000,
          credit: 0,
          paymentMode: "Bank Transfer",
          bankOrCash: "Bank",
          gstApplicable: false,
          gstAmount: 0,
          tdsTcsAmount: 0,
          billAvailable: false,
        },
      ];

      const openingBal = await getPreviousTransactionBalance(parseIndianDate("10/01/2026")!, "MAIN", "COMPANY");
      assert.strictEqual(openingBal, 50000, "Opening balance must be 50000");

      const balanced = calculateImportBalances(importRows, openingBal);
      assert.strictEqual(balanced[0].balance, 35000, `Balance must be +35,000 (not negative), got ${balanced[0].balance}`);
      assert(balanced[0].balance > 0, "Balance must be positive");

      // Now test export: when exported, it must preserve +35,000
      const exportItem: TransactionExportItem = {
        date: "10/01/2026",
        description: "Office Renovation",
        category: "Office Expenses",
        debit: 15000,
        credit: 0,
        calculatedBalance: 35000,
        paymentMode: "Bank Transfer",
        bankOrCash: "Bank",
      };

      const buffer = generateAccountingExcel([exportItem]);
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const exportedData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      assert.strictEqual(exportedData[0]["Balance"], 35000, "Exported balance must be +35,000 (not -15,000)");

      console.log("   ✅ Spurious negative balance prevention verified across import & export.");
    }

    // --------------------------------------------------------------------------
    // Test 11: Exact User Prompt Scenario (05/01 to 20/01, export Jan 15–20)
    // --------------------------------------------------------------------------
    console.log("\n▶ Test 11: Exact User Prompt Scenario (Export Jan 15–20 from complete account ledger)");
    {
      await Transaction.deleteMany({});

      // Setup 4 transactions as described in prompt:
      // 05/01/2026: Purchase (debit 0, credit 8000) -> balance ₹8,000
      // 10/01/2026: Payment received (debit 0, credit 5000) -> balance ₹13,000
      // 15/01/2026: Expense (debit 3000, credit 0) -> balance ₹10,000
      // 20/01/2026: Payment (debit 0, credit 2000) -> balance ₹12,000
      const inserted = await Transaction.insertMany([
        {
          accountType: "MAIN",
          transactionOrigin: "COMPANY",
          date: parseIndianDate("05/01/2026")!,
          description: "Purchase",
          category: "Purchases",
          debit: 0,
          credit: 8000,
          paymentMode: "Bank Transfer",
          bankOrCash: "Bank",
        },
        {
          accountType: "MAIN",
          transactionOrigin: "COMPANY",
          date: parseIndianDate("10/01/2026")!,
          description: "Payment received",
          category: "Sales",
          debit: 0,
          credit: 5000,
          paymentMode: "UPI",
          bankOrCash: "Bank",
        },
        {
          accountType: "MAIN",
          transactionOrigin: "COMPANY",
          date: parseIndianDate("15/01/2026")!,
          description: "Expense",
          category: "Office Expenses",
          debit: 3000,
          credit: 0,
          paymentMode: "Bank Transfer",
          bankOrCash: "Bank",
        },
        {
          accountType: "MAIN",
          transactionOrigin: "COMPANY",
          date: parseIndianDate("20/01/2026")!,
          description: "Payment",
          category: "Sales",
          debit: 0,
          credit: 2000,
          paymentMode: "UPI",
          bankOrCash: "Bank",
        },
      ]);

      // 1. Verify balances displayed on /accounts/main (unfiltered ledger)
      const mainPageData = await getTransactions({
        accountType: "MAIN",
        transactionOrigin: "COMPANY",
        unpaginated: true,
      });

      assert.strictEqual(mainPageData.transactions.length, 4);
      assert.strictEqual(mainPageData.transactions[0].calculatedBalance, 8000, "05/01 frontend balance must be 8000");
      assert.strictEqual(mainPageData.transactions[1].calculatedBalance, 13000, "10/01 frontend balance must be 13000");
      assert.strictEqual(mainPageData.transactions[2].calculatedBalance, 10000, "15/01 frontend balance must be 10000");
      assert.strictEqual(mainPageData.transactions[3].calculatedBalance, 12000, "20/01 frontend balance must be 12000");

      // 2. User exports only January 15–20
      const exportedSubset = await getTransactions({
        accountType: "MAIN",
        transactionOrigin: "COMPANY",
        startDate: "2026-01-15",
        endDate: "2026-01-20",
        unpaginated: true,
      });

      assert.strictEqual(exportedSubset.transactions.length, 2, "Must return 2 transactions for Jan 15–20");
      assert.strictEqual(
        exportedSubset.transactions[0].calculatedBalance,
        10000,
        "Jan 15 balance must NOT recalculate to -3000; must be 10000"
      );
      assert.strictEqual(
        exportedSubset.transactions[1].calculatedBalance,
        12000,
        "Jan 20 balance must NOT recalculate to -1000; must be 12000"
      );

      // Generate Excel file
      const buffer = generateAccountingExcel(
        exportedSubset.transactions as unknown as TransactionExportItem[],
        "Foxion Accounts"
      );
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const exportedRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      assert.strictEqual(exportedRows.length, 2);
      assert.strictEqual(
        exportedRows[0]["Balance"],
        10000,
        "Excel balance for Jan 15 MUST equal ₹10,000 (matching Main Accounts page)"
      );
      assert.strictEqual(
        exportedRows[1]["Balance"],
        12000,
        "Excel balance for Jan 20 MUST equal ₹12,000 (matching Main Accounts page)"
      );

      // Verify transaction mapping: stable IDs ensure 1-to-1 match
      assert.strictEqual(
        String(exportedSubset.transactions[0]._id),
        String(inserted[2]._id),
        "Transaction ID mapping must be stable for Jan 15"
      );
      assert.strictEqual(
        String(exportedSubset.transactions[1]._id),
        String(inserted[3]._id),
        "Transaction ID mapping must be stable for Jan 20"
      );

      console.log("   ✅ User prompt scenario verified: Jan 15–20 Excel balances are ₹10,000 and ₹12,000 exactly matching frontend.");
    }

    // --------------------------------------------------------------------------
    // Test 12: Category-Filtered Export Preserves Complete Ledger Balance
    // --------------------------------------------------------------------------
    console.log("\n▶ Test 12: Category-Filtered Export Preserves Complete Ledger Balance");
    {
      // Query only "Office Expenses" category
      const expenseExport = await getTransactions({
        accountType: "MAIN",
        transactionOrigin: "COMPANY",
        category: "Office Expenses",
        unpaginated: true,
      });

      assert.strictEqual(expenseExport.transactions.length, 1);
      assert.strictEqual(expenseExport.transactions[0].description, "Expense");
      assert.strictEqual(
        expenseExport.transactions[0].calculatedBalance,
        10000,
        "Category filtered transaction must preserve its complete ledger balance of 10000"
      );

      const buffer = generateAccountingExcel(
        expenseExport.transactions as unknown as TransactionExportItem[],
        "Foxion Accounts"
      );
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const exportedRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      assert.strictEqual(exportedRows.length, 1);
      assert.strictEqual(
        exportedRows[0]["Balance"],
        10000,
        "Excel balance for category-filtered export must be ₹10,000"
      );

      console.log("   ✅ Category-filtered export preserved exact ledger balance of ₹10,000.");
    }

    // --------------------------------------------------------------------------
    // Test 13: Dynamic Excel Export Filename Helper Formats
    // --------------------------------------------------------------------------
    console.log("\n▶ Test 13: Dynamic Excel Export Filename Formats (Month, Range, All)");
    {
      // A. Month exports: {Month}_{Year}_Foxion.xlsx
      const aug2026 = getAccountingExportFilename({ scope: "MONTH", month: 8, year: 2026 });
      assert.strictEqual(aug2026, "August_2026_Foxion.xlsx", "August 2026 must produce August_2026_Foxion.xlsx");

      const mar2026 = getAccountingExportFilename({ scope: "MONTH", month: 3, year: 2026 });
      assert.strictEqual(mar2026, "March_2026_Foxion.xlsx", "March 2026 must produce March_2026_Foxion.xlsx");

      const jan2025 = getAccountingExportFilename({ scope: "MONTH", month: 1, year: 2025 });
      assert.strictEqual(jan2025, "January_2025_Foxion.xlsx", "January 2025 must produce January_2025_Foxion.xlsx");

      // Verify English month string input
      const nov2027 = getAccountingExportFilename({ scope: "MONTH", month: "November", year: 2027 });
      assert.strictEqual(nov2027, "November_2027_Foxion.xlsx", "November 2027 must produce November_2027_Foxion.xlsx");

      // B. Custom Date Range: {DD-MM-YYYY}__{DD-MM-YYYY}_Foxion.xlsx
      const range1 = getAccountingExportFilename({
        scope: "RANGE",
        startDate: "2026-03-01",
        endDate: "2026-03-31",
      });
      assert.strictEqual(
        range1,
        "01-03-2026__31-03-2026_Foxion.xlsx",
        "Range 01/03/2026–31/03/2026 must produce 01-03-2026__31-03-2026_Foxion.xlsx"
      );

      const rangeIndian = getAccountingExportFilename({
        scope: "RANGE",
        startDate: "15/01/2026",
        endDate: "20/01/2026",
      });
      assert.strictEqual(
        rangeIndian,
        "15-01-2026__20-01-2026_Foxion.xlsx",
        "Range 15/01/2026–20/01/2026 must produce 15-01-2026__20-01-2026_Foxion.xlsx"
      );

      // Verify no timezone conversion drift shifts the date
      const isoStart = "2026-08-05T00:00:00.000Z";
      const isoEnd = "2026-08-25T23:59:59.999Z";
      const rangeIso = getAccountingExportFilename({
        scope: "RANGE",
        startDate: isoStart,
        endDate: isoEnd,
      });
      assert.strictEqual(
        rangeIso,
        "05-08-2026__25-08-2026_Foxion.xlsx",
        "ISO date strings must not shift across timezones"
      );

      // C. Export All: complete_foxion_accounts.xlsx
      const allExport = getAccountingExportFilename({ scope: "ALL" });
      assert.strictEqual(
        allExport,
        "complete_foxion_accounts.xlsx",
        "Export all must produce complete_foxion_accounts.xlsx"
      );
      assert.strictEqual(
        allExport.toLowerCase(),
        "complete_foxion_accounts.xlsx",
        "Must be all lowercase"
      );
      assert(!allExport.includes("2026"), "Must not append dates or timestamps");

      // Verify only single .xlsx extension on all generated filenames
      for (const fn of [aug2026, mar2026, jan2025, range1, rangeIndian, allExport]) {
        assert(fn.endsWith(".xlsx"), `${fn} must end with .xlsx`);
        assert.strictEqual(fn.split(".xlsx").length, 2, `${fn} must contain exactly one .xlsx extension`);
      }

      console.log("   ✅ Dynamic filename helper formats verified across all 3 modes.");
    }

    // --------------------------------------------------------------------------
    // Test 14: Dynamic Filename in API Route (/api/excel/export)
    // --------------------------------------------------------------------------
    console.log("\n▶ Test 14: Dynamic Filename in API Route (/api/excel/export)");
    {
      // 1. Month export in API: August 2026
      const monthReq = new Request(
        "http://localhost:3000/api/excel/export?accountType=MAIN&origin=COMPANY&scope=MONTH&month=8&year=2026"
      );
      const monthRes = await exportRouteGET(monthReq);
      assert.strictEqual(monthRes.status, 200);
      const monthDisp = monthRes.headers.get("Content-Disposition");
      assert(
        monthDisp && monthDisp.includes('filename="August_2026_Foxion.xlsx"'),
        `Expected Content-Disposition to have August_2026_Foxion.xlsx, got: ${monthDisp}`
      );

      // 2. Custom Date Range in API: 01/03/2026 to 31/03/2026
      const rangeReq = new Request(
        "http://localhost:3000/api/excel/export?accountType=MAIN&origin=COMPANY&scope=RANGE&startDate=2026-03-01&endDate=2026-03-31"
      );
      const rangeRes = await exportRouteGET(rangeReq);
      // Even if no transactions in that specific month in seeded DB, let's verify header logic or seed 1 tx
      if (rangeRes.status === 200) {
        const rangeDisp = rangeRes.headers.get("Content-Disposition");
        assert(
          rangeDisp && rangeDisp.includes('filename="01-03-2026__31-03-2026_Foxion.xlsx"'),
          `Expected Content-Disposition to have 01-03-2026__31-03-2026_Foxion.xlsx, got: ${rangeDisp}`
        );
      } else {
        // Seed 1 transaction in March to verify status 200 and header
        await Transaction.create({
          accountType: "MAIN",
          transactionOrigin: "COMPANY",
          date: parseIndianDate("10/03/2026")!,
          description: "March Sale",
          category: "Sales",
          debit: 0,
          credit: 1000,
          paymentMode: "UPI",
          bankOrCash: "Bank",
        });
        const retryRangeRes = await exportRouteGET(rangeReq);
        assert.strictEqual(retryRangeRes.status, 200);
        const rangeDisp = retryRangeRes.headers.get("Content-Disposition");
        assert(
          rangeDisp && rangeDisp.includes('filename="01-03-2026__31-03-2026_Foxion.xlsx"'),
          `Expected Content-Disposition to have 01-03-2026__31-03-2026_Foxion.xlsx, got: ${rangeDisp}`
        );
      }

      // 3. Export All in API
      const allReq = new Request(
        "http://localhost:3000/api/excel/export?accountType=MAIN&origin=COMPANY&scope=ALL"
      );
      const allRes = await exportRouteGET(allReq);
      assert.strictEqual(allRes.status, 200);
      const allDisp = allRes.headers.get("Content-Disposition");
      assert(
        allDisp && allDisp.includes('filename="complete_foxion_accounts.xlsx"'),
        `Expected Content-Disposition to have complete_foxion_accounts.xlsx, got: ${allDisp}`
      );

      console.log("   ✅ API route returns exact dynamic filename in Content-Disposition header.");
    }

    console.log("\n🎉 ALL 14 EXCEL IMPORT & EXPORT TESTS PASSED WITH 100% SUCCESS!");
  } finally {
    await teardown();
  }
}

runAllTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Test suite failed:", err);
    process.exit(1);
  });
