import * as XLSX from "xlsx";
import { formatIndianDate } from "@/lib/utils";
import { EXCEL_COLUMNS } from "./types";

export interface TransactionExportItem {
  _id?: any;
  date: Date | string;
  description: string;
  category: string;
  debit: number;
  credit: number;
  paymentMode: string;
  bankOrCash: "Bank" | "Cash" | "N/A";
  partyName?: string;
  invoiceOrderId?: string;
  gstApplicable?: boolean;
  gstAmount?: number;
  tdsTcsAmount?: number;
  remarks?: string;
  billAvailable?: boolean;
}

/**
 * Generate Excel workbook buffer with exact 16-column template and calculated balances
 */
export function generateAccountingExcel(
  transactions: TransactionExportItem[],
  sheetTitle: string = "Foxion Accounts"
): Buffer {
  // Sort chronologically ascending to calculate running balance correctly
  const sorted = [...transactions].sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    return da - db;
  });

  let runningBalance = 0;
  const rows = sorted.map((tx, idx) => {
    const debit = Number(tx.debit) || 0;
    const credit = Number(tx.credit) || 0;
    runningBalance += credit - debit;

    return {
      "Sl No": idx + 1,
      Date: formatIndianDate(tx.date),
      Description: tx.description || "",
      Category: tx.category || "",
      Debit: debit,
      Credit: credit,
      "Payment Mode": tx.paymentMode || "",
      "Bank/Cash": tx.bankOrCash || "Bank",
      "Party Name": tx.partyName || "",
      "Invoice/orderId": tx.invoiceOrderId || "",
      "GST Applicable": tx.gstApplicable ? "Yes" : "No",
      "GST Amount": Number(tx.gstAmount) || 0,
      "TDS/TCS": Number(tx.tdsTcsAmount) || 0,
      Balance: runningBalance,
      Remarks: tx.remarks || "",
      "Bill Available": tx.billAvailable ? "Yes" : "No",
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: [...EXCEL_COLUMNS],
  });

  // Set column widths for optimal readability
  const colWidths = [
    { wch: 8 },  // Sl No
    { wch: 14 }, // Date
    { wch: 32 }, // Description
    { wch: 20 }, // Category
    { wch: 14 }, // Debit
    { wch: 14 }, // Credit
    { wch: 16 }, // Payment Mode
    { wch: 12 }, // Bank/Cash
    { wch: 24 }, // Party Name
    { wch: 20 }, // Invoice/orderId
    { wch: 14 }, // GST Applicable
    { wch: 14 }, // GST Amount
    { wch: 12 }, // TDS/TCS
    { wch: 16 }, // Balance
    { wch: 28 }, // Remarks
    { wch: 14 }, // Bill Available
  ];
  worksheet["!cols"] = colWidths;

  // Freeze top row
  worksheet["!views"] = [{ state: "frozen", ySplit: 1 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetTitle.slice(0, 31));

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return buffer;
}
