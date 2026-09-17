"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button, Card, Badge } from "@/lib/ui";
import {
  ArrowLeft,
  Package,
  History,
  TrendingUp,
  Receipt,
  DollarSign,
  Edit2,
  RefreshCw,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";
import { formatINR, formatIndianDate } from "@/lib/utils";
import { ProductFormModal } from "@/components/inventory/ProductFormModal";
import { toast } from "sonner";

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "MOVEMENTS" | "SALES" | "PURCHASES" | "PROFIT">("OVERVIEW");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${id}`);
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "Product not found");
      }
      setData(json);
    } catch (err: any) {
      toast.error(err.message || "Failed to load product details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  if (loading) {
    return (
      <AppLayout>
        <div className="py-24 text-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
          Loading product information...
        </div>
      </AppLayout>
    );
  }

  if (!data?.product) {
    return (
      <AppLayout>
        <div className="py-12 text-center text-slate-400">
          <p>Product not found.</p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => router.push("/inventory/products")}
          >
            Back to Products
          </Button>
        </div>
      </AppLayout>
    );
  }

  const { product, metrics } = data;
  const margin =
    product.sellingPrice > 0
      ? Math.round(
          ((product.sellingPrice - product.purchasePrice) /
            product.sellingPrice) *
            100
        )
      : 0;

  const grossProductProfit =
    metrics.totalSalesRevenue -
    metrics.totalSoldUnits * product.purchasePrice;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Back and Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/inventory/products")}
            className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Products
          </button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsEditModalOpen(true)}
          >
            <Edit2 className="w-3.5 h-3.5 mr-1.5" />
            Edit Product
          </Button>
        </div>

        {/* Product Hero Card */}
        <Card className="p-6 border-slate-800 bg-slate-900/80">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden text-slate-400">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package className="w-8 h-8" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className="text-xs">
                    {product.category?.name || "General"}
                  </Badge>
                  <span className="text-xs font-mono text-slate-400">
                    SKU: {product.sku}
                  </span>
                </div>
                <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                  {product.name}
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Brand: {product.brand || "Foxion"}
                </p>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t sm:border-t-0 sm:border-l border-slate-800 pt-4 sm:pt-0 sm:pl-6">
              <div>
                <span className="text-[11px] text-slate-400 block uppercase">
                  Purchase Price
                </span>
                <span className="text-base font-bold text-slate-200">
                  {formatINR(product.purchasePrice)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block uppercase">
                  Selling Price
                </span>
                <span className="text-base font-bold text-emerald-400">
                  {formatINR(product.sellingPrice)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block uppercase">
                  Current Stock
                </span>
                <span
                  className={`text-base font-bold ${
                    product.currentStock <= product.lowStockThreshold
                      ? "text-rose-400"
                      : "text-blue-400"
                  }`}
                >
                  {product.currentStock} Units
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block uppercase">
                  Margin
                </span>
                <span className="text-base font-bold text-emerald-400">
                  {margin}%
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 overflow-x-auto pb-1">
          {[
            { id: "OVERVIEW", label: "Overview & Specs", icon: Package },
            { id: "MOVEMENTS", label: `Stock Movements (${metrics.movements.length})`, icon: History },
            { id: "SALES", label: `Sales Orders (${metrics.orders.length})`, icon: TrendingUp },
            { id: "PURCHASES", label: `Purchases (${metrics.purchases.length})`, icon: Receipt },
            { id: "PROFIT", label: "Profit & Costing", icon: DollarSign },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Overview */}
        {activeTab === "OVERVIEW" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 p-6 border-slate-800 space-y-4">
              <h3 className="text-sm font-semibold text-white">
                Product Description & Details
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                {product.description || "No description provided."}
              </p>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                <div>
                  <span className="text-xs text-slate-400 block">GST Applicable</span>
                  <span className="text-sm font-medium text-white">{product.gstPercentage}%</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Low Stock Alert Threshold</span>
                  <span className="text-sm font-medium text-white">{product.lowStockThreshold} Units</span>
                </div>
              </div>
            </Card>

            <Card className="p-6 border-slate-800 space-y-4">
              <h3 className="text-sm font-semibold text-white">Lifetime Statistics</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Total Units Purchased:</span>
                  <span className="font-bold text-white">{metrics.totalPurchasedUnits}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Total Units Sold:</span>
                  <span className="font-bold text-white">{metrics.totalSoldUnits}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Total Sales Revenue:</span>
                  <span className="font-bold text-emerald-400">{formatINR(metrics.totalSalesRevenue)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Total Purchase Cost:</span>
                  <span className="font-bold text-rose-400">{formatINR(metrics.totalPurchaseCost)}</span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Tab 2: Stock Movements */}
        {activeTab === "MOVEMENTS" && (
          <Card className="overflow-hidden border-slate-800 bg-slate-900/70">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-3">Movement Type</th>
                    <th className="py-3 px-3 text-right">Quantity Change</th>
                    <th className="py-3 px-3 text-right">Previous Stock</th>
                    <th className="py-3 px-3 text-right">New Stock</th>
                    <th className="py-3 px-3">Reference / Order / Invoice</th>
                    <th className="py-3 px-4">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {metrics.movements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No stock movement records for this product yet.
                      </td>
                    </tr>
                  ) : (
                    metrics.movements.map((m: any) => {
                      const isPositive = m.quantity > 0;
                      return (
                        <tr key={m._id} className="hover:bg-slate-800/30">
                          <td className="py-2.5 px-4 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                            {formatIndianDate(m.date, { withTime: true })}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <Badge
                              variant={
                                m.type === "PURCHASE" || m.type === "OPENING"
                                  ? "success"
                                  : m.type === "SALE"
                                  ? "info"
                                  : m.type === "RETURN"
                                  ? "warning"
                                  : "danger"
                              }
                              className="text-[10px]"
                            >
                              {m.type}
                            </Badge>
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap ${
                              isPositive ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {isPositive ? `+${m.quantity}` : m.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-400 whitespace-nowrap">
                            {m.previousStock}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-white whitespace-nowrap">
                            {m.newStock}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                            {m.referenceId ? `#${m.referenceId}` : "—"}
                          </td>
                          <td className="py-2.5 px-4 text-slate-400 max-w-xs truncate">
                            {m.remarks || "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Tab 3: Sales Orders */}
        {activeTab === "SALES" && (
          <Card className="overflow-hidden border-slate-800 bg-slate-900/70">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-3">Order ID</th>
                    <th className="py-3 px-3">Platform</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3 text-right">Quantity</th>
                    <th className="py-3 px-3 text-right">Selling Price</th>
                    <th className="py-3 px-4 text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {metrics.orders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No sales recorded for this product yet.
                      </td>
                    </tr>
                  ) : (
                    metrics.orders.map((o: any) => {
                      const item = o.items.find(
                        (i: any) => i.productId.toString() === product._id
                      );
                      if (!item) return null;

                      return (
                        <tr key={o._id} className="hover:bg-slate-800/30">
                          <td className="py-2.5 px-4 whitespace-nowrap text-slate-300">
                            {formatIndianDate(o.date)}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-blue-400">
                            #{o.orderId}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <Badge variant="secondary" className="text-[10px]">
                              {o.platform}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-slate-200">
                            {o.customerName}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                            {item.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                            {formatINR(item.sellingPrice)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-400">
                            {formatINR(item.total)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Tab 4: Purchases */}
        {activeTab === "PURCHASES" && (
          <Card className="overflow-hidden border-slate-800 bg-slate-900/70">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-3">Invoice #</th>
                    <th className="py-3 px-3">Supplier</th>
                    <th className="py-3 px-3 text-right">Quantity</th>
                    <th className="py-3 px-3 text-right">Purchase Price</th>
                    <th className="py-3 px-4 text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {metrics.purchases.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No purchase invoices recorded for this product yet.
                      </td>
                    </tr>
                  ) : (
                    metrics.purchases.map((p: any) => {
                      const item = p.items.find(
                        (i: any) => i.productId.toString() === product._id
                      );
                      if (!item) return null;

                      return (
                        <tr key={p._id} className="hover:bg-slate-800/30">
                          <td className="py-2.5 px-4 whitespace-nowrap text-slate-300">
                            {formatIndianDate(p.date)}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-blue-400">
                            #{p.invoiceNumber}
                          </td>
                          <td className="py-2.5 px-3 text-slate-200">
                            {p.supplierName}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                            {item.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                            {formatINR(item.purchasePrice)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-400">
                            {formatINR(item.total)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Tab 5: Profit & Costing */}
        {activeTab === "PROFIT" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 border-slate-800 space-y-4">
              <h3 className="text-sm font-semibold text-white">
                Per-Unit Economics
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Selling Price:</span>
                  <span className="font-bold text-emerald-400">{formatINR(product.sellingPrice)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Cost of Goods Sold (Purchase Price):</span>
                  <span className="font-bold text-rose-400">-{formatINR(product.purchasePrice)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Gross Margin per Unit:</span>
                  <span className="font-bold text-blue-400">{formatINR(product.sellingPrice - product.purchasePrice)} ({margin}%)</span>
                </div>
              </div>
            </Card>

            <Card className="p-6 border-slate-800 space-y-4">
              <h3 className="text-sm font-semibold text-white">
                Aggregate Product Profit
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Total Sales Revenue:</span>
                  <span className="font-bold text-emerald-400">{formatINR(metrics.totalSalesRevenue)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Estimated COGS on Sold Units:</span>
                  <span className="font-bold text-rose-400">-{formatINR(metrics.totalSoldUnits * product.purchasePrice)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-400">Estimated Gross Product Profit:</span>
                  <span className="font-bold text-emerald-400">{formatINR(grossProductProfit)}</span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Edit Modal */}
        <ProductFormModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={fetchDetail}
          initialData={product}
        />
      </div>
    </AppLayout>
  );
}
