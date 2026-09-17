import * as XLSX from "xlsx";
import { ExcelAccountingRow } from "./types";

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
    case "partyname":
    case "party":
    case "vendor":
    case "customer":
      return "partyName";
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
 * Safely parse date from Excel cell (serial number or string)
 */
export function parseExcelDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;

  // If numeric (Excel serial date number)
  if (typeof val === "number") {
    // Excel base date offset
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isNaN(date.getTime()) ? null : date;
  }

  if (typeof val === "string") {
    const trimmed = val.trim();
    // Try DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      let year = parseInt(dmyMatch[3], 10);
      if (year < 100) year += 2000;
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }

    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

/**
 * Parse raw excel buffer into normalized rows
 */
export function parseExcelBuffer(buffer: Buffer | ArrayBuffer): {
  headers: string[];
  rows: Partial<ExcelAccountingRow>[];
} {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Excel file has no worksheets");
  }

  const sheet = workbook.Sheets[sheetName];
  const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
    dateNF: "yyyy-mm-dd",
  });

  if (!rawData || rawData.length === 0) {
    return { headers: [], rows: [] };
  }

  // Find the header row (first non-empty row)
  let headerRowIndex = 0;
  while (
    headerRowIndex < rawData.length &&
    (!rawData[headerRowIndex] ||
      rawData[headerRowIndex].every((c) => !c || String(c).trim() === ""))
  ) {
    headerRowIndex++;
  }

  if (headerRowIndex >= rawData.length) {
    return { headers: [], rows: [] };
  }

  const rawHeaders = rawData[headerRowIndex].map((h) => String(h).trim());
  const mappedHeaders = rawHeaders.map(normalizeHeader);

  const rows: Partial<ExcelAccountingRow>[] = [];

  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.every((c) => c === "" || c === null || c === undefined)) {
      continue; // Skip empty rows
    }

    const rowObj: any = {};
    for (let j = 0; j < mappedHeaders.length; j++) {
      const field = mappedHeaders[j];
      if (field) {
        rowObj[field] = row[j];
      }
    }

    rows.push(rowObj);
  }

  return { headers: rawHeaders, rows };
}
