"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from "@/lib/ui";
import {
  TrendingUp,
  ArrowLeft,
  RefreshCw,
  Download,
  Calendar,
  Layers,
  ShoppingBag,
} from "lucide-react";
import { formatINR, formatIndianDate } from "@/lib/utils";
import { toast } from "sonner";

export default function SalesReportPage() {
  const [preset, setPreset] = useState("THIS_MONTH");
  const [platform, setPlatform] = useState("ALL");
  const [data, setData] = useState<{
    kpis: {
      totalSales: number;
      totalUnits: number;
      totalOrders: number;
      averageOrderValue: number;
      grossProfit: number;
      margin: number;
    };
    rows: Array<{
      orderId: string;
      date: string;
      platform: string;
      customerName: string;
      productName: string;
      sku: string;
      quantity: number;
      sellingPrice: number;
      total: number;
      orderStatus: string;
      paymentStatus: string;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("preset", preset);
      if (platform !== "ALL") params.set("platform", platform);

      const res = await fetch(`/api/reports/sales?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load sales report");
      setData(json);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error loading report";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [preset, platform]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const kpis = data?.kpis || {
    totalSales: 0,
    totalUnits: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    grossProfit: 0,
    margin: 0,
  };

  const handleExport = () => {
    window.open(`/api/excel/export`, "_blank");
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Top Header */}
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
                Sales Performance Report
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Marketplace dispatch revenue, volume & gross profitability breakdown
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

        {/* Controls */}
        <Card className="p-3 bg-slate-900/80 border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
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
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  preset === p.id
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold uppercase">
              Platform:
            </span>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Platforms</option>
              <option value="Amazon">Amazon</option>
              <option value="Meesho">Meesho</option>
              <option value="Flipkart">Flipkart</option>
              <option value="Direct">Direct Store</option>
              <option value="Instagram">Instagram</option>
            </select>
          </div>
        </Card>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Card className="p-4 bg-slate-900/80 border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
              Gross Sales Revenue
            </span>
            <p className="text-xl font-bold text-emerald-400 mt-1 font-mono">
              {formatINR(kpis.totalSales)}
            </p>
          </Card>

          <Card className="p-4 bg-slate-900/80 border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
              Units Sold
            </span>
            <p className="text-xl font-bold text-white mt-1">
              {kpis.totalUnits} Units
            </p>
          </Card>

          <Card className="p-4 bg-slate-900/80 border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
              Total Orders
            </span>
            <p className="text-xl font-bold text-blue-400 mt-1">
              {kpis.totalOrders} Orders
            </p>
          </Card>

          <Card className="p-4 bg-slate-900/80 border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
              Avg Order Value
            </span>
            <p className="text-xl font-bold text-slate-200 mt-1 font-mono">
              {formatINR(kpis.averageOrderValue)}
            </p>
          </Card>

          <Card className="p-4 bg-slate-900/80 border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
              Gross Margin
            </span>
            <p className="text-xl font-bold text-emerald-400 mt-1">
              {kpis.margin}% ({formatINR(kpis.grossProfit)})
            </p>
          </Card>
        </div>

        {/* Data Table */}
        <Card className="overflow-hidden border-slate-800 bg-slate-900/80">
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider z-10 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Order ID</th>
                  <th className="py-3 px-3">Platform</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Product Name</th>
                  <th className="py-3 px-3">SKU</th>
                  <th className="py-3 px-3 text-right">Quantity</th>
                  <th className="py-3 px-3 text-right">Selling Price</th>
                  <th className="py-3 px-3 text-right">Total (₹)</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
                      Loading sales records...
                    </td>
                  </tr>
                ) : !data?.rows || data.rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      No sales records found for this period.
                    </td>
                  </tr>
                ) : (
                  data.rows.map((row, idx) => (
                    <tr key={`${row.orderId}-${idx}`} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                        {formatIndianDate(row.date)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-blue-400 whitespace-nowrap font-semibold">
                        #{row.orderId}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <Badge variant="secondary" className="text-[10px]">
                          {row.platform}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-slate-200 whitespace-nowrap">
                        {row.customerName}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-white max-w-xs truncate">
                        {row.productName}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-400 whitespace-nowrap">
                        {row.sku}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                        {row.quantity}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                        {formatINR(row.sellingPrice)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                        {formatINR(row.total)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge
                          variant={row.orderStatus === "DELIVERED" ? "success" : "warning"}
                          className="text-[9px]"
                        >
                          {row.orderStatus}
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
