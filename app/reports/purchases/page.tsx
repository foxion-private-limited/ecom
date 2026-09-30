"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button, Card, Badge } from "@/lib/ui";
import {
  Receipt,
  ArrowLeft,
  RefreshCw,
  Download,
  Calendar,
  Truck,
} from "lucide-react";
import { formatINR, formatIndianDate } from "@/lib/utils";
import { toast } from "sonner";

export default function PurchasesReportPage() {
  const [preset, setPreset] = useState("THIS_MONTH");
  const [data, setData] = useState<{
    kpis: {
      totalPurchasesAmount: number;
      totalInputGst: number;
      totalInwardUnits: number;
      uniqueSuppliers: number;
    };
    rows: Array<{
      invoiceNumber: string;
      date: string;
      supplierName: string;
      productName: string;
      sku: string;
      quantity: number;
      purchasePrice: number;
      gstRate: number;
      gstAmount: number;
      total: number;
      paymentMode: string;
      paymentStatus: string;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("preset", preset);

      const res = await fetch(`/api/reports/purchases?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load purchases report");
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
    totalPurchasesAmount: 0,
    totalInputGst: 0,
    totalInwardUnits: 0,
    uniqueSuppliers: 0,
  };

  const handleExport = () => {
    window.open(`/api/excel/export?category=Purchases%20/%20Inventory%20Inward`, "_blank");
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
                Purchases & Procurement Report
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Inward stock batches, supplier procurement costs & input tax credit records
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

        {/* Date Filters */}
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
              Total Inward Purchases
            </span>
            <p className="text-xl font-bold text-rose-400 mt-1 font-mono">
              {formatINR(kpis.totalPurchasesAmount)}
            </p>
          </Card>

          <Card className="p-4 bg-slate-900/80 border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
              Input GST Credit
            </span>
            <p className="text-xl font-bold text-emerald-400 mt-1 font-mono">
              {formatINR(kpis.totalInputGst)}
            </p>
          </Card>

          <Card className="p-4 bg-slate-900/80 border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
              Total Units Inwarded
            </span>
            <p className="text-xl font-bold text-white mt-1">
              {kpis.totalInwardUnits} Units
            </p>
          </Card>

          <Card className="p-4 bg-slate-900/80 border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
              Active Suppliers
            </span>
            <p className="text-xl font-bold text-blue-400 mt-1">
              {kpis.uniqueSuppliers} Suppliers
            </p>
          </Card>
        </div>

        {/* Table */}
        <Card className="overflow-hidden border-slate-800 bg-slate-900/80">
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider z-10 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Invoice #</th>
                  <th className="py-3 px-3">Supplier</th>
                  <th className="py-3 px-3">Product</th>
                  <th className="py-3 px-3">SKU</th>
                  <th className="py-3 px-3 text-right">Inward Qty</th>
                  <th className="py-3 px-3 text-right">Purchase Price</th>
                  <th className="py-3 px-3 text-right">GST</th>
                  <th className="py-3 px-3 text-right">Total (₹)</th>
                  <th className="py-3 px-3">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
                      Loading procurement records...
                    </td>
                  </tr>
                ) : !data?.rows || data.rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      No purchase records found for this period.
                    </td>
                  </tr>
                ) : (
                  data.rows.map((row, idx) => (
                    <tr key={`${row.invoiceNumber}-${idx}`} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                        {formatIndianDate(row.date)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-blue-400 whitespace-nowrap font-semibold">
                        #{row.invoiceNumber}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-white whitespace-nowrap">
                        {row.supplierName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-200 max-w-xs truncate">
                        {row.productName}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-400 whitespace-nowrap">
                        {row.sku}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                        +{row.quantity}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                        {formatINR(row.purchasePrice)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                        {formatINR(row.gstAmount)} ({row.gstRate}%)
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-400">
                        {formatINR(row.total)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <Badge
                          variant={row.paymentStatus === "PAID" ? "success" : "warning"}
                          className="text-[9px]"
                        >
                          {row.paymentMode} ({row.paymentStatus})
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
    </AppLayout>
  );
}
