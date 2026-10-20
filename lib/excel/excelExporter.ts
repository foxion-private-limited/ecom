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

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export type ExportScopeType = "ALL" | "MONTH" | "RANGE";

export interface ExportFilenameOptions {
  scope?: ExportScopeType | string;
  month?: number | string;
  year?: number | string;
  startDate?: string | Date;
  endDate?: string | Date;
  origin?: "COMPANY" | "PRE_COMPANY" | string;
}

/**
 * Format a date string or Date object into DD-MM-YYYY without timezone conversion drift.
 * Safely handles YYYY-MM-DD input strings without shifting dates across timezones.
 */
export function formatDateForFilename(dateInput: string | Date): string {
  if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    // YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss...
    const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymdMatch) {
      const [, yyyy, mm, dd] = ymdMatch;
      return `${dd}-${mm}-${yyyy}`;
    }
    // DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dmyMatch) {
      const [, dd, mm, yyyy] = dmyMatch;
      return `${dd.padStart(2, "0")}-${mm.padStart(2, "0")}-${yyyy}`;
    }
  }

  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = String(d.getUTCFullYear());
    return `${dd}-${mm}-${yyyy}`;
  }

  return String(dateInput).replace(/[^a-zA-Z0-9_-]/g, "_");
}

/**
 * Generates dynamic filename for Excel exports according to selected mode:
 * 1. Month: {Month}_{Year}_Foxion.xlsx (e.g. August_2026_Foxion.xlsx)
 * 2. Custom Date Range: {DD-MM-YYYY}__{DD-MM-YYYY}_Foxion.xlsx (e.g. 01-03-2026__31-03-2026_Foxion.xlsx)
 * 3. All Transactions: complete_foxion_accounts.xlsx (lowercase, no timestamp)
 */
export function getAccountingExportFilename(options: ExportFilenameOptions = {}): string {
  const { scope, month, year, startDate, endDate, origin } = options;

  // 1. Export by Month: {Month}_{Year}_Foxion.xlsx
  const isMonthScope =
    scope === "MONTH" ||
    (scope === undefined && month !== undefined && year !== undefined);

  if (isMonthScope) {
    let resolvedMonthName = "";
    let resolvedYear = year ? String(year).trim() : "";

    if (month !== undefined) {
      if (typeof month === "number" || /^\d+$/.test(String(month).trim())) {
        const mNum = Number(month);
        // 1-based (1..12) or 0-based (0..11)
        if (mNum >= 1 && mNum <= 12) {
          resolvedMonthName = MONTH_NAMES[mNum - 1];
        } else if (mNum >= 0 && mNum <= 11) {
          resolvedMonthName = MONTH_NAMES[mNum];
        }
      } else if (typeof month === "string") {
        const found = MONTH_NAMES.find(
          (m) => m.toLowerCase() === month.trim().toLowerCase()
        );
        if (found) resolvedMonthName = found;
      }
    }

    // Fallback: extract month & year from startDate if not explicitly given
    if ((!resolvedMonthName || !resolvedYear) && startDate) {
      const s = String(startDate);
      const ymd = s.match(/^(\d{4})-(\d{2})/);
      if (ymd) {
        if (!resolvedYear) resolvedYear = ymd[1];
        if (!resolvedMonthName) {
          const mIdx = parseInt(ymd[2], 10) - 1;
          if (mIdx >= 0 && mIdx < 12) resolvedMonthName = MONTH_NAMES[mIdx];
        }
      }
    }

    if (resolvedMonthName && resolvedYear) {
      return `${resolvedMonthName}_${resolvedYear}_Foxion.xlsx`;
    }
  }

  // 2. Export by Custom Date Range: {DD-MM-YYYY}__{DD-MM-YYYY}_Foxion.xlsx
  const isRangeScope =
    scope === "RANGE" ||
    (Boolean(startDate && endDate) && scope !== "ALL" && !isMonthScope);

  if (isRangeScope && startDate && endDate) {
    const startFormatted = formatDateForFilename(startDate);
    const endFormatted = formatDateForFilename(endDate);
    return `${startFormatted}__${endFormatted}_Foxion.xlsx`;
  }

  // 3. Export All Transactions: complete_foxion_accounts.xlsx
  if (origin === "PRE_COMPANY") {
    return "complete_foxion_pre_company.xlsx";
  }
  return "complete_foxion_accounts.xlsx";
}

