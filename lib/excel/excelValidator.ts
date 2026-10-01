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
  raw: Partial<ExcelAccountingRow> | EditableImportRow,
  options?: { origin?: "COMPANY" | "PRE_COMPANY" }
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
  const origin = options?.origin || (raw as any).transactionOrigin || "COMPANY";

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

  // 6. Paid By validation for personal payments
  const isPersonal =
    raw.bankOrCash === "Personal Bank" ||
    raw.bankOrCash === "Personal Cash" ||
    raw.paymentSource === "Personal Bank" ||
    raw.paymentSource === "Personal Cash";

  if (origin === "PRE_COMPANY" && isPersonal) {
    const paidByVal = String(raw.paidBy || "").trim();
    if (!paidByVal) {
      fieldErrors.paidBy = "Paid By is required for personal payments";
    }
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
  filename: string,
  options?: { origin?: "COMPANY" | "PRE_COMPANY" }
): ExcelValidationSummary {
  const validatedRows: ExcelRowValidationResult[] = [];
  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  const isPreCompany = options?.origin === "PRE_COMPANY";

  for (let idx = 0; idx < rawRows.length; idx++) {
    const raw = rawRows[idx];
    const rowNumber = idx + 2; // +1 for 0-index, +1 for header
    const rawPaidBy = String(raw.paidBy || "").trim();

    // Normalize Bank/Cash and Payment Source
    let bankOrCash: "Bank" | "Cash" | "Personal Bank" | "Personal Cash" | "N/A" = "Bank";
    let paymentSource: "Company Bank" | "Company Cash" | "Personal Bank" | "Personal Cash" | "Other" = "Company Bank";

    const rawBankCash = String(raw.bankOrCash || raw.paymentSource || "").trim().toLowerCase();

    if (isPreCompany) {
      if (rawBankCash.includes("company cash")) {
        bankOrCash = "Cash";
        paymentSource = "Company Cash";
      } else if (rawBankCash.includes("company bank")) {
        bankOrCash = "Bank";
        paymentSource = "Company Bank";
      } else if (rawBankCash.includes("cash") && !rawBankCash.includes("company")) {
        bankOrCash = "Personal Cash";
        paymentSource = "Personal Cash";
      } else if (rawBankCash === "n/a" || rawBankCash === "na") {
        bankOrCash = "N/A";
        paymentSource = "Other";
      } else {
        // In Pre-Company mode, default to Personal Bank (before company bank was setup)
        bankOrCash = "Personal Bank";
        paymentSource = "Personal Bank";
      }
    } else {
      if (rawBankCash.includes("cash")) {
        bankOrCash = "Cash";
        paymentSource = "Company Cash";
      } else if (rawBankCash.includes("bank") || rawBankCash.includes("hdfc") || rawBankCash.includes("sbi") || rawBankCash.includes("icici")) {
        bankOrCash = "Bank";
        paymentSource = "Company Bank";
      } else if (rawBankCash.includes("personal bank")) {
        bankOrCash = "Personal Bank";
        paymentSource = "Personal Bank";
      } else if (rawBankCash.includes("personal cash")) {
        bankOrCash = "Personal Cash";
        paymentSource = "Personal Cash";
      } else if (rawBankCash === "n/a" || rawBankCash === "na") {
        bankOrCash = "N/A";
        paymentSource = "Other";
      }
    }

    const validation = validateSingleRow(
      {
        ...raw,
        bankOrCash,
        paymentSource,
        paidBy: rawPaidBy,
        transactionOrigin: isPreCompany ? "PRE_COMPANY" : "COMPANY",
      },
      { origin: isPreCompany ? "PRE_COMPANY" : "COMPANY" }
    );

    const paymentMode =
      String(raw.paymentMode || "").trim() ||
      (bankOrCash.includes("Cash") ? "Cash" : "UPI");

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
      paymentSource,
      transactionOrigin: isPreCompany ? "PRE_COMPANY" : "COMPANY",
      partyName: String(raw.partyName || "").trim(),
      paidBy: rawPaidBy,
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
    origin: isPreCompany ? "PRE_COMPANY" : "COMPANY",
    totalRows: rawRows.length,
    validCount,
    warningCount,
    errorCount,
    rows: validatedRows,
  };
}
