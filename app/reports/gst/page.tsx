"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, Button, Badge } from "@/lib/ui";
import { ShieldCheck, RefreshCw, Printer } from "lucide-react";
import { formatINR, formatIndianDate } from "@/lib/utils";
import { toast } from "sonner";

export default function GSTReportPage() {
  const [preset, setPreset] = useState("THIS_MONTH");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchGst = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/gst?preset=${preset}`);
      const json = await res.json();
      setData(json);
    } catch {
      toast.error("Failed to load GST report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGst();
  }, [preset]);

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              GST Compliance & Tax Summary
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Input Tax Credit (ITC) on inward purchases vs Output GST collected on ecommerce sales
            </p>
          </div>

          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer className="w-3.5 h-3.5 mr-1" />
            Print Summary
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
            Calculating GST totals...
          </div>
        ) : !data ? (
          <div className="py-12 text-center text-slate-400">No GST data found.</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-4 bg-slate-900/80 border-slate-800">
                <span className="text-xs text-slate-400 block">
                  Output GST (Collected on Sales)
                </span>
                <p className="text-2xl font-bold text-emerald-400 mt-1">
                  {formatINR(data.outputGst.gstAmount)}
                </p>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  On {formatINR(data.outputGst.salesAmount)} gross taxable sales
                </span>
              </Card>

              <Card className="p-4 bg-slate-900/80 border-slate-800">
                <span className="text-xs text-slate-400 block">
                  Input Tax Credit (ITC Paid)
                </span>
                <p className="text-2xl font-bold text-blue-400 mt-1">
                  {formatINR(data.inputGst.totalInputGst)}
                </p>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  On purchases & business expenses
                </span>
              </Card>

              <Card
                className={`p-4 border ${
                  data.netGstPayable > 0
                    ? "bg-rose-950/30 border-rose-800/50"
                    : "bg-emerald-950/30 border-emerald-800/50"
                }`}
              >
                <span className="text-xs text-slate-300 block">
                  Net GST Tax Payable / (Credit)
                </span>
                <p
                  className={`text-2xl font-bold mt-1 ${
                    data.netGstPayable > 0 ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  {formatINR(data.netGstPayable)}
                </p>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {data.netGstPayable > 0 ? "Payable to Govt" : "ITC Available to Carry Forward"}
                </span>
              </Card>
            </div>

            <Card className="p-6 border-slate-800 bg-slate-900/90 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Detailed GST Ledger Breakdown
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-300">GST on Purchases (Inward Invoices):</span>
                  <span className="font-mono text-white font-bold">{formatINR(data.inputGst.purchasesGst)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-300">GST on Operational Expenses (Rent/Packaging/Ads):</span>
                  <span className="font-mono text-white font-bold">{formatINR(data.inputGst.expensesGst)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-300">Total Eligible Input Tax Credit (ITC):</span>
                  <span className="font-mono text-blue-400 font-bold">{formatINR(data.inputGst.totalInputGst)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-300">Total Output GST Collected:</span>
                  <span className="font-mono text-emerald-400 font-bold">{formatINR(data.outputGst.gstAmount)}</span>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
