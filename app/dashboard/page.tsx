"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
} from "@/lib/ui";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  ShoppingCart,
  Receipt,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  RefreshCw,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Landmark,
  Wallet,
  Layers,
  Sparkles,
} from "lucide-react";
import { formatINR, formatIndianDate } from "@/lib/utils";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { TransactionFormModal } from "@/components/accounts/TransactionFormModal";
import { ProductFormModal } from "@/components/inventory/ProductFormModal";
import { PurchaseFormModal } from "@/components/purchases/PurchaseFormModal";
import { OrderFormModal } from "@/components/ecommerce/OrderFormModal";
import { toast } from "sonner";

export default function DashboardPage() {
  const [preset, setPreset] = useState("THIS_MONTH");
  const [accountType, setAccountType] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Quick Action Modal states
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isProdModalOpen, setIsProdModalOpen] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("preset", preset);
      params.set("accountType", accountType);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`/api/dashboard?${params.toString()}`);
      const json = await res.json();
      setData(json);
    } catch {
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [preset, accountType, startDate, endDate]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const kpis = data?.kpis || {
    totalRevenue: 0,
    revenueChange: 0,
    totalExpenses: 0,
    expenseChange: 0,
    grossProfit: 0,
    grossProfitChange: 0,
    netProfit: 0,
    netProfitChange: 0,
    bankBalance: 0,
    cashBalance: 0,
    inventoryValue: 0,
    totalStockUnits: 0,
  };

  const handleExportAccounts = () => {
    window.open(`/api/excel/export?accountType=${accountType}`, "_blank");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Top Control Bar: Date Range & Account Selector */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">
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
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  preset === p.id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Account:
            </span>
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setAccountType("ALL")}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  accountType === "ALL" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                All Accounts
              </button>
              <button
                onClick={() => setAccountType("MAIN")}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  accountType === "MAIN" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Main
              </button>
              <button
                onClick={() => setAccountType("ECOMMERCE")}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  accountType === "ECOMMERCE" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Ecommerce
              </button>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={fetchDashboardData}
              title="Refresh live metrics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-400" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Quick Actions Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 mr-1 uppercase tracking-wider">
            Quick Actions:
          </span>
          <Button size="sm" variant="primary" onClick={() => setIsTxModalOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Transaction
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setIsProdModalOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1 text-blue-400" /> Add Product
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setIsPurchaseModalOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Add Purchase
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setIsOrderModalOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1 text-amber-400" /> Add Order
          </Button>
          <Link href="/accounts/import">
            <Button size="sm" variant="outline">
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Import Excel
            </Button>
          </Link>
          <Button size="sm" variant="outline" onClick={handleExportAccounts}>
            <Download className="w-3.5 h-3.5 mr-1 text-blue-400" /> Export Accounts
          </Button>
        </div>

        {/* 8 KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Revenue */}
          <Card className="p-4 bg-slate-900/80 border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Total Revenue
              </span>
              <div className="p-1.5 rounded-lg bg-emerald-950/60 text-emerald-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-emerald-400 mt-2">
              {formatINR(kpis.totalRevenue)}
            </p>
            <div className="flex items-center gap-1 mt-1 text-xs">
              <span
                className={`font-semibold flex items-center ${
                  kpis.revenueChange >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {kpis.revenueChange >= 0 ? "+" : ""}
                {kpis.revenueChange}%
              </span>
              <span className="text-slate-400 text-[10px]">vs previous period</span>
            </div>
          </Card>

          {/* Card 2: Total Expenses */}
          <Card className="p-4 bg-slate-900/80 border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Total Expenses
              </span>
              <div className="p-1.5 rounded-lg bg-rose-950/60 text-rose-400">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-rose-400 mt-2">
              {formatINR(kpis.totalExpenses)}
            </p>
            <div className="flex items-center gap-1 mt-1 text-xs">
              <span
                className={`font-semibold flex items-center ${
                  kpis.expenseChange <= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {kpis.expenseChange >= 0 ? "+" : ""}
                {kpis.expenseChange}%
              </span>
              <span className="text-slate-400 text-[10px]">vs previous period</span>
            </div>
          </Card>

          {/* Card 3: Gross Profit */}
          <Card className="p-4 bg-slate-900/80 border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Gross Profit
              </span>
              <div className="p-1.5 rounded-lg bg-blue-950/60 text-blue-400">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-blue-400 mt-2">
              {formatINR(kpis.grossProfit)}
            </p>
            <div className="flex items-center gap-1 mt-1 text-xs">
              <span
                className={`font-semibold flex items-center ${
                  kpis.grossProfitChange >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {kpis.grossProfitChange >= 0 ? "+" : ""}
                {kpis.grossProfitChange}%
              </span>
              <span className="text-slate-400 text-[10px]">after direct COGS</span>
            </div>
          </Card>

          {/* Card 4: Net Profit */}
          <Card className="p-4 bg-slate-900/80 border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Net Profit
              </span>
              <div className="p-1.5 rounded-lg bg-indigo-950/60 text-indigo-400">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <p
              className={`text-2xl font-bold mt-2 ${
                kpis.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {formatINR(kpis.netProfit)}
            </p>
            <div className="flex items-center gap-1 mt-1 text-xs">
              <span
                className={`font-semibold flex items-center ${
                  kpis.netProfitChange >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {kpis.netProfitChange >= 0 ? "+" : ""}
                {kpis.netProfitChange}%
              </span>
              <span className="text-slate-400 text-[10px]">bottom line profit</span>
            </div>
          </Card>

          {/* Card 5: Bank Balance */}
          <Card className="p-4 bg-slate-900/80 border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Bank Account
              </span>
              <div className="p-1.5 rounded-lg bg-cyan-950/60 text-cyan-400">
                <Landmark className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-cyan-400 mt-2">
              {formatINR(kpis.bankBalance)}
            </p>
            <span className="text-slate-400 text-[10px] mt-1 block">Live Bank Ledger Balance</span>
          </Card>

          {/* Card 6: Cash in Hand */}
          <Card className="p-4 bg-slate-900/80 border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Cash in Hand
              </span>
              <div className="p-1.5 rounded-lg bg-amber-950/60 text-amber-400">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-amber-400 mt-2">
              {formatINR(kpis.cashBalance)}
            </p>
            <span className="text-slate-400 text-[10px] mt-1 block">Petty Cash & Cash Drawer</span>
          </Card>

          {/* Card 7: Total Inventory Value */}
          <Card className="p-4 bg-slate-900/80 border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Inventory Valuation
              </span>
              <div className="p-1.5 rounded-lg bg-purple-950/60 text-purple-400">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-purple-300 mt-2">
              {formatINR(kpis.inventoryValue)}
            </p>
            <span className="text-slate-400 text-[10px] mt-1 block">At purchase cost value</span>
          </Card>

          {/* Card 8: Total Stock Units */}
          <Card className="p-4 bg-slate-900/80 border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Total Stock Units
              </span>
              <div className="p-1.5 rounded-lg bg-slate-800 text-slate-300">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white mt-2">
              {kpis.totalStockUnits} Units
            </p>
            <span className="text-slate-400 text-[10px] mt-1 block">Across all generic products</span>
          </Card>
        </div>

        {/* Low Stock / Critical Stock Section */}
        {data?.lowStockAlerts && data.lowStockAlerts.length > 0 && (
          <Card className="p-4 border-amber-800/60 bg-amber-950/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-amber-300">
                  Inventory Stock Alerts
                </h3>
              </div>
              <Link href="/inventory/products?stockStatus=LOW" className="text-xs text-amber-400 hover:underline">
                View all items
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {data.lowStockAlerts.map((item: any) => (
                <div
                  key={item._id}
                  className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold text-white block">{item.name}</span>
                    <span className="text-[10px] font-mono text-slate-400">SKU: {item.sku}</span>
                  </div>
                  <Badge
                    variant={item.status === "CRITICAL" ? "danger" : "warning"}
                    className="text-[10px]"
                  >
                    {item.stock} Units ({item.status})
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 8 Recharts Visualizations */}
        {data?.charts && <DashboardCharts charts={data.charts} />}

        {/* Recent Activity: Transactions & Orders */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Transactions */}
          <Card className="p-5 border-slate-800 bg-slate-900/80">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <CardTitle className="text-sm font-semibold text-white">
                Recent Transactions
              </CardTitle>
              <Link href="/accounts/main" className="text-xs text-blue-400 hover:underline">
                View All
              </Link>
            </div>
            <div className="divide-y divide-slate-800/60 mt-2 text-xs">
              {!data?.recentTransactions || data.recentTransactions.length === 0 ? (
                <div className="py-6 text-center text-slate-400">No recent transactions</div>
              ) : (
                data.recentTransactions.map((tx: any) => (
                  <div key={tx._id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-white block truncate max-w-xs">
                        {tx.description}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span>{formatIndianDate(tx.date)}</span>
                        <span>•</span>
                        <span>{tx.category}</span>
                        <span>•</span>
                        <span>{tx.paymentMode}</span>
                      </div>
                    </div>
                    <div className="text-right font-mono font-bold whitespace-nowrap">
                      {tx.debit > 0 ? (
                        <span className="text-rose-400">-{formatINR(tx.debit)}</span>
                      ) : (
                        <span className="text-emerald-400">+{formatINR(tx.credit)}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Recent Orders */}
          <Card className="p-5 border-slate-800 bg-slate-900/80">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <CardTitle className="text-sm font-semibold text-white">
                Recent Marketplace Orders
              </CardTitle>
              <Link href="/ecommerce/orders" className="text-xs text-blue-400 hover:underline">
                View All
              </Link>
            </div>
            <div className="divide-y divide-slate-800/60 mt-2 text-xs">
              {!data?.recentOrders || data.recentOrders.length === 0 ? (
                <div className="py-6 text-center text-slate-400">No recent orders</div>
              ) : (
                data.recentOrders.map((o: any) => (
                  <div key={o._id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-blue-400">
                          #{o.orderId}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {o.platform}
                        </Badge>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Customer: {o.customerName} • {formatIndianDate(o.date)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-emerald-400 block">
                        {formatINR(o.netAmount)}
                      </span>
                      <Badge
                        variant={o.orderStatus === "DELIVERED" ? "success" : "warning"}
                        className="text-[9px] py-0"
                      >
                        {o.orderStatus}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Quick Action Modals */}
        <TransactionFormModal
          isOpen={isTxModalOpen}
          onClose={() => setIsTxModalOpen(false)}
          onSuccess={fetchDashboardData}
        />
        <ProductFormModal
          isOpen={isProdModalOpen}
          onClose={() => setIsProdModalOpen(false)}
          onSuccess={fetchDashboardData}
        />
        <PurchaseFormModal
          isOpen={isPurchaseModalOpen}
          onClose={() => setIsPurchaseModalOpen(false)}
          onSuccess={fetchDashboardData}
        />
        <OrderFormModal
          isOpen={isOrderModalOpen}
          onClose={() => setIsOrderModalOpen(false)}
          onSuccess={fetchDashboardData}
        />
      </div>
    </AppLayout>
  );
}
