"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button, Card, Badge } from "@/lib/ui";
import {
  ShoppingCart,
  Plus,
  Search,
  RefreshCw,
  RotateCcw,
  CheckCircle,
  Truck,
  DollarSign,
  Layers,
} from "lucide-react";
import { formatINR, formatIndianDate } from "@/lib/utils";
import { OrderFormModal } from "@/components/ecommerce/OrderFormModal";
import { OrderReturnModal } from "@/components/ecommerce/OrderReturnModal";
import { toast } from "sonner";

export default function EcommerceOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("ALL");
  const [orderStatus, setOrderStatus] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedOrderForReturn, setSelectedOrderForReturn] = useState<any>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (platform !== "ALL") params.set("platform", platform);
      if (orderStatus !== "ALL") params.set("orderStatus", orderStatus);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`/api/orders?${params.toString()}`);
      const data = await res.json();
      if (data.orders) setOrders(data.orders);
    } catch {
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [search, platform, orderStatus, startDate, endDate]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Aggregates
  const totalRevenue = orders.reduce((acc, curr) => acc + curr.netAmount, 0);
  const totalProfit = orders.reduce((acc, curr) => acc + (curr.grossProfit || 0), 0);
  const deliveredCount = orders.filter((o) => o.orderStatus === "DELIVERED").length;
  const returnedCount = orders.filter((o) => o.orderStatus === "RETURNED").length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Ecommerce Orders & Sales
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Multi-marketplace orders, real-time inventory deduction, marketplace fee tracking, and return workflows
            </p>
          </div>

          <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Create Order
          </Button>
        </div>

        {/* Summary KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-slate-900/60 border-slate-800">
            <span className="text-xs text-slate-400">Total Orders</span>
            <p className="text-2xl font-bold text-white mt-1">{orders.length}</p>
          </Card>

          <Card className="p-4 bg-slate-900/60 border-slate-800">
            <span className="text-xs text-slate-400">Gross Sales Revenue</span>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{formatINR(totalRevenue)}</p>
          </Card>

          <Card className="p-4 bg-slate-900/60 border-slate-800">
            <span className="text-xs text-slate-400">Total Gross Profit (After COGS & Fees)</span>
            <p className="text-2xl font-bold text-blue-400 mt-1">{formatINR(totalProfit)}</p>
          </Card>

          <Card className="p-4 bg-slate-900/60 border-slate-800">
            <span className="text-xs text-slate-400">Delivered / Returned</span>
            <p className="text-2xl font-bold text-slate-200 mt-1">
              {deliveredCount} / <span className="text-rose-400">{returnedCount}</span>
            </p>
          </Card>
        </div>

        {/* Filter bar */}
        <Card className="p-4 bg-slate-900/60 border-slate-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search order ID, customer, product..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Platforms</option>
                <option value="Amazon">Amazon</option>
                <option value="Meesho">Meesho</option>
                <option value="Flipkart">Flipkart</option>
                <option value="Direct">Direct</option>
                <option value="Instagram">Instagram</option>
              </select>
            </div>

            <div>
              <select
                value={orderStatus}
                onChange={(e) => setOrderStatus(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="DELIVERED">Delivered</option>
                <option value="SHIPPED">Shipped</option>
                <option value="PENDING">Pending</option>
                <option value="RETURNED">Returned</option>
              </select>
            </div>

            <div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
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
                  <th className="py-3 px-3">Order ID</th>
                  <th className="py-3 px-3">Platform</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Ordered Items</th>
                  <th className="py-3 px-3 text-right">Net Revenue</th>
                  <th className="py-3 px-3 text-right">Estimated COGS</th>
                  <th className="py-3 px-3 text-right">Gross Profit</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
                      Loading orders...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-slate-400">
                      No ecommerce orders found.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o._id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                        {formatIndianDate(o.date)}
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-blue-400 whitespace-nowrap">
                        #{o.orderId}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <Badge
                          variant={
                            o.platform === "Amazon"
                              ? "warning"
                              : o.platform === "Meesho"
                              ? "danger"
                              : o.platform === "Flipkart"
                              ? "info"
                              : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {o.platform}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-white whitespace-nowrap">
                        {o.customerName}
                      </td>
                      <td className="py-3 px-3 max-w-xs text-slate-300 truncate">
                        {o.items?.map((i: any) => `${i.productName} ×${i.quantity}`).join(", ")}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                        {formatINR(o.netAmount)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-400 whitespace-nowrap">
                        {formatINR(o.estimatedCogs)}
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-mono font-bold whitespace-nowrap ${
                          o.grossProfit >= 0 ? "text-blue-400" : "text-rose-400"
                        }`}
                      >
                        {formatINR(o.grossProfit)}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <Badge
                          variant={
                            o.orderStatus === "DELIVERED"
                              ? "success"
                              : o.orderStatus === "RETURNED"
                              ? "danger"
                              : "warning"
                          }
                          className="text-[10px]"
                        >
                          {o.orderStatus}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {o.orderStatus !== "RETURNED" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setSelectedOrderForReturn(o)}
                          >
                            <RotateCcw className="w-3 h-3 mr-1 text-rose-400" />
                            Return
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Create Order Modal */}
        <OrderFormModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={fetchOrders}
        />

        {/* Process Return Modal */}
        <OrderReturnModal
          isOpen={!!selectedOrderForReturn}
          onClose={() => setSelectedOrderForReturn(null)}
          onSuccess={fetchOrders}
          order={selectedOrderForReturn}
        />
      </div>
    </AppLayout>
  );
}
