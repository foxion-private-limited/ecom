"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, Button, Badge } from "@/lib/ui";
import { Landmark, Wallet, RefreshCw, Printer } from "lucide-react";
import { formatINR, formatIndianDate } from "@/lib/utils";
import { toast } from "sonner";

export default function CashFlowReportPage() {
  const [preset, setPreset] = useState("THIS_MONTH");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchCashFlow = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/cashflow?preset=${preset}`);
      const json = await res.json();
      setData(json);
    } catch {
      toast.error("Failed to load Cash Flow statement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCashFlow();
  }, [preset]);

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Cash Flow Statement
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Monthly cash & bank liquidity inflows, operational outflows, and net cash generation
            </p>
          </div>

          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer className="w-3.5 h-3.5 mr-1" />
            Print
          </Button>
        </div>

        {/* Preset Selector */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-lg text-xs">
          {[
            { id: "THIS_MONTH", label: "This Month" },
            { id: "LAST_MONTH", label: "Last Month" },
            { id: "THIS_YEAR", label: "This Year" },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`px-3 py-1.5 font-semibold rounded-md transition-colors cursor-pointer ${
                preset === p.id
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
            Calculating cash flow...
          </div>
        ) : !data ? (
          <div className="py-12 text-center text-slate-400">No data available.</div>
        ) : (
          <div className="space-y-4">
            {/* Top Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-4 bg-slate-900/80 border-slate-800">
                <span className="text-xs text-slate-400 block">Total Liquidity Inflows</span>
                <p className="text-2xl font-bold text-emerald-400 mt-1">
                  +{formatINR(data.totalInflow)}
                </p>
              </Card>

              <Card className="p-4 bg-slate-900/80 border-slate-800">
                <span className="text-xs text-slate-400 block">Total Liquidity Outflows</span>
                <p className="text-2xl font-bold text-rose-400 mt-1">
                  -{formatINR(data.totalOutflow)}
                </p>
              </Card>

              <Card
                className={`p-4 border ${
                  data.netCashFlow >= 0
                    ? "bg-emerald-950/30 border-emerald-800/50"
                    : "bg-rose-950/30 border-rose-800/50"
                }`}
              >
                <span className="text-xs text-slate-300 block">Net Liquidity Movement</span>
                <p
                  className={`text-2xl font-bold mt-1 ${
                    data.netCashFlow >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {formatINR(data.netCashFlow)}
                </p>
              </Card>
            </div>

            {/* Split: Bank vs Cash */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-5 border-slate-800 bg-slate-900/90 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-cyan-400">
                  <Landmark className="w-4 h-4" />
                  <span>Bank Account Movement</span>
                </div>
                <div className="space-y-2 text-xs pt-2 border-t border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Bank Deposits & Inflows:</span>
                    <span className="font-mono text-emerald-400 font-bold">+{formatINR(data.bank.inflow)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Bank Withdrawals & Debits:</span>
                    <span className="font-mono text-rose-400 font-bold">-{formatINR(data.bank.outflow)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-800 font-bold">
                    <span className="text-slate-200">Net Bank Movement:</span>
                    <span className="font-mono text-cyan-400">{formatINR(data.bank.net)}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-5 border-slate-800 bg-slate-900/90 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-amber-400">
                  <Wallet className="w-4 h-4" />
                  <span>Cash Drawer Movement</span>
                </div>
                <div className="space-y-2 text-xs pt-2 border-t border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cash Receipts:</span>
                    <span className="font-mono text-emerald-400 font-bold">+{formatINR(data.cash.inflow)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cash Expenses:</span>
                    <span className="font-mono text-rose-400 font-bold">-{formatINR(data.cash.outflow)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-800 font-bold">
                    <span className="text-slate-200">Net Cash Movement:</span>
                    <span className="font-mono text-amber-400">{formatINR(data.cash.net)}</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
