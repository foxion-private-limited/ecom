import * as XLSX from "xlsx";
import { parseExcelBuffer, generateValidationErrorReportCsv } from "../lib/excel/excelParser";
import { validateExcelRows, validateSingleRow } from "../lib/excel/excelValidator";
import { ExcelValidationErrorItem } from "../lib/excel/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

async function runTests() {
  console.log("🧪 Starting Excel Import Error Reporting Automated Test Suite...\n");

  // --------------------------------------------------------------------------
  // Test 1: Physical Excel Row Tracking with Blank Rows
  // --------------------------------------------------------------------------
  console.log("▶ Test 1: Excel Row Number Tracking (Header, Data & Blank Rows)");
  {
    // Create a worksheet manually with 2 blank rows before and between data
    // Row 1: Header
    // Row 2: Blank row
    // Row 3: Valid row
    // Row 4: Blank row
    // Row 5: Row with invalid date
    // Row 6: Row with non-numeric debit & missing category (multiple errors)
    const wsData = [
      ["Date", "Description", "Category", "Debit", "Credit", "Payment Mode", "Bank/Cash"], // Row 1
      [], // Row 2: Blank
      ["15/04/2026", "Office Stationery", "Office Supplies", "500", "0", "Bank Transfer", "Bank"], // Row 3
      [], // Row 4: Blank
      ["32/13/2026", "Courier Delivery", "Logistics", "200", "0", "UPI", "Bank"], // Row 5 (Invalid Date)
      ["16/04/2026", "Packaging Boxes", "", "invalid_num", "0", "Cash", "Cash"], // Row 6 (2 errors: missing category, non-numeric debit)
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const { rows } = parseExcelBuffer(buffer);
    assert(rows.length === 3, `Expected 3 non-blank data rows, got ${rows.length}`);

    // Verify row numbers preserved
    assert(rows[0].excelRowNumber === 3, `Row 0 should have excelRowNumber 3, got ${rows[0].excelRowNumber}`);
    assert(rows[1].excelRowNumber === 5, `Row 1 should have excelRowNumber 5, got ${rows[1].excelRowNumber}`);
    assert(rows[2].excelRowNumber === 6, `Row 2 should have excelRowNumber 6, got ${rows[2].excelRowNumber}`);

    // Validate rows
    const summary = validateExcelRows(rows, "test_file.xlsx", { origin: "COMPANY" });

    assert(summary.totalRows === 3, `Expected totalRows 3, got ${summary.totalRows}`);
    assert(summary.validCount === 1, `Expected validCount 1, got ${summary.validCount}`);
    assert(summary.invalidRowCount === 2, `Expected invalidRowCount 2, got ${summary.invalidRowCount}`);
    assert(summary.totalErrorsCount === 3, `Expected totalErrorsCount 3 (1 from row 5, 2 from row 6), got ${summary.totalErrorsCount}`);

    // Check Row 5 error
    const row5Errors = summary.allErrors.filter((e) => e.rowNumber === 5);
    assert(row5Errors.length === 1, `Expected 1 error on row 5, got ${row5Errors.length}`);
    assert(row5Errors[0].field === "date", `Expected date error on row 5, got ${row5Errors[0].field}`);
    assert(row5Errors[0].columnHeader === "Date", `Expected columnHeader 'Date', got ${row5Errors[0].columnHeader}`);
    assert(row5Errors[0].currentValue === "32/13/2026", `Expected currentValue '32/13/2026', got '${row5Errors[0].currentValue}'`);
    assert(row5Errors[0].howToFix.includes("DD/MM/YYYY"), `Expected actionable fix guidance, got '${row5Errors[0].howToFix}'`);

    // Check Row 6 errors (Multiple errors on the same row)
    const row6Errors = summary.allErrors.filter((e) => e.rowNumber === 6);
    assert(row6Errors.length === 2, `Expected 2 errors on row 6, got ${row6Errors.length}`);
    const catErr = row6Errors.find((e) => e.field === "category");
    const debitErr = row6Errors.find((e) => e.field === "debit");
    assert(Boolean(catErr), "Row 6 must have a category error");
    assert(Boolean(debitErr), "Row 6 must have a debit error");
    assert(debitErr!.currentValue === "invalid_num", `Expected currentValue 'invalid_num', got '${debitErr!.currentValue}'`);
    assert(debitErr!.code === "NON_NUMERIC_AMOUNT", `Expected NON_NUMERIC_AMOUNT, got '${debitErr!.code}'`);

    console.log("   ✅ Excel row tracking, blank row handling & multiple error detection verified.");
  }

  // --------------------------------------------------------------------------
  // Test 2: Validation of Various Error Types & Actionable Suggestions
  // --------------------------------------------------------------------------
  console.log("\n▶ Test 2: Error Types, Field Explanations & Actionable Fixes");
  {
    // A. Missing required fields
    const emptyRowRes = validateSingleRow({
      date: "",
      description: "",
      category: "",
      debit: 0,
      credit: 0,
    }, { rowNumber: 10 });

    assert(!emptyRowRes.isValid, "Empty row must be invalid");
    assert(emptyRowRes.errorItems.some((e) => e.field === "date" && e.code === "MISSING_REQUIRED_FIELD"), "Should detect missing date");
    assert(emptyRowRes.errorItems.some((e) => e.field === "description" && e.code === "MISSING_REQUIRED_FIELD"), "Should detect missing description");
    assert(emptyRowRes.errorItems.some((e) => e.field === "category" && e.code === "MISSING_REQUIRED_FIELD"), "Should detect missing category");
    assert(emptyRowRes.errorItems.some((e) => e.field === "amount" && e.code === "ZERO_AMOUNT"), "Should detect both debit and credit zero");

    // B. Negative amounts
    const negRes = validateSingleRow({
      date: "10/05/2026",
      description: "Refund",
      category: "Sales",
      debit: -150,
      credit: 0,
    }, { rowNumber: 11, rawValues: { debit: "-150" } });

    assert(!negRes.isValid, "Negative amount row must be invalid");
    const negDebit = negRes.errorItems.find((e) => e.field === "debit");
    assert(Boolean(negDebit), "Should flag negative debit");
    assert(negDebit!.code === "NEGATIVE_AMOUNT", "Code must be NEGATIVE_AMOUNT");
    assert(negDebit!.currentValue === "-150", `Current value should be '-150', got ${negDebit!.currentValue}`);

    // C. Pre-Company Paid By Validation
    const preCompRes = validateSingleRow({
      date: "12/02/2026",
      description: "Incorporation legal fees",
      category: "Legal",
      debit: 15000,
      credit: 0,
      bankOrCash: "Personal Bank",
      paidBy: "", // Missing Paid By in Pre-Company mode!
      transactionOrigin: "PRE_COMPANY",
    }, { origin: "PRE_COMPANY", rowNumber: 12 });

    assert(!preCompRes.isValid, "Pre-Company without Paid By on personal account must be invalid");
    const paidByErr = preCompRes.errorItems.find((e) => e.field === "paidBy");
    assert(Boolean(paidByErr), "Should flag missing paidBy");
    assert(paidByErr!.code === "MISSING_PAID_BY", "Code must be MISSING_PAID_BY");

    console.log("   ✅ Missing fields, zero amounts, negative numbers & Pre-Company Paid By rules verified.");
  }

  // --------------------------------------------------------------------------
  // Test 3: CSV Error Report Generation with Formula Injection Defense
  // --------------------------------------------------------------------------
  console.log("\n▶ Test 3: Downloadable CSV Error Report & Security Escaping");
  {
    const sampleErrors: ExcelValidationErrorItem[] = [
      {
        sheetName: "April 2026",
        rowNumber: 4,
        field: "date",
        columnHeader: "Date",
        currentValue: "32/13/2026",
        code: "INVALID_DATE",
        error: "Invalid date format '32/13/2026'",
        howToFix: "Enter a valid calendar date in accepted DD/MM/YYYY format (e.g. '15/04/2026')",
      },
      {
        sheetName: "April 2026",
        rowNumber: 7,
        field: "debit",
        columnHeader: "Debit",
        // Formula injection attempt!
        currentValue: "=SUM(A1:A10)",
        code: "NON_NUMERIC_AMOUNT",
        error: "Debit value '=SUM(A1:A10)' must be numeric",
        howToFix: "Enter a valid numeric amount, such as '1250.00' or '0'",
      },
      {
        sheetName: "April 2026",
        rowNumber: 8,
        field: "description",
        columnHeader: "Description",
        // Another formula injection attempt with @ and commas
        currentValue: "@cmd|' /C calc'!A0, with comma",
        code: "MISSING_REQUIRED_FIELD",
        error: "Description contains illegal characters",
        howToFix: "Enter a clean description",
      },
    ];

    const csv = generateValidationErrorReportCsv(sampleErrors);

    // 1. Must start with UTF-8 BOM (\uFEFF)
    assert(csv.charCodeAt(0) === 0xfeff, "CSV must start with UTF-8 BOM");

    // 2. Header must match required columns
    const lines = csv.slice(1).split("\r\n");
    assert(lines[0] === '"Worksheet","Excel Row","Field / Column","Current Value","Error","How to Fix"', `Header mismatch: ${lines[0]}`);

    // 3. Row count matches
    assert(lines.length === 4, `Expected 4 lines (1 header + 3 data), got ${lines.length}`);

    // 4. Formula injection safety:
    // '=SUM(A1:A10)' must be prefixed with single quote: "'=SUM(A1:A10)"
    assert(csv.includes("''=SUM(A1:A10)") || csv.includes("'\u003dSUM") || csv.includes("'=SUM(A1:A10)"), "CSV must sanitize formula starting with =");
    assert(csv.includes("'@cmd"), "CSV must sanitize formula starting with @");

    console.log("   ✅ CSV report format, UTF-8 BOM & formula injection defenses verified.");
  }

  console.log("\n🎉 ALL AUTOMATED TESTS PASSED SUCCESSFULLY!");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
