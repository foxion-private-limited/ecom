"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button, Card, Badge } from "@/lib/ui";
import {
  Receipt,
  Plus,
  Search,
  RefreshCw,
  Eye,
  CheckCircle,
  FileSpreadsheet,
} from "lucide-react";
import { formatINR, formatIndianDate } from "@/lib/utils";
import { PurchaseFormModal } from "@/components/purchases/PurchaseFormModal";
import { toast } from "sonner";

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`/api/purchases?${params.toString()}`);
      const data = await res.json();
      if (data.purchases) setPurchases(data.purchases);
    } catch {
      toast.error("Failed to load purchases");
    } finally {
      setLoading(false);
    }
  }, [search, startDate, endDate]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  // Aggregates
  const totalAmount = purchases.reduce((acc, curr) => acc + curr.totalAmount, 0);
  const totalGst = purchases.reduce((acc, curr) => acc + (curr.totalGst || 0), 0);
  const totalUnits = purchases.reduce(
    (acc, curr) =>
      acc +
      (curr.items?.reduce((iAcc: number, item: any) => iAcc + item.quantity, 0) || 0),
    0
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Purchases & Supplier Inward
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Supplier orders, inward inventory movements, and automated Main Accounts debit transactions
            </p>
          </div>

          <Button variant="primary" onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Record Purchase
          </Button>
        </div>

        {/* 3 Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 bg-slate-900/60 border-slate-800">
            <span className="text-xs text-slate-400">Total Purchases Value</span>
            <p className="text-2xl font-bold text-rose-400 mt-1">
              {formatINR(totalAmount)}
            </p>
          </Card>

          <Card className="p-4 bg-slate-900/60 border-slate-800">
            <span className="text-xs text-slate-400">Total Inward Units</span>
            <p className="text-2xl font-bold text-blue-400 mt-1">
              {totalUnits} Units
            </p>
          </Card>

          <Card className="p-4 bg-slate-900/60 border-slate-800">
            <span className="text-xs text-slate-400">Total Input GST Paid</span>
            <p className="text-2xl font-bold text-cyan-400 mt-1">
              {formatINR(totalGst)}
            </p>
          </Card>
        </div>

        {/* Filter bar */}
        <Card className="p-4 bg-slate-900/60 border-slate-800">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoice, supplier, product..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <input
                type="date"
                placeholder="From Date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <input
                type="date"
                placeholder="To Date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </Card>

        {/* Table */}
        <Card className="overflow-hidden border-slate-800 bg-slate-900/70">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-3">Invoice #</th>
                  <th className="py-3 px-3">Supplier</th>
                  <th className="py-3 px-3">Purchased Items</th>
                  <th className="py-3 px-3 text-right">Subtotal</th>
                  <th className="py-3 px-3 text-right">GST</th>
                  <th className="py-3 px-3 text-right">Total Amount</th>
                  <th className="py-3 px-3">Payment Mode</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
                      Loading purchases...
                    </td>
                  </tr>
                ) : purchases.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-400">
                      No purchase invoices recorded yet.
                    </td>
                  </tr>
                ) : (
                  purchases.map((p) => (
                    <tr key={p._id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                        {formatIndianDate(p.date)}
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-blue-400 whitespace-nowrap">
                        #{p.invoiceNumber}
                      </td>
                      <td className="py-3 px-3 font-medium text-white whitespace-nowrap">
                        {p.supplierName}
                      </td>
                      <td className="py-3 px-3 max-w-xs text-slate-300 truncate">
                        {p.items?.map((i: any) => `${i.productName} (${i.quantity})`).join(", ")}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-300 whitespace-nowrap">
                        {formatINR(p.subtotal)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-400 whitespace-nowrap">
                        {formatINR(p.totalGst)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-rose-400 whitespace-nowrap">
                        {formatINR(p.totalAmount)}
                      </td>
                      <td className="py-3 px-3 text-slate-300 whitespace-nowrap">
                        {p.paymentMode}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <Badge
                          variant={p.paymentStatus === "PAID" ? "success" : "warning"}
                          className="text-[10px]"
                        >
                          {p.paymentStatus}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <PurchaseFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={fetchPurchases}
        />
      </div>
    </AppLayout>
  );
}
