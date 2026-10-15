import * as XLSX from "xlsx";
import { ExcelAccountingRow, ParsedExcelRow, ExcelValidationErrorItem } from "./types";
import { parseIndianDate } from "@/lib/utils";

/**
 * Normalize header key to match expected field name
 */
export function normalizeHeader(header: string): string {
  const clean = header.toLowerCase().replace(/[^a-z0-9]/g, "");
  switch (clean) {
    case "slno":
    case "srno":
    case "serialno":
    case "sno":
      return "slNo";
    case "date":
    case "txndate":
    case "transactiondate":
      return "date";
    case "description":
    case "narration":
    case "particulars":
    case "desc":
      return "description";
    case "category":
    case "head":
    case "expensehead":
      return "category";
    case "incomeexpense":
    case "type":
    case "incometype":
      return "incomeExpense";
    case "debit":
    case "dr":
    case "withdrawal":
    case "expense":
      return "debit";
    case "credit":
    case "cr":
    case "deposit":
    case "income":
      return "credit";
    case "paymentmode":
    case "mode":
    case "modeofpayment":
      return "paymentMode";
    case "bankcash":
    case "bankorcash":
    case "account":
    case "bank":
      return "bankOrCash";
    case "paymentsource":
    case "sourceofpayment":
      return "paymentSource";
    case "partyname":
    case "party":
    case "vendor":
    case "customer":
      return "partyName";
    case "paidby":
    case "paidbyname":
    case "payer":
      return "paidBy";
    case "transactionorigin":
    case "origin":
    case "period":
    case "transactionperiod":
      return "transactionOrigin";
    case "invoiceorderid":
    case "invoiceid":
    case "orderid":
    case "invoiceno":
    case "billno":
      return "invoiceOrderId";
    case "gstapplicable":
    case "gst":
    case "taxapplicable":
      return "gstApplicable";
    case "gstamount":
    case "taxamount":
    case "gstamt":
      return "gstAmount";
    case "tdstcs":
    case "tds":
    case "tcs":
    case "tdstcsamount":
      return "tdsTcsAmount";
    case "balance":
    case "closingbalance":
      return "balance";
    case "remarks":
    case "notes":
    case "comment":
      return "remarks";
    case "billavailable":
    case "bill":
    case "invoiceavailable":
    case "attachment":
      return "billAvailable";
    default:
      return header;
  }
}

/**
 * Returns human-readable column name for a given field key
 */
export function getColumnHeaderForField(field: string): string {
  switch (field) {
    case "date":
      return "Date";
    case "description":
      return "Description";
    case "category":
      return "Category";
    case "debit":
      return "Debit";
    case "credit":
      return "Credit";
    case "amount":
      return "Debit / Credit";
    case "paymentMode":
      return "Payment Mode";
    case "bankOrCash":
      return "Bank/Cash";
    case "partyName":
      return "Party Name";
    case "paidBy":
      return "Paid By";
    case "invoiceOrderId":
      return "Invoice/orderId";
    case "gstApplicable":
      return "GST Applicable";
    case "gstAmount":
      return "GST Amount";
    case "tdsTcsAmount":
      return "TDS/TCS";
    case "remarks":
      return "Remarks";
    case "billAvailable":
      return "Bill Available";
    default:
      return field.charAt(0).toUpperCase() + field.slice(1);
  }
}

/**
 * Safely parse date from Excel cell (serial number, Date object, or DD/MM/YYYY string)
 */
export function parseExcelDate(val: string | number | Date | null | undefined): Date | null {
  return parseIndianDate(val);
}

/**
 * Parse raw excel buffer into normalized rows preserving original worksheet row numbers
 */
export function parseExcelBuffer(buffer: Buffer | ArrayBuffer): {
  headers: string[];
  sheetName: string;
  sheetNames: string[];
  rows: (Partial<ExcelAccountingRow> & {
    __excelRowNumber: number;
    excelRowNumber: number;
    __sheetName: string;
    sheetName: string;
    __rawValues: Record<string, unknown>;
  })[];
  parsedRows: ParsedExcelRow[];
} {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheetNames = workbook.SheetNames || [];
  const sheetName = sheetNames[0];
  if (!sheetName) {
    throw new Error("Excel file has no worksheets");
  }

  const sheet = workbook.Sheets[sheetName];
  // header: 1 returns 2D array of rows
  const rawData = XLSX.utils.sheet_to_json<Array<string | number | boolean | Date | undefined>>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });

  if (!rawData || rawData.length === 0) {
    return { headers: [], sheetName, sheetNames, rows: [], parsedRows: [] };
  }

  // Find the header row (first non-empty row)
  let headerRowIndex = 0;
  while (
    headerRowIndex < rawData.length &&
    (!rawData[headerRowIndex] ||
      rawData[headerRowIndex].every((c) => c === "" || c === null || c === undefined))
  ) {
    headerRowIndex++;
  }

  if (headerRowIndex >= rawData.length) {
    return { headers: [], sheetName, sheetNames, rows: [], parsedRows: [] };
  }

  const rawHeaders = rawData[headerRowIndex].map((h) => String(h ?? "").trim());
  const mappedHeaders = rawHeaders.map(normalizeHeader);

  const rows: (Partial<ExcelAccountingRow> & {
    __excelRowNumber: number;
    excelRowNumber: number;
    __sheetName: string;
    sheetName: string;
    __rawValues: Record<string, unknown>;
  })[] = [];

  const parsedRows: ParsedExcelRow[] = [];

  // Iterate over data rows starting immediately after the header row
  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    // In Excel, rows are 1-based. Since i is 0-indexed in the sheet, the exact Excel row is i + 1.
    const excelRowNumber = i + 1;

    // Check if row is completely empty
    if (!row || row.every((c) => c === "" || c === null || c === undefined)) {
      continue; // Skip blank row, but excelRowNumber remains strictly aligned with actual row in worksheet
    }

    const rowObj: Record<string, unknown> = {};
    const rawValues: Record<string, unknown> = {};

    for (let j = 0; j < mappedHeaders.length; j++) {
      const field = mappedHeaders[j];
      const rawVal = row[j];
      if (field) {
        rowObj[field] = rawVal;
        rawValues[field] = rawVal;
        // Also map under raw header name
        if (rawHeaders[j]) {
          rawValues[rawHeaders[j]] = rawVal;
        }
      }
    }

    // Attach row metadata for validation and reporting
    rowObj.__excelRowNumber = excelRowNumber;
    rowObj.excelRowNumber = excelRowNumber;
    rowObj.__sheetName = sheetName;
    rowObj.sheetName = sheetName;
    rowObj.__rawValues = rawValues;

    rows.push(rowObj as unknown as Partial<ExcelAccountingRow> & {
      __excelRowNumber: number;
      excelRowNumber: number;
      __sheetName: string;
      sheetName: string;
      __rawValues: Record<string, unknown>;
    });

    parsedRows.push({
      excelRowNumber,
      sheetName,
      data: rowObj as unknown as Partial<ExcelAccountingRow>,
      rawValues,
    });
  }

  return { headers: rawHeaders, sheetName, sheetNames, rows, parsedRows };
}

/**
 * Sanitize a string against CSV formula injection.
 * If a cell begins with '=', '+', '-', '@', '\t', '\r', prefix with a single quote.
 */
function sanitizeForCsv(value: string): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (
    trimmed.startsWith("=") ||
    trimmed.startsWith("+") ||
    trimmed.startsWith("-") ||
    trimmed.startsWith("@") ||
    trimmed.startsWith("\t") ||
    trimmed.startsWith("\r")
  ) {
    return `'${value}`;
  }
  return value;
}

/**
 * Escape a cell value for standard CSV formatting.
 */
function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = sanitizeForCsv(String(val));
  // If the cell contains quotes, commas, or newlines, wrap in quotes and double any internal quotes
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Generate a downloadable, formula-injection safe CSV error report.
 * Columns: Worksheet, Excel Row, Field / Column, Current Value, Error, How to Fix
 */
export function generateValidationErrorReportCsv(errors: ExcelValidationErrorItem[]): string {
  const header = ["Worksheet", "Excel Row", "Field / Column", "Current Value", "Error", "How to Fix"];
  const lines: string[] = [header.map(escapeCsvCell).join(",")];

  for (const err of errors) {
    const row = [
      err.sheetName || "Sheet1",
      String(err.rowNumber),
      err.columnHeader || err.field,
      err.currentValue || "",
      err.error,
      err.howToFix,
    ];
    lines.push(row.map(escapeCsvCell).join(","));
  }

  // Prepend UTF-8 BOM so Excel opens the CSV correctly with proper encoding
  return "\uFEFF" + lines.join("\r\n");
}
