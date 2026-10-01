import * as XLSX from "xlsx";
import { ExcelAccountingRow } from "./types";
import { parseIndianDate } from "@/lib/utils";

/**
 * Normalize header key to match expected field name
 */
function normalizeHeader(header: string): string {
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
 * Safely parse date from Excel cell (serial number, Date object, or DD/MM/YYYY string)
 */
export function parseExcelDate(val: string | number | Date | null | undefined): Date | null {
  return parseIndianDate(val);
}

/**
 * Parse raw excel buffer into normalized rows
 */
export function parseExcelBuffer(buffer: Buffer | ArrayBuffer): {
  headers: string[];
  rows: Partial<ExcelAccountingRow>[];
} {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Excel file has no worksheets");
  }

  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json<Array<string | number | undefined>>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });

  if (!rawData || rawData.length === 0) {
    return { headers: [], rows: [] };
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
    return { headers: [], rows: [] };
  }

  const rawHeaders = rawData[headerRowIndex].map((h) => String(h || "").trim());
  const mappedHeaders = rawHeaders.map(normalizeHeader);

  const rows: Partial<ExcelAccountingRow>[] = [];

  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.every((c) => c === "" || c === null || c === undefined)) {
      continue; // Skip empty rows
    }

    const rowObj: Record<string, string | number | boolean | Date | undefined> = {};
    for (let j = 0; j < mappedHeaders.length; j++) {
      const field = mappedHeaders[j];
      if (field) {
        rowObj[field] = row[j];
      }
    }

    rows.push(rowObj as unknown as Partial<ExcelAccountingRow>);
  }

  return { headers: rawHeaders, rows };
}
