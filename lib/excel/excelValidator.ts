import {
  ExcelAccountingRow,
  ExcelRowValidationResult,
  ExcelValidationSummary,
  EditableImportRow,
  ExcelValidationErrorItem,
} from "./types";
import { parseIndianDate, getISTCalendarDate } from "@/lib/utils";
import { getColumnHeaderForField } from "./excelParser";

interface NumericParseResult {
  isNumeric: boolean;
  value: number;
  rawString: string;
}

/**
 * Robust cell numeric parser that distinguishes empty/zero from invalid non-numeric strings
 */
function parseNumericCell(val: unknown): NumericParseResult {
  if (val === null || val === undefined || val === "") {
    return { isNumeric: true, value: 0, rawString: "" };
  }
  if (typeof val === "number") {
    if (isNaN(val)) return { isNumeric: false, value: 0, rawString: "NaN" };
    return { isNumeric: true, value: val, rawString: String(val) };
  }

  const rawStr = String(val).trim();
  if (rawStr === "" || rawStr === "-" || rawStr === "—" || rawStr === "N/A" || rawStr === "na") {
    return { isNumeric: true, value: 0, rawString: rawStr };
  }

  // Remove currency signs (₹, $), commas, and spaces
  const cleaned = rawStr.replace(/[₹$,\s]/g, "");
  // Ensure the string represents a valid decimal or integer number
  const num = Number(cleaned);
  if (isNaN(num)) {
    return { isNumeric: false, value: 0, rawString: rawStr };
  }

  return { isNumeric: true, value: num, rawString: rawStr };
}

/**
 * Validate a single row in the editable import table or during raw Excel parse
 */
export function validateSingleRow(
  raw: Partial<ExcelAccountingRow> | EditableImportRow,
  options?: {
    origin?: "COMPANY" | "PRE_COMPANY";
    rowNumber?: number;
    sheetName?: string;
    rawValues?: Record<string, unknown>;
  }
): {
  isValid: boolean;
  parsedDate: Date | null;
  debit: number;
  credit: number;
  fieldErrors: Record<string, string>;
  errorItems: ExcelValidationErrorItem[];
  warnings: string[];
} {
  const fieldErrors: Record<string, string> = {};
  const errorItems: ExcelValidationErrorItem[] = [];
  const warnings: string[] = [];

  const rawCast = raw as Partial<ExcelAccountingRow> & {
    __excelRowNumber?: number;
    __sheetName?: string;
    __rawValues?: Record<string, unknown>;
    excelRowNumber?: number;
    sheetName?: string;
  };

  const rowNumber =
    options?.rowNumber ??
    rawCast.__excelRowNumber ??
    rawCast.excelRowNumber ??
    (raw.slNo ? Number(raw.slNo) : 1);

  const sheetName =
    options?.sheetName ??
    rawCast.__sheetName ??
    rawCast.sheetName ??
    "Sheet1";

  const rawValues = options?.rawValues ?? rawCast.__rawValues ?? {};

  const origin =
    options?.origin ||
    (raw as { transactionOrigin?: "COMPANY" | "PRE_COMPANY" }).transactionOrigin ||
    "COMPANY";

  const addError = (
    field: string,
    code: string,
    error: string,
    howToFix: string,
    currentValueOverride?: string
  ) => {
    // Keep first error message in fieldErrors map for table cell highlight
    if (!fieldErrors[field]) {
      fieldErrors[field] = error;
    }

    const columnHeader = getColumnHeaderForField(field);
    const rawVal =
      currentValueOverride !== undefined
        ? currentValueOverride
        : rawValues[field] !== undefined
        ? String(rawValues[field] ?? "")
        : raw[field as keyof typeof raw] !== undefined
        ? String(raw[field as keyof typeof raw] ?? "")
        : "";

    errorItems.push({
      sheetName,
      rowNumber,
      field,
      columnHeader,
      currentValue: String(rawVal),
      code,
      error,
      howToFix,
      message: error,
      suggestion: howToFix,
    });
  };

  // 1. Date validation
  const rawDateVal =
    rawValues.date !== undefined
      ? rawValues.date
      : raw.date;
  const rawDateStr = rawDateVal instanceof Date
    ? rawDateVal.toISOString().split("T")[0]
    : String(rawDateVal ?? "").trim();

  const parsedDate = parseIndianDate(rawDateVal as string | number | Date | null | undefined);

  if (!rawDateStr) {
    addError(
      "date",
      "MISSING_REQUIRED_FIELD",
      "Date is required",
      "Enter a valid transaction date in accepted DD/MM/YYYY format (e.g. '15/04/2026')",
      ""
    );
  } else if (!parsedDate) {
    addError(
      "date",
      "INVALID_DATE",
      `Invalid date format '${rawDateStr}'`,
      "Enter a valid calendar date in accepted DD/MM/YYYY format (e.g. '15/04/2026')",
      rawDateStr
    );
  }

  // 2. Description validation
  const rawDescVal =
    rawValues.description !== undefined
      ? rawValues.description
      : raw.description;
  const descStr = String(rawDescVal ?? "").trim();

  if (!descStr) {
    addError(
      "description",
      "MISSING_REQUIRED_FIELD",
      "Description is required",
      "Enter a clear narration or description of the transaction (e.g. 'Packaging Boxes', 'Marketplace Payout')",
      ""
    );
  }

  // 3. Category validation
  const rawCatVal =
    rawValues.category !== undefined
      ? rawValues.category
      : raw.category;
  const catStr = String(rawCatVal ?? "").trim();

  if (!catStr) {
    addError(
      "category",
      "MISSING_REQUIRED_FIELD",
      "Category is required",
      "Select or enter an accounting category (e.g. 'Logistics', 'Packaging', 'Raw Materials', 'Sales')",
      ""
    );
  }

  // 4. Debit & Credit validation
  const rawDebitVal = rawValues.debit !== undefined ? rawValues.debit : raw.debit;
  const rawCreditVal = rawValues.credit !== undefined ? rawValues.credit : raw.credit;

  const debitParsed = parseNumericCell(rawDebitVal);
  const creditParsed = parseNumericCell(rawCreditVal);

  let hasDebitOrCreditError = false;

  if (!debitParsed.isNumeric) {
    hasDebitOrCreditError = true;
    addError(
      "debit",
      "NON_NUMERIC_AMOUNT",
      `Debit value '${debitParsed.rawString}' must be numeric`,
      "Enter a valid numeric amount, such as '1250.00' or '0'",
      debitParsed.rawString
    );
  } else if (debitParsed.value < 0) {
    hasDebitOrCreditError = true;
    addError(
      "debit",
      "NEGATIVE_AMOUNT",
      `Debit amount cannot be negative (${debitParsed.value})`,
      "Enter a positive amount or 0.00",
      String(debitParsed.value)
    );
  }

  if (!creditParsed.isNumeric) {
    hasDebitOrCreditError = true;
    addError(
      "credit",
      "NON_NUMERIC_AMOUNT",
      `Credit value '${creditParsed.rawString}' must be numeric`,
      "Enter a valid numeric amount, such as '1250.00' or '0'",
      creditParsed.rawString
    );
  } else if (creditParsed.value < 0) {
    hasDebitOrCreditError = true;
    addError(
      "credit",
      "NEGATIVE_AMOUNT",
      `Credit amount cannot be negative (${creditParsed.value})`,
      "Enter a positive amount or 0.00",
      String(creditParsed.value)
    );
  }

  const debit = debitParsed.isNumeric ? debitParsed.value : 0;
  const credit = creditParsed.isNumeric ? creditParsed.value : 0;

  // Both zero error
  if (!hasDebitOrCreditError && debit === 0 && credit === 0) {
    addError(
      "amount",
      "ZERO_AMOUNT",
      "Both Debit and Credit are zero or empty",
      "Specify either a Debit (outflow) or Credit (inflow) amount greater than 0.00",
      "Debit: 0, Credit: 0"
    );
  }

  // Warning when both non-zero
  if (debit > 0 && credit > 0) {
    warnings.push("Both Debit and Credit are non-zero in this row (typically transactions are either debit or credit)");
  }

  // 5. GST Amount & TDS/TCS validation
  const rawGstVal = rawValues.gstAmount !== undefined ? rawValues.gstAmount : raw.gstAmount;
  const gstParsed = parseNumericCell(rawGstVal);

  if (!gstParsed.isNumeric) {
    addError(
      "gstAmount",
      "NON_NUMERIC_AMOUNT",
      `GST Amount '${gstParsed.rawString}' must be numeric`,
      "Enter a valid numeric amount or 0.00",
      gstParsed.rawString
    );
  } else if (gstParsed.value < 0) {
    addError(
      "gstAmount",
      "NEGATIVE_AMOUNT",
      `GST Amount cannot be negative (${gstParsed.value})`,
      "Enter a positive GST amount or 0.00",
      String(gstParsed.value)
    );
  }

  const rawTdsVal = rawValues.tdsTcsAmount !== undefined ? rawValues.tdsTcsAmount : raw.tdsTcsAmount;
  const tdsParsed = parseNumericCell(rawTdsVal);

  if (!tdsParsed.isNumeric) {
    addError(
      "tdsTcsAmount",
      "NON_NUMERIC_AMOUNT",
      `TDS/TCS Amount '${tdsParsed.rawString}' must be numeric`,
      "Enter a valid numeric amount or 0.00",
      tdsParsed.rawString
    );
  } else if (tdsParsed.value < 0) {
    addError(
      "tdsTcsAmount",
      "NEGATIVE_AMOUNT",
      `TDS/TCS Amount cannot be negative (${tdsParsed.value})`,
      "Enter a positive TDS/TCS amount or 0.00",
      String(tdsParsed.value)
    );
  }

  // 6. Paid By validation for Pre-Company personal payments
  const isPersonal =
    raw.bankOrCash === "Personal Bank" ||
    raw.bankOrCash === "Personal Cash" ||
    raw.paymentSource === "Personal Bank" ||
    raw.paymentSource === "Personal Cash";

  if (origin === "PRE_COMPANY" && isPersonal) {
    const rawPaidByVal = rawValues.paidBy !== undefined ? rawValues.paidBy : raw.paidBy;
    const paidByStr = String(rawPaidByVal ?? "").trim();
    if (!paidByStr) {
      addError(
        "paidBy",
        "MISSING_PAID_BY",
        "Paid By is required for personal payments in Pre-Company transactions",
        "Enter the name of the founder or director who paid this expense (e.g. 'Alan')",
        ""
      );
    }
  }

  const isValid = errorItems.length === 0;

  return {
    isValid,
    parsedDate,
    debit,
    credit,
    fieldErrors,
    errorItems,
    warnings,
  };
}

/**
 * Validate batch of parsed Excel rows into ExcelValidationSummary
 * Preserves exact Excel worksheet row numbers and collects actionable error items
 */
export function validateExcelRows(
  rawRows: (Partial<ExcelAccountingRow> & {
    __excelRowNumber?: number;
    __sheetName?: string;
    __rawValues?: Record<string, unknown>;
  })[],
  filename: string,
  options?: { origin?: "COMPANY" | "PRE_COMPANY" }
): ExcelValidationSummary {
  const validatedRows: ExcelRowValidationResult[] = [];
  const allErrors: ExcelValidationErrorItem[] = [];
  let validCount = 0;
  let invalidRowCount = 0;
  let warningCount = 0;
  const isPreCompany = options?.origin === "PRE_COMPANY";
  let firstSheetName = "Sheet1";
  const seenDates = new Map<string, number>();

  for (let idx = 0; idx < rawRows.length; idx++) {
    const raw = rawRows[idx];
    // Exact Excel row number from parsing metadata, with fallback to 1-based sequential
    const rowNumber = raw.__excelRowNumber ?? idx + 2;
    const sheetName = raw.__sheetName ?? "Sheet1";
    if (idx === 0) firstSheetName = sheetName;

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
        // In Pre-Company mode, default to Personal Bank
        bankOrCash = "Personal Bank";
        paymentSource = "Personal Bank";
      }
    } else {
      if (rawBankCash.includes("cash")) {
        bankOrCash = "Cash";
        paymentSource = "Company Cash";
      } else if (
        rawBankCash.includes("bank") ||
        rawBankCash.includes("hdfc") ||
        rawBankCash.includes("sbi") ||
        rawBankCash.includes("icici")
      ) {
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
      {
        origin: isPreCompany ? "PRE_COMPANY" : "COMPANY",
        rowNumber,
        sheetName,
        rawValues: raw.__rawValues,
      }
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
      slNo: raw.slNo || idx + 1,
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
      __excelRowNumber: rowNumber,
      __sheetName: sheetName,
      __rawValues: raw.__rawValues,
    };

    // Check for duplicate transaction dates within the same Excel file
    if (validation.parsedDate) {
      const cal = getISTCalendarDate(validation.parsedDate);
      if (cal) {
        if (seenDates.has(cal.dateStr)) {
          const prevRow = seenDates.get(cal.dateStr)!;
          const dupError = `Duplicate transaction date: ${cal.displayDate}. Another transaction in row ${prevRow} has the same date.`;
          const dupHowToFix = `A transaction should not be allowed if a transaction already exists on the same date. Row ${prevRow} also has date ${cal.displayDate}. Ensure all transactions have distinct dates.`;
          validation.fieldErrors["date"] = dupError;
          const errorItem: ExcelValidationErrorItem = {
            sheetName,
            rowNumber,
            field: "date",
            columnHeader: getColumnHeaderForField("date"),
            currentValue: cal.displayDate,
            code: "DUPLICATE_DATE_IN_FILE",
            error: dupError,
            howToFix: dupHowToFix,
            message: dupError,
            suggestion: dupHowToFix,
          };
          validation.errorItems.push(errorItem);
          validation.isValid = false;
        } else {
          seenDates.set(cal.dateStr, rowNumber);
        }
      }
    }

    const errors = validation.errorItems.map((e) => e.error);

    if (validation.isValid) {
      validCount++;
    } else {
      invalidRowCount++;
      allErrors.push(...validation.errorItems);
    }

    if (validation.warnings.length > 0) {
      warningCount++;
    }

    validatedRows.push({
      rowNumber,
      sheetName,
      isValid: validation.isValid,
      data: cleanData,
      rawValues: raw.__rawValues,
      errors,
      errorItems: validation.errorItems,
      warnings: validation.warnings,
    });
  }

  return {
    filename,
    sheetName: firstSheetName,
    origin: isPreCompany ? "PRE_COMPANY" : "COMPANY",
    totalRows: rawRows.length,
    validCount,
    invalidRowCount,
    totalErrorsCount: allErrors.length,
    warningCount,
    errorCount: invalidRowCount, // Backward compatibility
    rows: validatedRows,
    allErrors,
  };
}
