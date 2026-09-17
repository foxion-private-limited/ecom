"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, Button, Badge } from "@/lib/ui";
import {
  DollarSign,
  Download,
  Printer,
  RefreshCw,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";
import { formatINR, formatIndianDate } from "@/lib/utils";
import { toast } from "sonner";

export default function ProfitAndLossPage() {
  const [preset, setPreset] = useState("THIS_MONTH");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchPnl = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/pnl?preset=${preset}`);
      const json = await res.json();
      setData(json);
    } catch {
      toast.error("Failed to load Profit & Loss report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPnl();
  }, [preset]);

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Profit & Loss Statement
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Accurate business statement incorporating Revenue, Product COGS, Platform Fees, and Operating Overheads
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer className="w-3.5 h-3.5 mr-1" />
              Print
            </Button>
          </div>
        </div>

        {/* Preset Selector */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-lg text-xs overflow-x-auto">
          {[
            { id: "THIS_MONTH", label: "This Month" },
            { id: "LAST_MONTH", label: "Last Month" },
            { id: "THIS_YEAR", label: "This Year" },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`px-3 py-1.5 font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
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
            Computing Profit & Loss figures...
          </div>
        ) : !data ? (
          <div className="py-12 text-center text-slate-400">No data available.</div>
        ) : (
          <Card className="p-6 border-slate-800 bg-slate-900/90 space-y-6 font-sans">
            <div className="border-b border-slate-800 pb-4 text-center">
              <h2 className="text-lg font-bold text-white uppercase tracking-wider">
                Foxion
              </h2>
              <span className="text-xs text-slate-400 block mt-0.5">
                Statement of Profit and Loss
              </span>
              <span className="text-[11px] text-slate-500 font-mono block mt-1">
                Period: {formatIndianDate(data.period.start)} to{" "}
                {formatIndianDate(data.period.end)}
              </span>
            </div>

            {/* Section 1: Revenue */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm font-bold text-emerald-400 border-b border-slate-800 pb-1.5 uppercase tracking-wider text-xs">
                <span>1. Gross Sales Revenue</span>
                <span className="font-mono">{formatINR(data.revenue.totalSalesRevenue)}</span>
              </div>
              <div className="pl-4 space-y-1 text-xs">
                {data.revenue.breakdown?.map((b: any) => (
                  <div key={b._id} className="flex justify-between text-slate-300">
                    <span>{b._id}</span>
                    <span className="font-mono text-slate-400">{formatINR(b.total)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2: COGS & Direct Cost */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm font-bold text-rose-400 border-b border-slate-800 pb-1.5 uppercase tracking-wider text-xs">
                <span>2. Cost of Goods Sold & Direct Deductions</span>
                <span className="font-mono">-{formatINR(data.cogs.totalDirectCosts)}</span>
              </div>
              <div className="pl-4 space-y-1.5 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span>Product Procurement Cost (COGS at purchase price):</span>
                  <span className="font-mono text-slate-400">-{formatINR(data.cogs.productCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Marketplace Commissions & Payment Fees:</span>
                  <span className="font-mono text-slate-400">-{formatINR(data.cogs.marketplaceFees)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping & Freight Outward:</span>
                  <span className="font-mono text-slate-400">-{formatINR(data.cogs.shippingFees)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Packaging Materials Cost:</span>
                  <span className="font-mono text-slate-400">-{formatINR(data.cogs.packagingFees)}</span>
                </div>
              </div>
            </div>

            {/* Subtotal: Gross Profit */}
            <div className="p-3 rounded-lg bg-blue-950/40 border border-blue-800/40 flex justify-between items-center text-sm font-bold">
              <div className="flex items-center gap-2">
                <span className="text-white uppercase tracking-wider text-xs">
                  Gross Profit (Margin: {data.grossMargin.toFixed(1)}%)
                </span>
              </div>
              <span className="font-mono text-blue-400 text-base">
                {formatINR(data.grossProfit)}
              </span>
            </div>

            {/* Section 3: Operating Expenses */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm font-bold text-rose-400 border-b border-slate-800 pb-1.5 uppercase tracking-wider text-xs">
                <span>3. Operating & Administrative Overheads</span>
                <span className="font-mono">-{formatINR(data.totalOperatingExpenses)}</span>
              </div>
              <div className="pl-4 space-y-1.5 text-xs text-slate-300">
                {data.operatingExpenses?.length === 0 ? (
                  <div className="text-slate-500">No overhead debits recorded in this period.</div>
                ) : (
                  data.operatingExpenses.map((oe: any) => (
                    <div key={oe.category} className="flex justify-between">
                      <span>{oe.category}:</span>
                      <span className="font-mono text-slate-400">-{formatINR(oe.amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Final Net Profit */}
            <div
              className={`p-4 rounded-xl border flex justify-between items-center text-base font-bold ${
                data.netProfit >= 0
                  ? "bg-emerald-950/50 border-emerald-800/60 text-emerald-400"
                  : "bg-rose-950/50 border-rose-800/60 text-rose-400"
              }`}
            >
              <div>
                <span className="block text-xs uppercase tracking-wider text-slate-300">
                  Net Bottom-Line Profit
                </span>
                <span className="text-xs text-slate-400 font-normal">
                  Net Profit Margin: {data.netProfitMargin.toFixed(1)}%
                </span>
              </div>
              <span className="text-2xl font-mono">
                {formatINR(data.netProfit)}
              </span>
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
