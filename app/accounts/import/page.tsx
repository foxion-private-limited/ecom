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
} from "lucide-react";
import { formatINR, formatIndianDate, parseIndianDate } from "@/lib/utils";
import { IndianDateInput } from "@/components/ui/IndianDateInput";
import { EditableImportRow } from "@/lib/excel/types";
import { validateSingleRow } from "@/lib/excel/excelValidator";
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

const BANK_CASH_OPTIONS: Array<"Bank" | "Cash" | "N/A"> = ["Bank", "Cash", "N/A"];

function calculateRunningBalances(rows: EditableImportRow[]): EditableImportRow[] {
  let running = 0;
  return rows.map((r, idx) => {
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

  // Navigation and Account Context (Single Main Accounts System)
  const accountType = "MAIN";

  // Workflow steps: 1. UPLOAD, 2. EDIT_PREVIEW, 3. SUCCESS
  const [currentStep, setCurrentStep] = useState<"UPLOAD" | "PREVIEW" | "SUCCESS">("UPLOAD");

  // File and Data state
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<EditableImportRow[]>([]);
  const [originalRowCount, setOriginalRowCount] = useState(0);

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

  // Confirmation Modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  // Success summary
  const [successInfo, setSuccessInfo] = useState<{
    importedCount: number;
    modifiedCount: number;
    accountType: string;
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

        // Convert parsed rows into EditableImportRow array
        const initialRows: EditableImportRow[] = summary.rows.map(
          (r: { rowNumber: number; isValid: boolean; data: Record<string, unknown>; errors: string[]; warnings: string[] }, idx: number) => {
            const raw = r.data;
            const parsedDate = parseIndianDate(raw.date as string | Date) || new Date();
            const dateStr = formatIndianDate(parsedDate);
            const debit = Number(raw.debit) || 0;
            const credit = Number(raw.credit) || 0;

            const validation = validateSingleRow({
              date: dateStr,
              description: String(raw.description || ""),
              category: String(raw.category || ""),
              debit,
              credit,
              gstAmount: Number(raw.gstAmount) || 0,
              tdsTcsAmount: Number(raw.tdsTcsAmount) || 0,
            });

            return {
              id: `row-${idx + 1}-${Date.now()}`,
              slNo: idx + 1,
              date: dateStr,
              rawDate: parsedDate,
              description: String(raw.description || "").trim(),
              category: String(raw.category || "").trim(),
              debit,
              credit,
              paymentMode: String(raw.paymentMode || "Bank Transfer"),
              bankOrCash: (raw.bankOrCash as "Bank" | "Cash" | "N/A") || "Bank",
              partyName: String(raw.partyName || "").trim(),
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
              warnings: validation.warnings,
            };
          }
        );

        const balancedRows = calculateRunningBalances(initialRows);
        setRows(balancedRows);
        setCurrentStep("PREVIEW");
        setCurrentPage(1);

        toast.success(`Parsed ${balancedRows.length} rows ready for review.`);
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
    const validation = validateSingleRow({
      date: row.date,
      description: row.description,
      category: row.category,
      debit: row.debit,
      credit: row.credit,
      gstAmount: row.gstAmount,
      tdsTcsAmount: row.tdsTcsAmount,
    });

    return {
      ...row,
      isValid: validation.isValid,
      fieldErrors: validation.fieldErrors,
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

      return calculateRunningBalances(updated);
    });

    setEditingCell(null);
  };

  const cancelEditing = () => {
    setEditingCell(null);
  };

  // Add Row
  const handleAddRow = () => {
    const todayStr = formatIndianDate(new Date());
    const newRow: EditableImportRow = {
      id: `new-row-${Date.now()}`,
      slNo: rows.length + 1,
      date: todayStr,
      rawDate: new Date(),
      description: "Manual Transaction Entry",
      category: categories[0] || "General",
      debit: 0,
      credit: 100,
      paymentMode: "Bank Transfer",
      bankOrCash: "Bank",
      partyName: "",
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
    const updated = calculateRunningBalances([revalidated, ...rows]);
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
    const balanced = calculateRunningBalances(newRows);
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
    const balanced = calculateRunningBalances(remaining);
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
      errorCount,
      modifiedCount,
      totalDebit,
      totalCredit,
    };
  }, [rows]);

  // Filtered rows for search / error toggle
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (showErrorsOnly && r.isValid) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      return (
        r.description.toLowerCase().includes(q) ||
        r.partyName.toLowerCase().includes(q) ||
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
        partyName: r.partyName,
        invoiceOrderId: r.invoiceOrderId,
        gstApplicable: r.gstApplicable,
        gstAmount: r.gstAmount,
        tdsTcsAmount: r.tdsTcsAmount,
        remarks: r.remarks,
        billAvailable: r.billAvailable,
      }));

      const res = await fetch("/api/excel/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: payloadRows,
          accountType,
          filename: file?.name || "foxion_accounting.xlsx",
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
      });
      setCurrentStep("SUCCESS");
      toast.success("Excel import completed successfully!");
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
                  Import Accounts from Excel
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Upload `.xlsx` or `.xls` spreadsheet with interactive review & editing into Foxion Main Accounts
                </p>
              </div>
            </div>

            <Badge variant="info" className="text-xs px-3 py-1">
              Main Accounts Ledger
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
                Foxion standard 16-column accounting template (Sl No, Date, Description, Category, Debit, Credit, Payment Mode, Bank/Cash, Party, Invoice/orderId, GST, Balance, Remarks, Bill)
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
                    Editable Import Preview
                  </h1>
                  <Badge variant="info" className="text-[10px]">
                    Main Accounts
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

              <Button
                variant={summaryMetrics.errorCount === 0 ? "success" : "outline"}
                size="sm"
                disabled={summaryMetrics.errorCount > 0 || summaryMetrics.totalRows === 0}
                onClick={() => setIsConfirmModalOpen(true)}
              >
                Review & Import {summaryMetrics.totalRows} Rows
              </Button>
            </div>
          </div>

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
                summaryMetrics.errorCount > 0
                  ? "bg-rose-950/40 border-rose-800"
                  : "bg-slate-900/60 border-slate-800"
              }`}
            >
              <span className="text-[11px] text-rose-400 uppercase tracking-wider block">
                Rows With Errors
              </span>
              <p className="text-xl font-bold text-rose-400 mt-0.5">
                {summaryMetrics.errorCount}
              </p>
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
                  Show Errors Only ({summaryMetrics.errorCount})
                </span>
              </label>

              <span className="text-xs text-slate-500">
                Showing {filteredRows.length} of {rows.length} rows
              </span>
            </div>
          </div>

          {/* Editable Grid */}
          <Card className="overflow-hidden border-slate-800 bg-slate-900/90">
            <div className="overflow-x-auto max-h-[580px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider z-20 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-2 text-center w-12">Sl No</th>
                    <th className="py-2.5 px-3 min-w-[110px]">Date</th>
                    <th className="py-2.5 px-3 min-w-[180px]">Description</th>
                    <th className="py-2.5 px-3 min-w-[140px]">Category</th>
                    <th className="py-2.5 px-3 text-right min-w-[110px]">Debit (₹)</th>
                    <th className="py-2.5 px-3 text-right min-w-[110px]">Credit (₹)</th>
                    <th className="py-2.5 px-3 text-right min-w-[120px]">Balance (₹)</th>
                    <th className="py-2.5 px-3 min-w-[120px]">Payment Mode</th>
                    <th className="py-2.5 px-3 min-w-[90px]">Bank/Cash</th>
                    <th className="py-2.5 px-3 min-w-[130px]">Party Name</th>
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
                      <td colSpan={17} className="py-12 text-center text-slate-400">
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
                          className={`transition-colors group ${
                            hasRowError
                              ? "bg-rose-950/25 hover:bg-rose-950/35"
                              : row.isModified
                              ? "bg-blue-950/20 hover:bg-blue-950/30"
                              : "hover:bg-slate-800/40"
                          }`}
                        >
                          {/* 1. Sl No (Read Only) */}
                          <td className="py-2 px-2 text-center font-mono text-[11px] text-slate-400 select-none">
                            <div className="flex items-center justify-center gap-1">
                              <span>{row.slNo}</span>
                              {row.isModified && (
                                <span
                                  className="w-1.5 h-1.5 rounded-full bg-blue-400"
                                  title="Row modified"
                                />
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
              <span>Destination Account:</span>
              <span className="font-semibold text-white">
                Main Accounts
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
              onClick={() => router.push("/accounts/main")}
            >
              View Accounts <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
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
              <span className="text-slate-400">Account Book:</span>
              <span className="font-semibold text-blue-400">
                Main Accounts
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
