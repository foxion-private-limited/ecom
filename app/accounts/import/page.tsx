"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Modal,
} from "@/lib/ui";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowLeft,
  RefreshCw,
  Plus,
  Trash2,
  Copy,
  Edit2,
  Search,
  Filter,
  Check,
  X,
  Calendar,
  Layers,
  ArrowRight,
  Download,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { formatINR, formatIndianDate, parseIndianDate } from "@/lib/utils";
import { IndianDateInput } from "@/components/ui/IndianDateInput";
import { EditableImportRow, ExcelValidationErrorItem, ExcelRowValidationResult } from "@/lib/excel/types";
import { validateSingleRow } from "@/lib/excel/excelValidator";
import { getColumnHeaderForField, generateValidationErrorReportCsv } from "@/lib/excel/excelParser";
import { toast } from "sonner";

const PAYMENT_MODES = [
  "Bank Transfer",
  "UPI",
  "Cash",
  "Card",
  "Cheque",
  "Marketplace",
  "Other",
];

const BANK_CASH_OPTIONS: Array<"Bank" | "Cash" | "Personal Bank" | "Personal Cash" | "N/A"> = [
  "Personal Bank",
  "Personal Cash",
  "Bank",
  "Cash",
  "N/A",
];

function calculateRunningBalances(
  rows: EditableImportRow[],
  startingBalance: number = 0
): EditableImportRow[] {
  // Sort chronologically ascending, preserving stable deterministic Excel row ordering for same-date rows
  const sorted = [...rows].sort((a, b) => {
    const da = a.rawDate ? a.rawDate.getTime() : (parseIndianDate(a.date)?.getTime() || 0);
    const db = b.rawDate ? b.rawDate.getTime() : (parseIndianDate(b.date)?.getTime() || 0);
    if (da !== db) return da - db;
    const rowA = Number(a.excelRowNumber ?? a.slNo ?? 0);
    const rowB = Number(b.excelRowNumber ?? b.slNo ?? 0);
    return rowA - rowB;
  });

  let running = startingBalance;
  return sorted.map((r, idx) => {
    const debit = Number(r.debit) || 0;
    const credit = Number(r.credit) || 0;
    running += credit - debit;
    return {
      ...r,
      slNo: idx + 1,
      balance: running,
    };
  });
}

function ExcelImportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Navigation and Account Context (Single Accounts System)
  const accountType = "MAIN";
  const initialOrigin = searchParams.get("origin") === "PRE_COMPANY" ? "PRE_COMPANY" : "COMPANY";
  const [importOrigin, setImportOrigin] = useState<"COMPANY" | "PRE_COMPANY">(initialOrigin);

  // Workflow steps: 1. UPLOAD, 2. EDIT_PREVIEW, 3. SUCCESS
  const [currentStep, setCurrentStep] = useState<"UPLOAD" | "PREVIEW" | "SUCCESS">("UPLOAD");

  // File and Data state
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<EditableImportRow[]>([]);
  const [originalRowCount, setOriginalRowCount] = useState(0);
  const [openingBalance, setOpeningBalance] = useState<number>(0);

  // In-table Editing State
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: keyof EditableImportRow } | null>(null);
  const [editTempValue, setEditTempValue] = useState<string | number | boolean>("");

  // Categories list for autocomplete
  const [categories, setCategories] = useState<string[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Detailed Error Table Expansion State
  const [isErrorTableExpanded, setIsErrorTableExpanded] = useState(true);

  // Confirmation Modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  // Success summary
  const [successInfo, setSuccessInfo] = useState<{
    importedCount: number;
    modifiedCount: number;
    accountType: string;
    origin?: string;
  } | null>(null);

  // Fetch categories on mount
  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCategories(data.map((c: { name: string }) => c.name));
        }
      })
      .catch(() => {});
  }, []);

  // Upload and Parse handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setParsing(true);

      try {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("origin", importOrigin);

        const res = await fetch("/api/excel/validate", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to parse Excel file");
        }

        const summary = data.summary;
        setOriginalRowCount(summary.totalRows);
        const isPre = importOrigin === "PRE_COMPANY";

        // Convert parsed rows into EditableImportRow array
        const initialRows: EditableImportRow[] = summary.rows.map(
          (r: ExcelRowValidationResult, idx: number) => {
            const raw = r.data;
            const parsedDate = parseIndianDate(raw.date as string | Date) || new Date();
            const dateStr = formatIndianDate(parsedDate);
            const debit = Number(raw.debit) || 0;
            const credit = Number(raw.credit) || 0;
            const paidBy = String(raw.paidBy || "").trim();
            const bankOrCash = (raw.bankOrCash as any) || (isPre ? "Personal Bank" : "Bank");
            const paymentSource = (raw.paymentSource as any) || (isPre ? "Personal Bank" : "Company Bank");

            const validation = validateSingleRow(
              {
                date: dateStr,
                description: String(raw.description || ""),
                category: String(raw.category || ""),
                debit,
                credit,
                bankOrCash,
                paymentSource,
                paidBy,
                transactionOrigin: importOrigin,
                gstAmount: Number(raw.gstAmount) || 0,
                tdsTcsAmount: Number(raw.tdsTcsAmount) || 0,
              },
              {
                origin: importOrigin,
                rowNumber: r.rowNumber,
                sheetName: r.sheetName,
                rawValues: (raw as any).__rawValues || r.rawValues,
              }
            );

            return {
              id: `row-${idx + 1}-${Date.now()}`,
              slNo: idx + 1,
              excelRowNumber: r.rowNumber,
              sheetName: r.sheetName,
              date: dateStr,
              rawDate: parsedDate,
              description: String(raw.description || "").trim(),
              category: String(raw.category || "").trim(),
              debit,
              credit,
              paymentMode: String(raw.paymentMode || (bankOrCash.includes("Cash") ? "Cash" : isPre ? "UPI" : "Bank Transfer")),
              bankOrCash,
              paymentSource,
              transactionOrigin: importOrigin,
              partyName: String(raw.partyName || "").trim(),
              paidBy,
              invoiceOrderId: String(raw.invoiceOrderId || "").trim(),
              gstApplicable: !!raw.gstApplicable,
              gstAmount: Number(raw.gstAmount) || 0,
              tdsTcsAmount: Number(raw.tdsTcsAmount) || 0,
              balance: 0,
              remarks: String(raw.remarks || "").trim(),
              billAvailable: !!raw.billAvailable,
              isModified: false,
              isNew: false,
              isValid: validation.isValid,
              fieldErrors: validation.fieldErrors,
              errorItems: validation.errorItems,
              warnings: validation.warnings,
              __rawValues: (raw as any).__rawValues || r.rawValues,
            };
          }
        );

        const serverOpeningBal = typeof data.openingBalance === "number" ? data.openingBalance : 0;
        setOpeningBalance(serverOpeningBal);

        const balancedRows = calculateRunningBalances(initialRows, serverOpeningBal);
        setRows(balancedRows);
        setCurrentStep("PREVIEW");
        setCurrentPage(1);

        const invalidCount = balancedRows.filter((r) => !r.isValid).length;
        if (invalidCount > 0) {
          setIsErrorTableExpanded(true);
          toast.error(`Validation found ${invalidCount} invalid row${invalidCount > 1 ? "s" : ""}. Review error log below.`);
        } else {
          setIsErrorTableExpanded(false);
          toast.success(`Parsed ${balancedRows.length} rows ready for review.`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to parse file";
        toast.error(message);
      } finally {
        setParsing(false);
      }
    }
  };

  // Revalidate a specific row after edit
  const revalidateRow = (row: EditableImportRow): EditableImportRow => {
    const validation = validateSingleRow(
      {
        date: row.date,
        description: row.description,
        category: row.category,
        debit: row.debit,
        credit: row.credit,
        bankOrCash: row.bankOrCash,
        paymentSource: row.paymentSource,
        paidBy: row.paidBy,
        transactionOrigin: row.transactionOrigin || importOrigin,
        gstAmount: row.gstAmount,
        tdsTcsAmount: row.tdsTcsAmount,
      },
      {
        origin: importOrigin,
        rowNumber: row.excelRowNumber || row.slNo,
        sheetName: row.sheetName || "Sheet1",
        rawValues: (row as any).__rawValues,
      }
    );

    return {
      ...row,
      isValid: validation.isValid,
      fieldErrors: validation.fieldErrors,
      errorItems: validation.errorItems,
      warnings: validation.warnings,
      rawDate: validation.parsedDate || row.rawDate,
    };
  };

  // Cell Edit Handlers
  const startEditing = (rowId: string, field: keyof EditableImportRow, currentVal: unknown) => {
    // Sl No and Balance are NOT manually editable
    if (field === "slNo" || field === "balance" || field === "id") return;
    setEditingCell({ rowId, field });
    setEditTempValue(currentVal as string | number | boolean);
  };

  const saveEditing = () => {
    if (!editingCell) return;
    const { rowId, field } = editingCell;

    setRows((prev) => {
      const updated = prev.map((r) => {
        if (r.id !== rowId) return r;

        let val = editTempValue;
        if (field === "debit" || field === "credit" || field === "gstAmount" || field === "tdsTcsAmount") {
          val = Math.max(0, Number(val) || 0);
        }

        const modifiedRow = {
          ...r,
          [field]: val,
          isModified: true,
        };

        return revalidateRow(modifiedRow);
      });

      return calculateRunningBalances(updated, openingBalance);
    });

    setEditingCell(null);
  };

  const cancelEditing = () => {
    setEditingCell(null);
  };

  // Add Row
  const handleAddRow = () => {
    const todayStr = formatIndianDate(new Date());
    const isPre = importOrigin === "PRE_COMPANY";
    const newRow: EditableImportRow = {
      id: `new-row-${Date.now()}`,
      slNo: rows.length + 1,
      date: todayStr,
      rawDate: new Date(),
      description: isPre ? "Advance for company registration" : "Manual Transaction Entry",
      category: isPre ? "Registration Expense" : categories[0] || "General",
      debit: 0,
      credit: isPre ? 0 : 100,
      paymentMode: isPre ? "UPI" : "Bank Transfer",
      bankOrCash: isPre ? "Personal Bank" : "Bank",
      paymentSource: isPre ? "Personal Bank" : "Company Bank",
      transactionOrigin: importOrigin,
      partyName: "",
      paidBy: isPre ? "Alan Nixon" : "",
      invoiceOrderId: "",
      gstApplicable: false,
      gstAmount: 0,
      tdsTcsAmount: 0,
      balance: 0,
      remarks: "",
      billAvailable: false,
      isModified: true,
      isNew: true,
      isValid: true,
      fieldErrors: {},
      warnings: [],
    };

    const revalidated = revalidateRow(newRow);
    const updated = calculateRunningBalances([revalidated, ...rows], openingBalance);
    setRows(updated);
    setCurrentPage(1);
    toast.success("New transaction row added at the top.");
  };

  // Duplicate Row
  const handleDuplicateRow = (rowId: string) => {
    const targetIdx = rows.findIndex((r) => r.id === rowId);
    if (targetIdx === -1) return;

    const target = rows[targetIdx];
    const duplicated: EditableImportRow = {
      ...target,
      id: `dup-row-${Date.now()}-${Math.random()}`,
      isModified: true,
      isNew: true,
    };

    const newRows = [...rows];
    newRows.splice(targetIdx + 1, 0, revalidateRow(duplicated));
    const balanced = calculateRunningBalances(newRows, openingBalance);
    setRows(balanced);
    toast.success(`Duplicated row #${target.slNo}.`);
  };

  // Delete Row
  const handleDeleteRow = (rowId: string) => {
    const target = rows.find((r) => r.id === rowId);
    if (!target) return;

    if (!confirm(`Delete row #${target.slNo} (${target.description || "transaction"}) from pending import?`)) {
      return;
    }

    const remaining = rows.filter((r) => r.id !== rowId);
    const balanced = calculateRunningBalances(remaining, openingBalance);
    setRows(balanced);
    toast.success(`Removed row #${target.slNo}. Balances recalculated.`);
  };

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    let validCount = 0;
    let errorCount = 0;
    let modifiedCount = 0;
    let totalDebit = 0;
    let totalCredit = 0;

    for (const r of rows) {
      if (r.isValid) validCount++;
      else errorCount++;

      if (r.isModified) modifiedCount++;
      totalDebit += Number(r.debit) || 0;
      totalCredit += Number(r.credit) || 0;
    }

    return {
      totalRows: rows.length,
      validCount,
      invalidRowCount: errorCount,
      errorCount,
      modifiedCount,
      totalDebit,
      totalCredit,
    };
  }, [rows]);

  // All active validation error items across all rows
  const allErrors = useMemo(() => {
    const list: ExcelValidationErrorItem[] = [];
    for (const r of rows) {
      if (r.errorItems && r.errorItems.length > 0) {
        list.push(...r.errorItems);
      } else if (!r.isValid && r.fieldErrors && Object.keys(r.fieldErrors).length > 0) {
        for (const [field, msg] of Object.entries(r.fieldErrors)) {
          list.push({
            sheetName: r.sheetName || "Sheet1",
            rowNumber: r.excelRowNumber || r.slNo,
            field,
            columnHeader: getColumnHeaderForField(field),
            currentValue: String((r as any)[field] ?? ""),
            code: "INVALID_FIELD",
            error: msg,
            howToFix: `Please correct the value in ${getColumnHeaderForField(field)}`,
          });
        }
      }
    }
    return list;
  }, [rows]);

  // Jump to specific Excel row in the table and highlight it
  const handleJumpToRow = (rowNumber: number, fieldToEdit?: string) => {
    const targetIdx = rows.findIndex((r) => (r.excelRowNumber || r.slNo) === rowNumber);
    if (targetIdx === -1) return;

    // Switch to page containing this row
    const targetPage = Math.floor(targetIdx / pageSize) + 1;
    setCurrentPage(targetPage);

    const targetRow = rows[targetIdx];
    if (fieldToEdit && fieldToEdit in targetRow) {
      startEditing(targetRow.id, fieldToEdit as keyof EditableImportRow, (targetRow as any)[fieldToEdit]);
    }

    setTimeout(() => {
      const elem = document.getElementById(`preview-row-${targetRow.id}`);
      if (elem) {
        elem.scrollIntoView({ behavior: "smooth", block: "center" });
        elem.classList.add("ring-2", "ring-rose-500");
        setTimeout(() => elem.classList.remove("ring-2", "ring-rose-500"), 2500);
      }
    }, 120);
  };

  // Export formula-safe CSV error report
  const handleDownloadErrorReport = () => {
    if (allErrors.length === 0) {
      toast.info("No validation errors found in this spreadsheet.");
      return;
    }
    const csvContent = generateValidationErrorReportCsv(allErrors);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const rawFileName = file?.name ? file.name.replace(/\.[^/.]+$/, "") : "accounts_import";
    link.href = url;
    link.setAttribute("download", `error_report_${rawFileName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${allErrors.length} errors to CSV.`);
  };

  // Filtered rows for search / error toggle
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (showErrorsOnly && r.isValid) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      return (
        r.description.toLowerCase().includes(q) ||
        r.partyName.toLowerCase().includes(q) ||
        (r.paidBy && r.paidBy.toLowerCase().includes(q)) ||
        r.invoiceOrderId.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.paymentMode.toLowerCase().includes(q)
      );
    });
  }, [rows, searchQuery, showErrorsOnly]);

  // Pagination slice
  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  // Final Database Insertion
  const handleExecuteImport = async () => {
    if (summaryMetrics.errorCount > 0) {
      toast.error(`Cannot import. Please resolve the ${summaryMetrics.errorCount} highlighted errors first.`);
      return;
    }

    setImporting(true);
    try {
      const payloadRows = rows.map((r) => ({
        slNo: r.slNo,
        date: r.date,
        description: r.description,
        category: r.category,
        debit: r.debit,
        credit: r.credit,
        paymentMode: r.paymentMode,
        bankOrCash: r.bankOrCash,
        paymentSource: r.paymentSource,
        transactionOrigin: r.transactionOrigin || importOrigin,
        partyName: r.partyName,
        paidBy: r.paidBy,
        invoiceOrderId: r.invoiceOrderId,
        gstApplicable: r.gstApplicable,
        gstAmount: r.gstAmount,
        tdsTcsAmount: r.tdsTcsAmount,
        balance: r.balance,
        remarks: r.remarks,
        billAvailable: r.billAvailable,
      }));

      const res = await fetch("/api/excel/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: payloadRows,
          accountType,
          origin: importOrigin,
          filename: file?.name || (importOrigin === "PRE_COMPANY" ? "pre_company_transactions.xlsx" : "foxion_accounting.xlsx"),
          openingBalance,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to import rows into MongoDB");
      }

      setIsConfirmModalOpen(false);
      setSuccessInfo({
        importedCount: data.importedCount,
        modifiedCount: summaryMetrics.modifiedCount,
        accountType,
        origin: importOrigin,
      });
      setCurrentStep("SUCCESS");
      toast.success(
        importOrigin === "PRE_COMPANY"
          ? "Pre-Company transactions imported successfully!"
          : "Excel import completed successfully!"
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Import execution failed";
      toast.error(message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Step 1: Upload View */}
      {currentStep === "UPLOAD" && (
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Destination Selector */}
          <div className="flex items-center justify-center gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-xl w-fit mx-auto">
            <button
              type="button"
              onClick={() => setImportOrigin("COMPANY")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                importOrigin === "COMPANY"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Accounts
            </button>
            <button
              type="button"
              onClick={() => setImportOrigin("PRE_COMPANY")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                importOrigin === "PRE_COMPANY"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Pre-Company Transactions
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  {importOrigin === "PRE_COMPANY"
                    ? "Import Pre-Company Transactions"
                    : "Import Accounts from Excel"}
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  {importOrigin === "PRE_COMPANY"
                    ? "Upload historical spreadsheet records (.xlsx, .xls) prior to company incorporation with interactive review & editing"
                    : "Upload `.xlsx` or `.xls` spreadsheet with interactive review & editing into Foxion Accounts"}
                </p>
              </div>
            </div>

            <Badge
              variant={importOrigin === "PRE_COMPANY" ? "warning" : "info"}
              className="text-xs px-3 py-1 uppercase tracking-wider font-semibold"
            >
              {importOrigin === "PRE_COMPANY"
                ? "Pre-Company Ledger"
                : "Accounts Ledger"}
            </Badge>
          </div>

          <Card className="border-slate-800 bg-slate-900/60 p-8 text-center">
            <input
              id="excelFileInput"
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="excelFileInput"
              className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-xl cursor-pointer bg-slate-950/40 hover:bg-slate-900/80 transition-all group"
            >
              <UploadCloud className="w-14 h-14 text-slate-400 group-hover:text-blue-400 transition-colors mb-4" />
              <span className="text-base font-semibold text-white">
                {file ? file.name : "Click to select or drag and drop Excel spreadsheet"}
              </span>
              <span className="text-xs text-slate-400 mt-2 max-w-sm">
                {importOrigin === "PRE_COMPANY"
                  ? "Standard columns: Sl No, Date, Description, Category, Income/Expense, Debit, Credit, Payment Mode, Bank/Cash, Party Name, Paid By, Invoice/Order ID, GST, TDS/TCS, Remarks, Bill"
                  : "Foxion standard accounting template: Sl No, Date, Description, Category, Debit, Credit, Payment Mode, Bank/Cash, Party, Invoice/orderId, GST, Balance, Remarks, Bill"}
              </span>
            </label>
          </Card>

          {parsing && (
            <div className="p-8 text-center bg-slate-900/50 rounded-xl border border-slate-800">
              <RefreshCw className="w-7 h-7 animate-spin mx-auto text-blue-400 mb-2" />
              <p className="text-sm font-medium text-slate-200">
                Parsing spreadsheet and performing row validation...
              </p>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Interactive In-Table Editable Preview */}
      {currentStep === "PREVIEW" && (
        <div className="space-y-4 animate-in fade-in">
          {/* Header Bar */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (confirm("Return to file upload? Any unsaved changes in this preview will be discarded.")) {
                    setCurrentStep("UPLOAD");
                    setFile(null);
                    setRows([]);
                  }
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Back to Upload"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-white">
                    {importOrigin === "PRE_COMPANY"
                      ? "Pre-Company Transactions Import"
                      : "Editable Import Preview"}
                  </h1>
                  <Badge
                    variant={importOrigin === "PRE_COMPANY" ? "warning" : "info"}
                    className="text-[10px]"
                  >
                    {importOrigin === "PRE_COMPANY"
                      ? "Pre-Company"
                      : "Accounts"}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Click any cell to edit • Balances recalculate in real-time • Correct invalid rows before importing
                </p>
              </div>
            </div>

            {/* Top Actions: Add Row & Final Review Button */}
            <div className="flex items-center gap-2.5">
              <Button variant="secondary" size="sm" onClick={handleAddRow}>
                <Plus className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                Add Row
              </Button>

              {allErrors.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-rose-700/60 bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 text-xs shadow-sm"
                  onClick={handleDownloadErrorReport}
                >
                  <Download className="w-3.5 h-3.5 mr-1.5 text-rose-300" />
                  Download Error Report
                </Button>
              )}

              <Button
                variant={summaryMetrics.invalidRowCount === 0 ? "success" : "outline"}
                size="sm"
                disabled={summaryMetrics.invalidRowCount > 0 || summaryMetrics.totalRows === 0}
                onClick={() => setIsConfirmModalOpen(true)}
              >
                Review & Import {summaryMetrics.totalRows} Rows
              </Button>
            </div>
          </div>

          {/* Prominent Validation Summary Banner */}
          {summaryMetrics.invalidRowCount > 0 ? (
            <div className="rounded-xl border border-rose-500/50 bg-rose-950/40 p-4 shadow-lg backdrop-blur space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-rose-900/60 text-rose-400 mt-0.5">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-rose-200">
                      Import validation failed: {summaryMetrics.invalidRowCount} row{summaryMetrics.invalidRowCount === 1 ? "" : "s"} contain errors.
                    </h2>
                    <p className="text-xs text-rose-300/80 mt-0.5">
                      Please correct the invalid rows directly in the editable table below or download the error report to update your Excel spreadsheet.
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-900/90 text-slate-300 border border-slate-700">
                        Total rows: <strong className="text-white">{summaryMetrics.totalRows}</strong>
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800">
                        Valid rows: <strong className="text-emerald-200">{summaryMetrics.validCount}</strong>
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-300 border border-rose-700">
                        Invalid rows: <strong className="text-rose-200">{summaryMetrics.invalidRowCount}</strong>
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-700">
                        Errors: <strong className="text-amber-200">{allErrors.length}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="bg-rose-900/40 hover:bg-rose-900/60 text-rose-200 border-rose-700/60 text-xs shadow-sm"
                    onClick={handleDownloadErrorReport}
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5 text-rose-300" />
                    Download Error Report
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-xs text-slate-300 hover:text-white"
                    onClick={() => setIsErrorTableExpanded(!isErrorTableExpanded)}
                  >
                    {isErrorTableExpanded ? (
                      <>
                        Hide Error Table <ChevronUp className="w-3.5 h-3.5 ml-1" />
                      </>
                    ) : (
                      <>
                        View Error Table ({allErrors.length}) <ChevronDown className="w-3.5 h-3.5 ml-1" />
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Expandable Error Details Table */}
              {isErrorTableExpanded && (
                <div className="mt-3 pt-3 border-t border-rose-800/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      Actionable Row-by-Row Error Details
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Click &ldquo;Jump to Row&rdquo; to quickly locate and edit
                    </span>
                  </div>

                  <div className="overflow-x-auto max-h-[360px] rounded-lg border border-slate-800 bg-slate-950/90 shadow-inner">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-slate-900 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 z-10">
                        <tr>
                          <th className="py-2.5 px-3 w-28">Excel Row</th>
                          <th className="py-2.5 px-3 w-36">Field / Column</th>
                          <th className="py-2.5 px-3 w-40">Current Value</th>
                          <th className="py-2.5 px-3">Error</th>
                          <th className="py-2.5 px-3">How to Fix</th>
                          <th className="py-2.5 px-3 text-center w-28">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {allErrors.map((err, errIdx) => (
                          <tr
                            key={`${err.sheetName}-${err.rowNumber}-${err.field}-${errIdx}`}
                            className="hover:bg-slate-900/60 transition-colors"
                          >
                            <td className="py-2.5 px-3 font-mono text-slate-300 align-top">
                              <span className="px-2 py-0.5 rounded bg-rose-950 border border-rose-800/80 text-rose-300 font-bold text-[11px]">
                                Row {err.rowNumber}
                              </span>
                              {err.sheetName && err.sheetName !== "Sheet1" && (
                                <span className="block text-[10px] text-slate-500 mt-0.5 truncate">
                                  {err.sheetName}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-200 align-top">
                              {err.columnHeader || err.field}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-400 align-top">
                              {err.currentValue && err.currentValue !== "" ? (
                                <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300 text-[11px] max-w-[150px] truncate block">
                                  {err.currentValue}
                                </span>
                              ) : (
                                <span className="italic text-slate-500 text-[11px]">[Empty]</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-rose-300 font-medium align-top">
                              {err.error}
                            </td>
                            <td className="py-2.5 px-3 text-emerald-300/90 text-xs align-top">
                              <div className="flex items-start gap-1">
                                <span className="text-emerald-400 font-bold">Fix:</span>
                                <span>{err.howToFix}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center align-top">
                              <button
                                type="button"
                                onClick={() => handleJumpToRow(err.rowNumber, err.field)}
                                className="px-2.5 py-1 rounded text-[11px] font-medium bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 transition-colors"
                              >
                                Jump to Row
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3.5 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-emerald-300 text-xs font-medium">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span>
                  Validation successful: All <strong className="text-white">{summaryMetrics.totalRows}</strong> rows are valid and ready to import.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded bg-emerald-900/60 text-emerald-200 text-xs font-semibold border border-emerald-700/50">
                  Total: {summaryMetrics.totalRows} | Valid: {summaryMetrics.validCount} | Errors: 0
                </span>
              </div>
            </div>
          )}

          {/* KPI Summary Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <Card className="p-3 bg-slate-900/80 border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                Total Rows
              </span>
              <p className="text-xl font-bold text-white mt-0.5">
                {summaryMetrics.totalRows}
              </p>
            </Card>

            <Card className="p-3 bg-emerald-950/30 border-emerald-800/50">
              <span className="text-[11px] text-emerald-400 uppercase tracking-wider block">
                Valid Rows
              </span>
              <p className="text-xl font-bold text-emerald-400 mt-0.5">
                {summaryMetrics.validCount}
              </p>
            </Card>

            <Card
              className={`p-3 border transition-colors ${
                summaryMetrics.invalidRowCount > 0
                  ? "bg-rose-950/40 border-rose-800"
                  : "bg-slate-900/60 border-slate-800"
              }`}
            >
              <span className="text-[11px] text-rose-400 uppercase tracking-wider block">
                Invalid Rows
              </span>
              <p className="text-xl font-bold text-rose-400 mt-0.5">
                {summaryMetrics.invalidRowCount}
              </p>
              {allErrors.length > 0 && (
                <span className="text-[10px] text-amber-400 block mt-0.5">
                  ({allErrors.length} total errors)
                </span>
              )}
            </Card>

            <Card className="p-3 bg-blue-950/30 border-blue-800/50">
              <span className="text-[11px] text-blue-400 uppercase tracking-wider block">
                Modified Rows
              </span>
              <p className="text-xl font-bold text-blue-400 mt-0.5">
                {summaryMetrics.modifiedCount}
              </p>
            </Card>

            <Card className="p-3 bg-slate-900/80 border-slate-800">
              <span className="text-[11px] text-rose-400 uppercase tracking-wider block">
                Total Debit
              </span>
              <p className="text-lg font-bold text-rose-400 mt-0.5 font-mono">
                {formatINR(summaryMetrics.totalDebit)}
              </p>
            </Card>

            <Card className="p-3 bg-slate-900/80 border-slate-800">
              <span className="text-[11px] text-emerald-400 uppercase tracking-wider block">
                Total Credit
              </span>
              <p className="text-lg font-bold text-emerald-400 mt-0.5 font-mono">
                {formatINR(summaryMetrics.totalCredit)}
              </p>
            </Card>
          </div>

          {/* Search and Filters Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search description, party, invoice, category..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/90 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showErrorsOnly}
                  onChange={(e) => {
                    setShowErrorsOnly(e.target.checked);
                    setCurrentPage(1);
                  }}
                  className="rounded border-slate-700 bg-slate-800 text-rose-500 focus:ring-rose-500 h-4 w-4"
                />
                <span className={showErrorsOnly ? "text-rose-400 font-medium" : ""}>
                  Show Errors Only ({summaryMetrics.invalidRowCount})
                </span>
              </label>

              <span className="text-xs text-slate-500">
                Showing {filteredRows.length} of {rows.length} rows
              </span>
            </div>
          </div>

          {/* Opening Balance info strip */}
          {openingBalance !== 0 && (
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-blue-950/40 border border-blue-800/60 text-xs shadow-sm">
              <div className="flex items-center gap-2 text-blue-300">
                <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span>
                  Opening balance of <strong className="text-white font-mono">{formatINR(openingBalance)}</strong> loaded from previous account records.
                </span>
              </div>
              <span className="text-[11px] text-blue-400/80 hidden sm:inline">
                Balances calculated chronologically from previous closing balance
              </span>
            </div>
          )}

          {/* Editable Grid */}
          <Card className="overflow-hidden border-slate-800 bg-slate-900/90">
            <div className="overflow-x-auto max-h-[580px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider z-20 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-2 text-center w-14">Sl No</th>
                    <th className="py-2.5 px-3 min-w-[110px]">Date</th>
                    <th className="py-2.5 px-3 min-w-[180px]">Description</th>
                    <th className="py-2.5 px-3 min-w-[140px]">Category</th>
                    <th className="py-2.5 px-3 text-right min-w-[110px]">Debit (₹)</th>
                    <th className="py-2.5 px-3 text-right min-w-[110px]">Credit (₹)</th>
                    <th className="py-2.5 px-3 text-right min-w-[120px]">Balance (₹)</th>
                    <th className="py-2.5 px-3 min-w-[120px]">Payment Mode</th>
                    <th className="py-2.5 px-3 min-w-[90px]">Bank/Cash</th>
                    <th className="py-2.5 px-3 min-w-[130px]">Party Name</th>
                    <th className="py-2.5 px-3 min-w-[130px]">
                      {importOrigin === "PRE_COMPANY" ? (
                        <span className="text-amber-400">Paid By *</span>
                      ) : (
                        "Paid By"
                      )}
                    </th>
                    <th className="py-2.5 px-3 min-w-[110px]">Invoice/orderId</th>
                    <th className="py-2.5 px-2 text-center min-w-[60px]">GST</th>
                    <th className="py-2.5 px-3 text-right min-w-[90px]">GST Amt</th>
                    <th className="py-2.5 px-3 text-right min-w-[90px]">TDS/TCS</th>
                    <th className="py-2.5 px-3 min-w-[130px]">Remarks</th>
                    <th className="py-2.5 px-2 text-center min-w-[60px]">Bill</th>
                    <th className="py-2.5 px-2 text-center min-w-[80px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={18} className="py-12 text-center text-slate-400">
                        No rows match your current search or error filter.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row) => {
                      const hasRowError = !row.isValid;
                      const isEditing = (field: keyof EditableImportRow) =>
                        editingCell?.rowId === row.id && editingCell?.field === field;

                      return (
                        <tr
                          key={row.id}
                          id={`preview-row-${row.id}`}
                          className={`transition-colors group ${
                            hasRowError
                              ? "bg-rose-950/25 hover:bg-rose-950/35 border-l-4 border-l-rose-500"
                              : row.isModified
                              ? "bg-blue-950/20 hover:bg-blue-950/30"
                              : "hover:bg-slate-800/40"
                          }`}
                        >
                          {/* 1. Sl No & Excel Row (Read Only) */}
                          <td className="py-2 px-2 text-center font-mono text-[11px] text-slate-400 select-none">
                            <div className="flex flex-col items-center justify-center">
                              <div className="flex items-center gap-1">
                                <span>{row.slNo}</span>
                                {row.isModified && (
                                  <span
                                    className="w-1.5 h-1.5 rounded-full bg-blue-400"
                                    title="Row modified"
                                  />
                                )}
                              </div>
                              {row.excelRowNumber && (
                                <span
                                  className={`text-[9px] font-mono px-1 rounded mt-0.5 ${
                                    hasRowError
                                      ? "text-rose-300 bg-rose-950/90 border border-rose-800/70 font-semibold"
                                      : "text-slate-500"
                                  }`}
                                  title={`Physical Excel Worksheet Row #${row.excelRowNumber}`}
                                >
                                  Row {row.excelRowNumber}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 2. Date */}
                          <td
                            onClick={() => startEditing(row.id, "date", row.date)}
                            className={`py-2 px-3 whitespace-nowrap cursor-pointer ${
                              row.fieldErrors.date
                                ? "bg-rose-950/60 text-rose-300 font-bold"
                                : "text-slate-200"
                            }`}
                          >
                            {isEditing("date") ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  autoFocus
                                  value={String(editTempValue)}
                                  onChange={(e) => setEditTempValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveEditing();
                                    if (e.key === "Escape") cancelEditing();
                                  }}
                                  className="h-7 w-24 bg-slate-950 border border-blue-500 px-1.5 rounded text-xs text-white"
                                  placeholder="DD/MM/YYYY"
                                />
                                <button
                                  onClick={saveEditing}
                                  className="p-1 hover:bg-slate-800 rounded text-emerald-400"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={cancelEditing}
                                  className="p-1 hover:bg-slate-800 rounded text-rose-400"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <span className="font-mono text-[11px]">{row.date}</span>
                                {row.fieldErrors.date && (
                                  <span className="text-[10px] text-rose-400 block truncate">
                                    {row.fieldErrors.date}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* 3. Description */}
                          <td
                            onClick={() => startEditing(row.id, "description", row.description)}
                            className={`py-2 px-3 cursor-pointer max-w-xs ${
                              row.fieldErrors.description
                                ? "bg-rose-950/60 text-rose-300"
                                : "text-white"
                            }`}
                          >
                            {isEditing("description") ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  autoFocus
                                  value={String(editTempValue)}
                                  onChange={(e) => setEditTempValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveEditing();
                                    if (e.key === "Escape") cancelEditing();
                                  }}
                                  className="h-7 w-full bg-slate-950 border border-blue-500 px-1.5 rounded text-xs text-white"
                                />
                                <button onClick={saveEditing} className="p-1 text-emerald-400">
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div>
                                <span className="truncate block font-medium">
                                  {row.description || "—"}
                                </span>
                                {row.fieldErrors.description && (
                                  <span className="text-[10px] text-rose-400 block">
                                    {row.fieldErrors.description}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* 4. Category */}
                          <td
                            onClick={() => startEditing(row.id, "category", row.category)}
                            className={`py-2 px-3 whitespace-nowrap cursor-pointer ${
                              row.fieldErrors.category ? "bg-rose-950/60" : ""
                            }`}
                          >
                            {isEditing("category") ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <input
                                  list="import-categories"
                                  autoFocus
                                  value={String(editTempValue)}
                                  onChange={(e) => setEditTempValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveEditing();
                                    if (e.key === "Escape") cancelEditing();
                                  }}
                                  className="h-7 w-32 bg-slate-950 border border-blue-500 px-1.5 rounded text-xs text-white"
                                />
                                <datalist id="import-categories">
                                  {categories.map((c) => (
                                    <option key={c} value={c} />
                                  ))}
                                </datalist>
                                <button onClick={saveEditing} className="p-1 text-emerald-400">
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">
                                {row.category || "Select category"}
                              </Badge>
                            )}
                          </td>

                          {/* 5. Debit */}
                          <td
                            onClick={() => startEditing(row.id, "debit", row.debit)}
                            className={`py-2 px-3 text-right font-mono cursor-pointer ${
                              row.fieldErrors.debit ? "bg-rose-950/60 text-rose-300" : "text-rose-400"
                            }`}
                          >
                            {isEditing("debit") ? (
                              <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  autoFocus
                                  value={String(editTempValue)}
                                  onChange={(e) => setEditTempValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveEditing();
                                    if (e.key === "Escape") cancelEditing();
                                  }}
                                  className="h-7 w-20 bg-slate-950 border border-blue-500 px-1 rounded text-xs text-right text-white"
                                />
                                <button onClick={saveEditing} className="p-1 text-emerald-400">
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span>{row.debit > 0 ? formatINR(row.debit) : "—"}</span>
                            )}
                          </td>

                          {/* 6. Credit */}
                          <td
                            onClick={() => startEditing(row.id, "credit", row.credit)}
                            className={`py-2 px-3 text-right font-mono cursor-pointer ${
                              row.fieldErrors.credit ? "bg-rose-950/60 text-rose-300" : "text-emerald-400"
                            }`}
                          >
                            {isEditing("credit") ? (
                              <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  autoFocus
                                  value={String(editTempValue)}
                                  onChange={(e) => setEditTempValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveEditing();
                                    if (e.key === "Escape") cancelEditing();
                                  }}
                                  className="h-7 w-20 bg-slate-950 border border-blue-500 px-1 rounded text-xs text-right text-white"
                                />
                                <button onClick={saveEditing} className="p-1 text-emerald-400">
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span>{row.credit > 0 ? formatINR(row.credit) : "—"}</span>
                            )}
                          </td>

                          {/* 7. Balance (Automatically calculated) */}
                          <td className="py-2 px-3 text-right font-mono font-semibold text-slate-300 bg-slate-950/30 whitespace-nowrap">
                            {formatINR(row.balance)}
                          </td>

                          {/* 8. Payment Mode */}
                          <td
                            onClick={() => startEditing(row.id, "paymentMode", row.paymentMode)}
                            className="py-2 px-3 whitespace-nowrap cursor-pointer text-slate-300"
                          >
                            {isEditing("paymentMode") ? (
                              <select
                                autoFocus
                                value={String(editTempValue)}
                                onChange={(e) => {
                                  setEditTempValue(e.target.value);
                                  setTimeout(saveEditing, 50);
                                }}
                                className="h-7 bg-slate-950 border border-blue-500 px-1 rounded text-xs text-white"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {PAYMENT_MODES.map((m) => (
                                  <option key={m} value={m}>
                                    {m}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span>{row.paymentMode}</span>
                            )}
                          </td>

                          {/* 9. Bank/Cash */}
                          <td
                            onClick={() => startEditing(row.id, "bankOrCash", row.bankOrCash)}
                            className="py-2 px-3 whitespace-nowrap cursor-pointer"
                          >
                            {isEditing("bankOrCash") ? (
                              <select
                                autoFocus
                                value={String(editTempValue)}
                                onChange={(e) => {
                                  setEditTempValue(e.target.value);
                                  setTimeout(saveEditing, 50);
                                }}
                                className="h-7 bg-slate-950 border border-blue-500 px-1 rounded text-xs text-white"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {BANK_CASH_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <Badge
                                variant={row.bankOrCash === "Bank" ? "info" : "warning"}
                                className="text-[10px]"
                              >
                                {row.bankOrCash}
                              </Badge>
                            )}
                          </td>

                          {/* 10. Party Name */}
                          <td
                            onClick={() => startEditing(row.id, "partyName", row.partyName)}
                            className="py-2 px-3 whitespace-nowrap cursor-pointer text-slate-300"
                          >
                            {isEditing("partyName") ? (
                              <input
                                type="text"
                                autoFocus
                                value={String(editTempValue)}
                                onChange={(e) => setEditTempValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEditing();
                                  if (e.key === "Escape") cancelEditing();
                                }}
                                className="h-7 w-28 bg-slate-950 border border-blue-500 px-1.5 rounded text-xs text-white"
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <span>{row.partyName || "—"}</span>
                            )}
                          </td>

                          {/* Paid By */}
                          <td
                            onClick={() => startEditing(row.id, "paidBy", row.paidBy || "")}
                            className={`py-2 px-3 whitespace-nowrap cursor-pointer ${
                              importOrigin === "PRE_COMPANY" &&
                              (!row.paidBy || !row.paidBy.trim()) &&
                              (row.bankOrCash === "Personal Bank" || row.bankOrCash === "Personal Cash")
                                ? "bg-rose-950/40 text-rose-300 font-semibold"
                                : "text-slate-300"
                            }`}
                          >
                            {isEditing("paidBy") ? (
                              <input
                                type="text"
                                autoFocus
                                value={String(editTempValue)}
                                onChange={(e) => setEditTempValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEditing();
                                  if (e.key === "Escape") cancelEditing();
                                }}
                                className="h-7 w-28 bg-slate-950 border border-blue-500 px-1.5 rounded text-xs text-white"
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <span>
                                {row.paidBy ? (
                                  row.paidBy
                                ) : importOrigin === "PRE_COMPANY" &&
                                  (row.bankOrCash === "Personal Bank" || row.bankOrCash === "Personal Cash") ? (
                                  <span className="text-amber-400 italic text-[10px]">Required</span>
                                ) : (
                                  "—"
                                )}
                              </span>
                            )}
                          </td>

                          {/* 11. Invoice / Order ID */}
                          <td
                            onClick={() => startEditing(row.id, "invoiceOrderId", row.invoiceOrderId)}
                            className="py-2 px-3 whitespace-nowrap cursor-pointer font-mono text-[11px] text-slate-400"
                          >
                            {isEditing("invoiceOrderId") ? (
                              <input
                                type="text"
                                autoFocus
                                value={String(editTempValue)}
                                onChange={(e) => setEditTempValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEditing();
                                  if (e.key === "Escape") cancelEditing();
                                }}
                                className="h-7 w-24 bg-slate-950 border border-blue-500 px-1.5 rounded text-xs text-white font-mono"
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <span>{row.invoiceOrderId ? `#${row.invoiceOrderId}` : "—"}</span>
                            )}
                          </td>

                          {/* 12. GST Applicable */}
                          <td className="py-2 px-2 text-center">
                            <input
                              type="checkbox"
                              checked={row.gstApplicable}
                              onChange={(e) => {
                                setRows((prev) =>
                                  prev.map((r) =>
                                    r.id === row.id
                                      ? { ...r, gstApplicable: e.target.checked, isModified: true }
                                      : r
                                  )
                                );
                              }}
                              className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                            />
                          </td>

                          {/* 13. GST Amount */}
                          <td
                            onClick={() => startEditing(row.id, "gstAmount", row.gstAmount)}
                            className="py-2 px-3 text-right font-mono cursor-pointer text-slate-400"
                          >
                            {isEditing("gstAmount") ? (
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                autoFocus
                                value={String(editTempValue)}
                                onChange={(e) => setEditTempValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEditing();
                                  if (e.key === "Escape") cancelEditing();
                                }}
                                className="h-7 w-16 bg-slate-950 border border-blue-500 px-1 text-right text-xs text-white font-mono"
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <span>{row.gstAmount > 0 ? formatINR(row.gstAmount) : "—"}</span>
                            )}
                          </td>

                          {/* 14. TDS/TCS */}
                          <td
                            onClick={() => startEditing(row.id, "tdsTcsAmount", row.tdsTcsAmount)}
                            className="py-2 px-3 text-right font-mono cursor-pointer text-slate-400"
                          >
                            {isEditing("tdsTcsAmount") ? (
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                autoFocus
                                value={String(editTempValue)}
                                onChange={(e) => setEditTempValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEditing();
                                  if (e.key === "Escape") cancelEditing();
                                }}
                                className="h-7 w-16 bg-slate-950 border border-blue-500 px-1 text-right text-xs text-white font-mono"
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <span>{row.tdsTcsAmount > 0 ? formatINR(row.tdsTcsAmount) : "—"}</span>
                            )}
                          </td>

                          {/* 15. Remarks */}
                          <td
                            onClick={() => startEditing(row.id, "remarks", row.remarks)}
                            className="py-2 px-3 max-w-xs truncate cursor-pointer text-slate-400"
                          >
                            {isEditing("remarks") ? (
                              <input
                                type="text"
                                autoFocus
                                value={String(editTempValue)}
                                onChange={(e) => setEditTempValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEditing();
                                  if (e.key === "Escape") cancelEditing();
                                }}
                                className="h-7 w-36 bg-slate-950 border border-blue-500 px-1.5 rounded text-xs text-white"
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <span>{row.remarks || "—"}</span>
                            )}
                          </td>

                          {/* 16. Bill Available */}
                          <td className="py-2 px-2 text-center">
                            <input
                              type="checkbox"
                              checked={row.billAvailable}
                              onChange={(e) => {
                                setRows((prev) =>
                                  prev.map((r) =>
                                    r.id === row.id
                                      ? { ...r, billAvailable: e.target.checked, isModified: true }
                                      : r
                                  )
                                );
                              }}
                              className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                            />
                          </td>

                          {/* Actions: Duplicate & Delete */}
                          <td className="py-2 px-2 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleDuplicateRow(row.id)}
                                className="p-1 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded transition-colors"
                                title="Duplicate Row"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteRow(row.id)}
                                className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                                title="Delete Row"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-950/60 text-xs text-slate-400">
                <div>
                  Page {currentPage} of {totalPages} ({filteredRows.length} rows)
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Step 3: Success Screen */}
      {currentStep === "SUCCESS" && successInfo && (
        <Card className="max-w-lg mx-auto p-8 border-emerald-800/50 bg-slate-900/90 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-950">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Import Completed Successfully
            </h2>
            <p className="text-sm text-slate-300 mt-2">
              <strong className="text-emerald-400">{successInfo.importedCount} transactions</strong> have been inserted into MongoDB.
            </p>
            {successInfo.modifiedCount > 0 && (
              <p className="text-xs text-slate-400 mt-1">
                {successInfo.modifiedCount} rows were modified and validated before final import.
              </p>
            )}
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Destination:</span>
              <span className="font-semibold text-white">
                {importOrigin === "PRE_COMPANY" ? "Pre-Company Transactions" : "Accounts"}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Timestamp:</span>
              <span className="font-mono text-slate-300">
                {formatIndianDate(new Date(), { withTime: true })}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setCurrentStep("UPLOAD");
                setFile(null);
                setRows([]);
                setSuccessInfo(null);
              }}
            >
              Import Another File
            </Button>

            <Button
              variant="primary"
              onClick={() =>
                router.push(
                  importOrigin === "PRE_COMPANY"
                    ? "/accounts/pre-company"
                    : "/accounts/main"
                )
              }
            >
              {importOrigin === "PRE_COMPANY"
                ? "View Pre-Company Transactions"
                : "View Accounts"}{" "}
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
        </Card>
      )}

      {/* Final Confirmation Modal (Section 28) */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Ready to Import Transactions"
        description="Verify the batch totals before saving permanently to MongoDB"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
            <div className="flex justify-between">
              <span className="text-slate-400">Total Transactions:</span>
              <span className="font-bold text-white text-sm font-mono">
                {summaryMetrics.totalRows}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Classification:</span>
              <span className="font-semibold text-blue-400">
                {importOrigin === "PRE_COMPANY"
                  ? "Pre-Company Transactions"
                  : "Accounts"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Debit (Outflow):</span>
              <span className="font-bold text-rose-400 font-mono">
                {formatINR(summaryMetrics.totalDebit)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Credit (Inflow):</span>
              <span className="font-bold text-emerald-400 font-mono">
                {formatINR(summaryMetrics.totalCredit)}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-800 pt-2">
              <span className="text-slate-400">Blocking Errors:</span>
              <span className="font-bold text-emerald-400">0 Errors</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Modified Before Import:</span>
              <span className="font-medium text-slate-300">
                {summaryMetrics.modifiedCount} rows
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsConfirmModalOpen(false)}
            >
              Back to Edit
            </Button>
            <Button
              type="button"
              variant="success"
              loading={importing}
              onClick={handleExecuteImport}
            >
              Import Transactions
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function ExcelImportPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading Excel Import...</div>}>
        <ExcelImportContent />
      </Suspense>
    </AppLayout>
  );
}
