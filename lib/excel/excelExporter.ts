import * as XLSX from "xlsx";
import { formatIndianDate } from "@/lib/utils";
import { EXCEL_COLUMNS } from "./types";

export interface TransactionExportItem {
  _id?: string | unknown;
  date: Date | string;
  createdAt?: Date | string;
  description: string;
  category: string;
  debit: number;
  credit: number;
  balance?: number;
  calculatedBalance?: number;
  paymentMode: string;
  bankOrCash: "Bank" | "Cash" | "Personal Bank" | "Personal Cash" | "N/A";
  paymentSource?: string;
  transactionOrigin?: "COMPANY" | "PRE_COMPANY";
  partyName?: string;
  paidBy?: string;
  invoiceOrderId?: string;
  gstApplicable?: boolean;
  gstAmount?: number;
  tdsTcsAmount?: number;
  remarks?: string;
  billAvailable?: boolean;
}

/**
 * Generate Excel workbook buffer with exact 16/17-column template and preserved frontend balances
 */
export function generateAccountingExcel(
  transactions: TransactionExportItem[],
  sheetTitle: string = "Foxion Accounts"
): Buffer {
  // Sort chronologically ascending, matching ledger order: date, then createdAt, then _id
  const sorted = [...transactions].sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    if (da !== db) return da - db;
    if (a.createdAt && b.createdAt) {
      const ca = new Date(a.createdAt).getTime();
      const cb = new Date(b.createdAt).getTime();
      if (ca !== cb) return ca - cb;
    }
    const idA = String(a._id || "");
    const idB = String(b._id || "");
    return idA.localeCompare(idB);
  });

  let fallbackRunningBalance = 0;
  const rows = sorted.map((tx, idx) => {
    const debit = Number(tx.debit) || 0;
    const credit = Number(tx.credit) || 0;

    // The frontend's displayed balance (calculatedBalance) is authoritative.
    // Excel export must contain exactly the same balance for each corresponding transaction.
    let balanceVal: number;
    if (typeof tx.calculatedBalance === "number" && !isNaN(tx.calculatedBalance)) {
      balanceVal = tx.calculatedBalance;
    } else if (typeof tx.balance === "number" && !isNaN(tx.balance)) {
      balanceVal = tx.balance;
    } else {
      fallbackRunningBalance += credit - debit;
      balanceVal = fallbackRunningBalance;
    }

    return {
      "Sl No": idx + 1,
      Date: formatIndianDate(tx.date),
      Description: tx.description || "",
      Category: tx.category || "",
      Debit: debit,
      Credit: credit,
      "Payment Mode": tx.paymentMode || "",
      "Bank/Cash": tx.paymentSource || tx.bankOrCash || "Bank",
      "Party Name": tx.partyName || "",
      "Paid By": tx.paidBy || "",
      "Invoice/orderId": tx.invoiceOrderId || "",
      "GST Applicable": tx.gstApplicable ? "Yes" : "No",
      "GST Amount": Number(tx.gstAmount) || 0,
      "TDS/TCS": Number(tx.tdsTcsAmount) || 0,
      Balance: balanceVal,
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
    { wch: 16 }, // Bank/Cash
    { wch: 24 }, // Party Name
    { wch: 18 }, // Paid By
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
