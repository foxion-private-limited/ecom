"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from "@/lib/ui";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowLeft,
  Download,
  RefreshCw,
} from "lucide-react";
import { formatINR, formatIndianDate } from "@/lib/utils";
import { toast } from "sonner";

function ImportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialType = searchParams.get("type") === "ECOMMERCE" ? "ECOMMERCE" : "MAIN";

  const [accountType, setAccountType] = useState<"MAIN" | "ECOMMERCE">(initialType);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [activeTab, setActiveTab] = useState<"ALL" | "VALID" | "WARNING" | "ERROR">("ALL");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setValidationResult(null);
      validateFile(selectedFile);
    }
  };

  const validateFile = async (f: File) => {
    setParsing(true);
    try {
      const formData = new FormData();
      formData.append("file", f);

      const res = await fetch("/api/excel/validate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to parse Excel file");
      }

      setValidationResult(data.summary);
      toast.success(
        `Parsed ${data.summary.totalRows} rows: ${data.summary.validCount} valid, ${data.summary.warningCount} warnings, ${data.summary.errorCount} errors.`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to validate file");
      setValidationResult(null);
    } finally {
      setParsing(false);
    }
  };

  const handleImportValidRows = async () => {
    if (!validationResult || validationResult.validCount === 0) {
      toast.error("No valid rows to import");
      return;
    }

    setImporting(true);
    try {
      // Filter only valid rows
      const validRows = validationResult.rows
        .filter((r: any) => r.isValid)
        .map((r: any) => r.data);

      const res = await fetch("/api/excel/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: validRows,
          accountType,
          filename: file?.name || "imported.xlsx",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Import failed");
      }

      toast.success(
        `Imported ${data.importedCount} rows successfully into ${accountType === "MAIN" ? "Main" : "Ecommerce"} Accounts!`
      );
      router.push(accountType === "MAIN" ? "/accounts/main" : "/accounts/ecommerce");
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const filteredRows =
    validationResult?.rows.filter((r: any) => {
      if (activeTab === "VALID") return r.isValid && r.warnings.length === 0;
      if (activeTab === "WARNING") return r.warnings.length > 0;
      if (activeTab === "ERROR") return !r.isValid;
      return true;
    }) || [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
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
              Upload `.xlsx` or `.xls` accounting records with automatic row validation & duplicate checking
            </p>
          </div>
        </div>

        {/* Account selector */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-lg">
          <button
            onClick={() => setAccountType("MAIN")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              accountType === "MAIN"
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Main Accounts
          </button>
          <button
            onClick={() => setAccountType("ECOMMERCE")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              accountType === "ECOMMERCE"
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Ecommerce Accounts
          </button>
        </div>
      </div>

      {/* Upload Box */}
      <Card className="border-slate-800 bg-slate-900/60 p-6 text-center">
        <input
          id="excelFileInput"
          type="file"
          accept=".xlsx, .xls"
          onChange={handleFileChange}
          className="hidden"
        />
        <label
          htmlFor="excelFileInput"
          className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-xl cursor-pointer bg-slate-950/40 hover:bg-slate-900/80 transition-all group"
        >
          <UploadCloud className="w-12 h-12 text-slate-400 group-hover:text-blue-400 transition-colors mb-3" />
          <span className="text-sm font-semibold text-white">
            {file ? file.name : "Click to select or drag and drop Excel file (.xlsx, .xls)"}
          </span>
          <span className="text-xs text-slate-400 mt-1">
            Supports Foxion standard 16-column accounting template
          </span>
        </label>
      </Card>

      {/* Parsing state */}
      {parsing && (
        <div className="p-8 text-center bg-slate-900/50 rounded-xl border border-slate-800">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-400 mb-2" />
          <p className="text-sm font-medium text-slate-200">
            Parsing Excel and validating rows...
          </p>
        </div>
      )}

      {/* Validation Summary & Preview */}
      {validationResult && !parsing && (
        <div className="space-y-4 animate-in fade-in">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4 bg-slate-900/70 border-slate-800">
              <span className="text-xs text-slate-400">Total Rows</span>
              <p className="text-xl font-bold text-white mt-1">
                {validationResult.totalRows}
              </p>
            </Card>

            <Card className="p-4 bg-emerald-950/30 border-emerald-800/50">
              <span className="text-xs text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Valid Rows
              </span>
              <p className="text-xl font-bold text-emerald-400 mt-1">
                {validationResult.validCount}
              </p>
            </Card>

            <Card className="p-4 bg-amber-950/30 border-amber-800/50">
              <span className="text-xs text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Warnings
              </span>
              <p className="text-xl font-bold text-amber-400 mt-1">
                {validationResult.warningCount}
              </p>
            </Card>

            <Card className="p-4 bg-rose-950/30 border-rose-800/50">
              <span className="text-xs text-rose-400 flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5" /> Errors
              </span>
              <p className="text-xl font-bold text-rose-400 mt-1">
                {validationResult.errorCount}
              </p>
            </Card>
          </div>

          {/* Tabs for rows */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab("ALL")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  activeTab === "ALL"
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                All Rows ({validationResult.totalRows})
              </button>
              <button
                onClick={() => setActiveTab("VALID")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  activeTab === "VALID"
                    ? "bg-emerald-900/60 text-emerald-300"
                    : "text-slate-400 hover:text-emerald-400"
                }`}
              >
                Valid Rows ({validationResult.validCount})
              </button>
              <button
                onClick={() => setActiveTab("WARNING")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  activeTab === "WARNING"
                    ? "bg-amber-900/60 text-amber-300"
                    : "text-slate-400 hover:text-amber-400"
                }`}
              >
                Warnings ({validationResult.warningCount})
              </button>
              <button
                onClick={() => setActiveTab("ERROR")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  activeTab === "ERROR"
                    ? "bg-rose-900/60 text-rose-300"
                    : "text-slate-400 hover:text-rose-400"
                }`}
              >
                Errors ({validationResult.errorCount})
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setFile(null);
                  setValidationResult(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="success"
                size="sm"
                disabled={validationResult.validCount === 0 || importing}
                loading={importing}
                onClick={handleImportValidRows}
              >
                Import {validationResult.validCount} Valid Rows
              </Button>
            </div>
          </div>

          {/* Rows Table */}
          <Card className="overflow-hidden border-slate-800">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Row</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-right">Debit</th>
                    <th className="py-2.5 px-3 text-right">Credit</th>
                    <th className="py-2.5 px-3">Mode</th>
                    <th className="py-2.5 px-3">Party</th>
                    <th className="py-2.5 px-3">Issues / Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredRows.slice(0, 100).map((r: any) => (
                    <tr
                      key={r.rowNumber}
                      className={
                        !r.isValid
                          ? "bg-rose-950/20"
                          : r.warnings.length > 0
                          ? "bg-amber-950/20"
                          : "hover:bg-slate-800/30"
                      }
                    >
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-400">
                        #{r.rowNumber}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        {!r.isValid ? (
                          <Badge variant="danger" className="text-[10px]">
                            Error
                          </Badge>
                        ) : r.warnings.length > 0 ? (
                          <Badge variant="warning" className="text-[10px]">
                            Warning
                          </Badge>
                        ) : (
                          <Badge variant="success" className="text-[10px]">
                            Valid
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-slate-300">
                        {formatIndianDate(r.data.date)}
                      </td>
                      <td className="py-2 px-3 text-white max-w-xs truncate">
                        {r.data.description || "—"}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-slate-300">
                        {r.data.category || "—"}
                      </td>
                      <td className="py-2 px-3 text-right text-rose-400 font-mono">
                        {r.data.debit > 0 ? formatINR(r.data.debit) : "—"}
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-400 font-mono">
                        {r.data.credit > 0 ? formatINR(r.data.credit) : "—"}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-slate-300">
                        {r.data.paymentMode}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-slate-300">
                        {r.data.partyName || "—"}
                      </td>
                      <td className="py-2 px-3 text-xs">
                        {r.errors.length > 0 && (
                          <div className="text-rose-400 text-[11px]">
                            {r.errors.join("; ")}
                          </div>
                        )}
                        {r.warnings.length > 0 && (
                          <div className="text-amber-400 text-[11px]">
                            {r.warnings.join("; ")}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function ExcelImportPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading import wizard...</div>}>
        <ImportContent />
      </Suspense>
    </AppLayout>
  );
}
