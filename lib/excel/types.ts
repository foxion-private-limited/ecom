export interface ExcelAccountingRow {
  slNo?: number | string;
  date: string | Date;
  description: string;
  category: string;
  debit: number;
  credit: number;
  paymentMode: string;
  bankOrCash: "Bank" | "Cash" | "Personal Bank" | "Personal Cash" | "N/A";
  paymentSource?: "Company Bank" | "Company Cash" | "Personal Bank" | "Personal Cash" | "Other";
  transactionOrigin?: "COMPANY" | "PRE_COMPANY";
  partyName?: string;
  paidBy?: string;
  invoiceOrderId?: string;
  gstApplicable: boolean;
  gstAmount: number;
  tdsTcsAmount: number;
  balance?: number;
  remarks?: string;
  billAvailable: boolean;
  // Metadata preserved during parsing
  __excelRowNumber?: number;
  excelRowNumber?: number;
  __sheetName?: string;
  sheetName?: string;
  __rawValues?: Record<string, unknown>;
}

export interface ParsedExcelRow {
  excelRowNumber: number; // 1-based actual Excel row number (including header row)
  sheetName: string;
  data: Partial<ExcelAccountingRow>;
  rawValues: Record<string, unknown>;
}

export interface ExcelValidationErrorItem {
  sheetName: string;
  rowNumber: number; // Actual 1-based Excel row number (including header)
  field: string; // Field key, e.g. "date", "debit", "description"
  columnHeader: string; // Excel column name, e.g. "Date", "Debit", "Description"
  currentValue: string; // The exact value read from the Excel file
  code: string; // Machine-readable error code
  error: string; // Clear explanation of what is wrong
  howToFix: string; // Specific guidance on expected value or format
  // Aliases for compatibility
  message?: string;
  suggestion?: string;
}

export interface ExcelRowValidationResult {
  rowNumber: number; // Actual 1-based Excel row number
  sheetName: string;
  isValid: boolean;
  data: ExcelAccountingRow;
  rawValues?: Record<string, unknown>;
  errors: string[]; // List of error message strings
  errorItems: ExcelValidationErrorItem[]; // Detailed structured error items
  warnings: string[];
}

export interface EditableImportRow {
  id: string;
  slNo: number;
  excelRowNumber?: number; // Actual 1-based Excel row number
  sheetName?: string;
  date: string; // strictly DD/MM/YYYY
  rawDate: Date;
  description: string;
  category: string;
  debit: number;
  credit: number;
  paymentMode: string;
  bankOrCash: "Bank" | "Cash" | "Personal Bank" | "Personal Cash" | "N/A";
  paymentSource?: "Company Bank" | "Company Cash" | "Personal Bank" | "Personal Cash" | "Other";
  transactionOrigin: "COMPANY" | "PRE_COMPANY";
  partyName: string;
  paidBy: string;
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
  errorItems?: ExcelValidationErrorItem[];
  warnings: string[];
}

export interface ExcelValidationSummary {
  filename: string;
  sheetName?: string;
  origin?: "COMPANY" | "PRE_COMPANY";
  totalRows: number; // Total data rows examined
  validCount: number; // Valid rows count
  invalidRowCount: number; // Rows containing errors count
  totalErrorsCount: number; // Total individual validation errors count across all rows
  warningCount: number;
  errorCount: number; // Backward compatibility (same as invalidRowCount)
  rows: ExcelRowValidationResult[];
  allErrors: ExcelValidationErrorItem[]; // All individual error items for reporting and export
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
  "Paid By",
  "Invoice/orderId",
  "GST Applicable",
  "GST Amount",
  "TDS/TCS",
  "Balance",
  "Remarks",
  "Bill Available",
] as const;
