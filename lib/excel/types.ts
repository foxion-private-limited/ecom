export interface ExcelAccountingRow {
  slNo?: number | string;
  date: string | Date;
  description: string;
  category: string;
  debit: number;
  credit: number;
  paymentMode: string;
  bankOrCash: "Bank" | "Cash" | "N/A";
  partyName?: string;
  invoiceOrderId?: string;
  gstApplicable: boolean;
  gstAmount: number;
  tdsTcsAmount: number;
  balance?: number;
  remarks?: string;
  billAvailable: boolean;
}

export interface ExcelRowValidationResult {
  rowNumber: number;
  isValid: boolean;
  data: ExcelAccountingRow;
  errors: string[];
  warnings: string[];
}

export interface EditableImportRow {
  id: string;
  slNo: number;
  date: string; // strictly DD/MM/YYYY
  rawDate: Date;
  description: string;
  category: string;
  debit: number;
  credit: number;
  paymentMode: string;
  bankOrCash: "Bank" | "Cash" | "N/A";
  partyName: string;
  invoiceOrderId: string;
  gstApplicable: boolean;
  gstAmount: number;
  tdsTcsAmount: number;
  balance: number; // dynamically computed running balance
  remarks: string;
  billAvailable: boolean;
  isModified?: boolean;
  isNew?: boolean;
  isValid: boolean;
  fieldErrors: Record<string, string>;
  warnings: string[];
}

export interface ExcelValidationSummary {
  filename: string;
  totalRows: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  rows: ExcelRowValidationResult[];
}

export interface ExcelImportResult {
  success: boolean;
  batchId: string;
  importedCount: number;
  skippedCount: number;
  errors: string[];
}

export const EXCEL_COLUMNS = [
  "Sl No",
  "Date",
  "Description",
  "Category",
  "Debit",
  "Credit",
  "Payment Mode",
  "Bank/Cash",
  "Party Name",
  "Invoice/orderId",
  "GST Applicable",
  "GST Amount",
  "TDS/TCS",
  "Balance",
  "Remarks",
  "Bill Available",
] as const;
