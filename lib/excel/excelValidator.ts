import {
  ExcelAccountingRow,
  ExcelRowValidationResult,
  ExcelValidationSummary,
  EditableImportRow,
} from "./types";
import { parseIndianDate } from "@/lib/utils";

/**
 * Validate a single row in the editable import table
 */
export function validateSingleRow(
  raw: Partial<ExcelAccountingRow> | EditableImportRow
): {
  isValid: boolean;
  parsedDate: Date | null;
  debit: number;
  credit: number;
  fieldErrors: Record<string, string>;
  warnings: string[];
} {
  const fieldErrors: Record<string, string> = {};
  const warnings: string[] = [];

  // 1. Date validation
  const parsedDate = parseIndianDate(raw.date);
  if (!parsedDate) {
    fieldErrors.date = "Invalid date (DD/MM/YYYY required)";
  }

  // 2. Description
  const desc = String(raw.description || "").trim();
  if (!desc) {
    fieldErrors.description = "Description is required";
  }

  // 3. Category
  const category = String(raw.category || "").trim();
  if (!category) {
    fieldErrors.category = "Category is required";
  }

  // 4. Debit & Credit
  const parseNum = (val: unknown): number => {
    if (val === null || val === undefined || val === "") return 0;
    if (typeof val === "number") return val;
    const n = Number(String(val).replace(/[^0-9.-]+/g, ""));
    return isNaN(n) ? 0 : n;
  };

  const debit = parseNum(raw.debit);
  const credit = parseNum(raw.credit);

  if (debit < 0) {
    fieldErrors.debit = "Debit must be ≥ 0";
  }
  if (credit < 0) {
    fieldErrors.credit = "Credit must be ≥ 0";
  }

  if (debit === 0 && credit === 0 && !fieldErrors.debit && !fieldErrors.credit) {
    fieldErrors.amount = "Either Debit or Credit must be > 0";
  }

  if (debit > 0 && credit > 0) {
    warnings.push("Both Debit and Credit are non-zero in this row");
  }

  // 5. GST Amount & TDS/TCS
  const gstAmount = parseNum(raw.gstAmount);
  if (gstAmount < 0) {
    fieldErrors.gstAmount = "GST must be ≥ 0";
  }

  const tdsTcsAmount = parseNum(raw.tdsTcsAmount);
  if (tdsTcsAmount < 0) {
    fieldErrors.tdsTcsAmount = "TDS/TCS must be ≥ 0";
  }

  const isValid = Object.keys(fieldErrors).length === 0;

  return {
    isValid,
    parsedDate,
    debit: isNaN(debit) ? 0 : debit,
    credit: isNaN(credit) ? 0 : credit,
    fieldErrors,
    warnings,
  };
}

/**
 * Validate batch of raw Excel rows into ExcelValidationSummary
 */
export function validateExcelRows(
  rawRows: Partial<ExcelAccountingRow>[],
  filename: string
): ExcelValidationSummary {
  const validatedRows: ExcelRowValidationResult[] = [];
  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  for (let idx = 0; idx < rawRows.length; idx++) {
    const raw = rawRows[idx];
    const rowNumber = idx + 2; // +1 for 0-index, +1 for header
    const validation = validateSingleRow(raw);

    // Normalize Bank/Cash
    let bankOrCash: "Bank" | "Cash" | "N/A" = "Bank";
    const rawBankCash = String(raw.bankOrCash || "").trim().toLowerCase();
    if (rawBankCash.includes("cash")) {
      bankOrCash = "Cash";
    } else if (rawBankCash.includes("bank") || rawBankCash.includes("hdfc") || rawBankCash.includes("sbi") || rawBankCash.includes("icici")) {
      bankOrCash = "Bank";
    } else if (rawBankCash === "n/a" || rawBankCash === "na") {
      bankOrCash = "N/A";
    }

    const paymentMode =
      String(raw.paymentMode || "").trim() ||
      (bankOrCash === "Cash" ? "Cash" : "Bank Transfer");

    const gstApplicableRaw = String(raw.gstApplicable || "").trim().toLowerCase();
    const gstApplicable =
      gstApplicableRaw === "yes" ||
      gstApplicableRaw === "y" ||
      gstApplicableRaw === "true" ||
      gstApplicableRaw === "1" ||
      raw.gstApplicable === true;

    const billRaw = String(raw.billAvailable || "").trim().toLowerCase();
    const billAvailable =
      billRaw === "yes" ||
      billRaw === "y" ||
      billRaw === "true" ||
      billRaw === "1" ||
      billRaw.includes("available") ||
      raw.billAvailable === true;

    const cleanData: ExcelAccountingRow = {
      slNo: raw.slNo || rowNumber - 1,
      date: validation.parsedDate || new Date(),
      description: String(raw.description || "").trim(),
      category: String(raw.category || "").trim(),
      debit: validation.debit,
      credit: validation.credit,
      paymentMode,
      bankOrCash,
      partyName: String(raw.partyName || "").trim(),
      invoiceOrderId: String(raw.invoiceOrderId || "").trim(),
      gstApplicable,
      gstAmount: Math.max(0, Number(raw.gstAmount) || 0),
      tdsTcsAmount: Math.max(0, Number(raw.tdsTcsAmount) || 0),
      remarks: String(raw.remarks || "").trim(),
      billAvailable,
    };

    const errors = Object.values(validation.fieldErrors);
    if (validation.isValid) {
      validCount++;
    } else {
      errorCount++;
    }

    if (validation.warnings.length > 0) {
      warningCount++;
    }

    validatedRows.push({
      rowNumber,
      isValid: validation.isValid,
      data: cleanData,
      errors,
      warnings: validation.warnings,
    });
  }

  return {
    filename,
    totalRows: rawRows.length,
    validCount,
    warningCount,
    errorCount,
    rows: validatedRows,
  };
}
