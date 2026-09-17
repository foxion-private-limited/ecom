import {
  ExcelAccountingRow,
  ExcelRowValidationResult,
  ExcelValidationSummary,
} from "./types";
import { parseExcelDate } from "./excelParser";

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
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Validate Date
    const parsedDate = parseExcelDate(raw.date);
    if (!parsedDate) {
      errors.push("Invalid or missing date");
    }

    // 2. Validate Description
    const desc = String(raw.description || "").trim();
    if (!desc) {
      errors.push("Description is required");
    }

    // 3. Validate Category
    const category = String(raw.category || "").trim();
    if (!category) {
      errors.push("Category is required");
    }

    // 4. Validate Debit & Credit
    const rawDebit: any = raw.debit;
    const rawCredit: any = raw.credit;

    const debit =
      rawDebit === "" || rawDebit === null || rawDebit === undefined
        ? 0
        : Number(String(rawDebit).replace(/[^0-9.-]+/g, ""));
    const credit =
      rawCredit === "" || rawCredit === null || rawCredit === undefined
        ? 0
        : Number(String(rawCredit).replace(/[^0-9.-]+/g, ""));

    if (isNaN(debit) || debit < 0) {
      errors.push("Debit must be a valid non-negative number");
    }
    if (isNaN(credit) || credit < 0) {
      errors.push("Credit must be a valid non-negative number");
    }

    if (debit === 0 && credit === 0) {
      errors.push("Either Debit or Credit must be greater than 0");
    }

    if (debit > 0 && credit > 0) {
      warnings.push("Both Debit and Credit are non-zero in the same row");
    }

    // 5. Validate Bank/Cash
    let bankOrCash: "Bank" | "Cash" | "N/A" = "Bank";
    const rawBankCash = String(raw.bankOrCash || "").trim().toLowerCase();
    if (rawBankCash.includes("cash")) {
      bankOrCash = "Cash";
    } else if (rawBankCash.includes("bank") || rawBankCash.includes("hdfc") || rawBankCash.includes("sbi") || rawBankCash.includes("icici")) {
      bankOrCash = "Bank";
    } else if (rawBankCash === "n/a" || rawBankCash === "na") {
      bankOrCash = "N/A";
    } else if (rawBankCash !== "") {
      warnings.push(`Unrecognized Bank/Cash value: "${raw.bankOrCash}". Defaulted to Bank`);
    }

    // 6. Payment Mode
    const paymentMode = String(raw.paymentMode || "").trim() || (bankOrCash === "Cash" ? "Cash" : "Bank Transfer");

    // 7. GST & TDS
    const gstApplicableRaw = String(raw.gstApplicable || "").trim().toLowerCase();
    const gstApplicable =
      gstApplicableRaw === "yes" ||
      gstApplicableRaw === "y" ||
      gstApplicableRaw === "true" ||
      gstApplicableRaw === "1";

    const rawGst: any = raw.gstAmount;
    const gstAmount =
      rawGst === "" || rawGst === null || rawGst === undefined
        ? 0
        : Math.max(0, Number(String(rawGst).replace(/[^0-9.-]+/g, "")) || 0);

    const rawTds: any = raw.tdsTcsAmount;
    const tdsTcsAmount =
      rawTds === "" || rawTds === null || rawTds === undefined
        ? 0
        : Math.max(0, Number(String(rawTds).replace(/[^0-9.-]+/g, "")) || 0);

    // 8. Bill Available
    const billRaw = String(raw.billAvailable || "").trim().toLowerCase();
    const billAvailable =
      billRaw === "yes" ||
      billRaw === "y" ||
      billRaw === "true" ||
      billRaw === "1" ||
      billRaw.includes("available");

    // Cleaned data
    const cleanData: ExcelAccountingRow = {
      slNo: raw.slNo || rowNumber - 1,
      date: parsedDate || new Date(),
      description: desc,
      category: category,
      debit: isNaN(debit) ? 0 : debit,
      credit: isNaN(credit) ? 0 : credit,
      paymentMode,
      bankOrCash,
      partyName: String(raw.partyName || "").trim(),
      invoiceOrderId: String(raw.invoiceOrderId || "").trim(),
      gstApplicable,
      gstAmount,
      tdsTcsAmount,
      remarks: String(raw.remarks || "").trim(),
      billAvailable,
    };

    const isValid = errors.length === 0;
    if (isValid) {
      validCount++;
    } else {
      errorCount++;
    }

    if (warnings.length > 0) {
      warningCount++;
    }

    validatedRows.push({
      rowNumber,
      isValid,
      data: cleanData,
      errors,
      warnings,
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
