"use client";

import React, { useState, useMemo } from "react";
import { Modal, Button, Badge } from "@/lib/ui";
import { Download, Calendar, Layers, AlertCircle, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import {
  getAccountingExportFilename,
  MONTH_NAMES,
  ExportScopeType,
} from "@/lib/excel/excelExporter";

interface ExportScopeModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountType?: string;
  origin?: "COMPANY" | "PRE_COMPANY" | "ALL";
  activeCategory?: string;
  paymentMode?: string;
  bankOrCash?: string;
  search?: string;
}

export function ExportScopeModal({
  isOpen,
  onClose,
  accountType = "MAIN",
  origin = "COMPANY",
  activeCategory,
  paymentMode,
  bankOrCash,
  search,
}: ExportScopeModalProps) {
  const isPreCompany = origin === "PRE_COMPANY";
  const currentDate = new Date();

  // Export scope options
  const [scope, setScope] = useState<ExportScopeType>("ALL");

  // Month & Year state
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());

  // Date Range state
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [rangeError, setRangeError] = useState<string | null>(null);

  // Loading state
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Dynamic year list (e.g., from 2023 to currentYear + 2)
  const availableYears = useMemo(() => {
    const startYear = 2023;
    const endYear = Math.max(currentDate.getFullYear() + 2, 2028);
    const years: number[] = [];
    for (let y = startYear; y <= endYear; y++) {
      years.push(y);
    }
    return years;
  }, [currentDate]);

  // Compute month boundary preview text and date strings
  const monthInfo = useMemo(() => {
    const monthNum = selectedMonth + 1;
    const monthStr = String(monthNum).padStart(2, "0");
    const lastDay = new Date(selectedYear, monthNum, 0).getDate(); // Accurate leap year handling
    const startStr = `${selectedYear}-${monthStr}-01`;
    const endStr = `${selectedYear}-${monthStr}-${String(lastDay).padStart(2, "0")}`;
    const previewText = `1 ${MONTH_NAMES[selectedMonth]} ${selectedYear} – ${lastDay} ${MONTH_NAMES[selectedMonth]} ${selectedYear} (inclusive)`;
    return { startStr, endStr, previewText, lastDay };
  }, [selectedMonth, selectedYear]);

  // Preview target filename dynamically
  const previewFilename = useMemo(() => {
    return getAccountingExportFilename({
      scope,
      month: selectedMonth + 1,
      year: selectedYear,
      startDate: scope === "RANGE" ? startDate : monthInfo.startStr,
      endDate: scope === "RANGE" ? endDate : monthInfo.endStr,
      origin,
    });
  }, [scope, selectedMonth, selectedYear, startDate, endDate, monthInfo.startStr, monthInfo.endStr, origin]);

  // Validate date range on change
  const validateRange = (start: string, end: string): string | null => {
    if (!start || !end) {
      return "Both start date and end date are required.";
    }
    if (start > end) {
      return "Start date cannot be later than end date.";
    }
    return null;
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (endDate) {
      setRangeError(validateRange(val, endDate));
    } else {
      setRangeError(null);
    }
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    if (startDate) {
      setRangeError(validateRange(startDate, val));
    } else {
      setRangeError(null);
    }
  };

  const handleExecuteExport = async () => {
    let finalStart: string | undefined = undefined;
    let finalEnd: string | undefined = undefined;
    let scopeLabel = "Export All";

    if (scope === "MONTH") {
      finalStart = monthInfo.startStr;
      finalEnd = monthInfo.endStr;
      scopeLabel = `${MONTH_NAMES[selectedMonth]} ${selectedYear}`;
    } else if (scope === "RANGE") {
      const err = validateRange(startDate, endDate);
      if (err) {
        setRangeError(err);
        return;
      }
      finalStart = startDate;
      finalEnd = endDate;
      scopeLabel = `${startDate} to ${endDate}`;
    }

    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("accountType", accountType);
      params.set("origin", origin);
      params.set("scope", scope);
      if (scope === "MONTH") {
        params.set("month", String(selectedMonth + 1));
        params.set("year", String(selectedYear));
      }
      if (finalStart) params.set("startDate", finalStart);
      if (finalEnd) params.set("endDate", finalEnd);
      if (activeCategory && activeCategory !== "ALL") {
        params.set("category", activeCategory);
      }
      if (paymentMode && paymentMode !== "ALL") {
        params.set("paymentMode", paymentMode);
      }
      if (bankOrCash && bankOrCash !== "ALL") {
        params.set("bankOrCash", bankOrCash);
      }
      if (search && search.trim()) {
        params.set("search", search.trim());
      }

      const res = await fetch(`/api/excel/export?${params.toString()}`);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMsg =
          errorData.error ||
          "No records match the selected month or date range. Please adjust your criteria.";
        toast.error(errorMsg);
        return;
      }

      const countHeader = res.headers.get("X-Export-Count");
      const exportCount = countHeader ? parseInt(countHeader, 10) : undefined;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      // Generate dynamic filename fallback using the helper
      const fallbackFilename = getAccountingExportFilename({
        scope,
        month: selectedMonth + 1,
        year: selectedYear,
        startDate: finalStart,
        endDate: finalEnd,
        origin,
      });

      // Extract filename from Content-Disposition header if available
      const disposition = res.headers.get("Content-Disposition");
      let filename = fallbackFilename;

      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      if (exportCount !== undefined) {
        toast.success(`Exported ${exportCount} records (${scopeLabel}) successfully!`);
      } else {
        toast.success(`Exported accounting records (${scopeLabel}) successfully!`);
      }

      onClose();
    } catch {
      toast.error("Failed to download export file. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Export Records"
      description={`Export accounting transactions to Microsoft Excel (.xlsx) for ${
        isPreCompany ? "Pre-Company Ledger" : "Accounts Ledger"
      }`}
      maxWidth="md"
    >
      <div className="space-y-5 text-xs text-slate-200">
        {/* Scope Selector (Segmented / Radio Card pattern) */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2">
            Export Scope
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setScope("ALL");
                setRangeError(null);
              }}
              className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer ${
                scope === "ALL"
                  ? "bg-blue-600/20 border-blue-500 text-white font-semibold ring-1 ring-blue-500"
                  : "bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Layers className="w-4 h-4 mx-auto mb-1 text-blue-400" />
              <span>Export All</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setScope("MONTH");
                setRangeError(null);
              }}
              className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer ${
                scope === "MONTH"
                  ? "bg-blue-600/20 border-blue-500 text-white font-semibold ring-1 ring-blue-500"
                  : "bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Calendar className="w-4 h-4 mx-auto mb-1 text-emerald-400" />
              <span>Select Month</span>
            </button>

            <button
              type="button"
              onClick={() => setScope("RANGE")}
              className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer ${
                scope === "RANGE"
                  ? "bg-blue-600/20 border-blue-500 text-white font-semibold ring-1 ring-blue-500"
                  : "bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Calendar className="w-4 h-4 mx-auto mb-1 text-cyan-400" />
              <span>Date Range</span>
            </button>
          </div>
        </div>

        {/* Option 1: Export All Info */}
        {scope === "ALL" && (
          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2 animate-in fade-in">
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Full Ledger Export</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Exports all recorded transactions in this ledger matching the current account and origin settings, without date restrictions.
            </p>
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Target Filename:</span>
              <span className="font-medium text-blue-400 font-mono">
                {previewFilename}
              </span>
            </div>
          </div>
        )}

        {/* Option 2: Select Month & Year */}
        {scope === "MONTH" && (
          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-3 animate-in fade-in">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Month
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={name} value={idx}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Year
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Included Period:</span>
                <span className="font-medium text-emerald-400 font-mono">
                  {monthInfo.previewText}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Target Filename:</span>
                <span className="font-medium text-emerald-400 font-mono">
                  {previewFilename}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Option 3: Select Date Range */}
        {scope === "RANGE" && (
          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-3 animate-in fade-in">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className={`w-full px-3 py-1.5 rounded-lg border bg-slate-800 text-xs text-slate-100 focus:outline-none ${
                    rangeError
                      ? "border-rose-500 focus:border-rose-500"
                      : "border-slate-700 focus:border-blue-500"
                  }`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className={`w-full px-3 py-1.5 rounded-lg border bg-slate-800 text-xs text-slate-100 focus:outline-none ${
                    rangeError
                      ? "border-rose-500 focus:border-rose-500"
                      : "border-slate-700 focus:border-blue-500"
                  }`}
                />
              </div>
            </div>

            {rangeError ? (
              <div className="flex items-center gap-1.5 text-rose-400 text-[11px]">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{rangeError}</span>
              </div>
            ) : startDate && endDate ? (
              <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Range:</span>
                  <span className="font-medium text-cyan-400 font-mono">
                    {startDate} through {endDate} (inclusive)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Target Filename:</span>
                  <span className="font-medium text-cyan-400 font-mono">
                    {previewFilename}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">
                Select both start and end dates to export records within that inclusive timeframe.
              </p>
            )}
          </div>
        )}

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isExporting}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleExecuteExport}
            loading={isExporting}
            disabled={
              isExporting ||
              (scope === "RANGE" && (!startDate || !endDate || Boolean(rangeError)))
            }
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export Excel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
