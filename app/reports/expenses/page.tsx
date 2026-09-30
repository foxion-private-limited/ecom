"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, Button, Badge } from "@/lib/ui";
import {
  FileText,
  RefreshCw,
  Download,
  ArrowLeft,
  Calendar,
  Layers,
} from "lucide-react";
import { formatINR, formatIndianDate } from "@/lib/utils";
import { toast } from "sonner";

export default function ExpenseReportPage() {
  const [preset, setPreset] = useState("THIS_MONTH");
  const [data, setData] = useState<{
    kpis: {
      totalExpense: number;
      bankPaid: number;
      cashPaid: number;
      topCategory: string;
      topCategoryAmount: number;
    };
    byCategory: Array<{
      category: string;
      amount: number;
      count: number;
      percentage: number;
    }>;
    rows: Array<{
      date: string;
      description: string;
      category: string;
      amount: number;
      paymentMode: string;
      bankOrCash: string;
      partyName?: string;
      billAvailable?: boolean;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/expenses?preset=${preset}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load expenses report");
      setData(json);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error loading report";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [preset]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const kpis = data?.kpis || {
    totalExpense: 0,
    bankPaid: 0,
    cashPaid: 0,
    topCategory: "—",
    topCategoryAmount: 0,
  };

  const handleExport = () => {
    window.open(`/api/excel/export`, "_blank");
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/reports"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Operational Expenses Report
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Main Accounts expense debits categorized by administrative and operational head
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
              Export Excel
            </Button>
            <Button variant="secondary" size="sm" onClick={fetchReport}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-400" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Date Filter */}
        <Card className="p-3 bg-slate-900/80 border-slate-800 flex items-center gap-2 overflow-x-auto">
          <span className="text-xs text-slate-400 font-semibold uppercase mr-1">
            Period:
          </span>
          {[
            { id: "TODAY", label: "Today" },
            { id: "THIS_WEEK", label: "This Week" },
            { id: "THIS_MONTH", label: "This Month" },
            { id: "LAST_MONTH", label: "Last Month" },
            { id: "THIS_YEAR", label: "This Year" },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                preset === p.id
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </Card>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4 bg-slate-900/80 border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
              Total Operating Expenses
            </span>
            <p className="text-xl font-bold text-rose-400 mt-1 font-mono">
              {formatINR(kpis.totalExpense)}
            </p>
          </Card>

          <Card className="p-4 bg-slate-900/80 border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
              Paid via Bank (NEFT / UPI)
            </span>
            <p className="text-xl font-bold text-cyan-400 mt-1 font-mono">
              {formatINR(kpis.bankPaid)}
            </p>
          </Card>

          <Card className="p-4 bg-slate-900/80 border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
              Paid in Cash
            </span>
            <p className="text-xl font-bold text-amber-400 mt-1 font-mono">
              {formatINR(kpis.cashPaid)}
            </p>
          </Card>

          <Card className="p-4 bg-slate-900/80 border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
              Highest Expense Head
            </span>
            <p className="text-base font-bold text-white mt-1 truncate">
              {kpis.topCategory}
            </p>
            <span className="text-[10px] text-rose-400 font-mono">
              {formatINR(kpis.topCategoryAmount)}
            </span>
          </Card>
        </div>

        {/* Category Breakdown & Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Category Breakdown */}
          <Card className="p-5 border-slate-800 bg-slate-900/80 space-y-3">
            <h3 className="text-sm font-semibold text-white">Expense Distribution</h3>
            <div className="space-y-3 text-xs">
              {data?.byCategory?.map((cat) => (
                <div key={cat.category} className="space-y-1">
                  <div className="flex justify-between font-medium">
                    <span className="text-slate-200">{cat.category}</span>
                    <span className="font-mono text-rose-400">{formatINR(cat.amount)} ({cat.percentage}%)</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full"
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Details Table */}
          <Card className="lg:col-span-2 overflow-hidden border-slate-800 bg-slate-900/80">
            <div className="overflow-x-auto max-h-[460px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider z-10 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                    <th className="py-2.5 px-3">Mode</th>
                    <th className="py-2.5 px-3">Account</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
                        Loading expenses...
                      </td>
                    </tr>
                  ) : !data?.rows || data.rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No expense records in this period.
                      </td>
                    </tr>
                  ) : (
                    data.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                          {formatIndianDate(row.date)}
                        </td>
                        <td className="py-2 px-3 font-medium text-white max-w-xs truncate">
                          {row.description}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <Badge variant="secondary" className="text-[10px]">
                            {row.category}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-rose-400 whitespace-nowrap">
                          {formatINR(row.amount)}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-slate-300">
                          {row.paymentMode}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <Badge
                            variant={row.bankOrCash === "Bank" ? "info" : "warning"}
                            className="text-[10px]"
                          >
                            {row.bankOrCash}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
