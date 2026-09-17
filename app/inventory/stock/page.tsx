"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button, Card, Badge, Modal, Input, Select } from "@/lib/ui";
import {
  Layers,
  RefreshCw,
  AlertTriangle,
  Package,
  ArrowDownUp,
  History,
  TrendingUp,
} from "lucide-react";
import { formatINR } from "@/lib/utils";
import { toast } from "sonner";

export default function StockValuationPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustmentQuantity, setAdjustmentQuantity] = useState<string>("");
  const [adjustmentType, setAdjustmentType] = useState<"DAMAGE" | "ADJUSTMENT">("ADJUSTMENT");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchStock = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/products?limit=200");
      const data = await res.json();
      if (data.products) setProducts(data.products);
    } catch {
      toast.error("Failed to load stock data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();
  }, []);

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const qty = parseInt(adjustmentQuantity, 10);
    if (isNaN(qty) || qty === 0) {
      toast.error("Please enter a valid non-zero adjustment quantity");
      return;
    }

    setSaving(true);
    try {
      const newStock = Math.max(0, selectedProduct.currentStock + qty);
      const res = await fetch(`/api/products/${selectedProduct._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentStock: newStock,
        }),
      });

      if (!res.ok) throw new Error("Failed to adjust stock");

      toast.success(`Stock adjusted for ${selectedProduct.name} to ${newStock} units`);
      setIsAdjustModalOpen(false);
      setAdjustmentQuantity("");
      setRemarks("");
      fetchStock();
    } catch (err: any) {
      toast.error(err.message || "Failed to adjust stock");
    } finally {
      setSaving(false);
    }
  };

  // Aggregates
  let totalUnits = 0;
  let totalValuation = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  for (const p of products) {
    totalUnits += p.currentStock || 0;
    totalValuation += (p.currentStock || 0) * (p.purchasePrice || 0);
    if (p.currentStock <= 0) outOfStockCount++;
    else if (p.currentStock <= (p.lowStockThreshold || 10)) lowStockCount++;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Inventory Valuation & Stock
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Current asset value, unit balances, and stock adjustment auditing
            </p>
          </div>

          <Link href="/inventory/movements">
            <Button variant="secondary" size="md">
              <History className="w-4 h-4 mr-1.5 text-blue-400" />
              Stock Movement History
            </Button>
          </Link>
        </div>

        {/* 4 Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-slate-900/60 border-slate-800">
            <span className="text-xs text-slate-400">Total Products</span>
            <p className="text-2xl font-bold text-white mt-1">{products.length}</p>
          </Card>

          <Card className="p-4 bg-slate-900/60 border-slate-800">
            <span className="text-xs text-slate-400">Total Stock in Hand</span>
            <p className="text-2xl font-bold text-blue-400 mt-1">{totalUnits} Units</p>
          </Card>

          <Card className="p-4 bg-slate-900/60 border-slate-800">
            <span className="text-xs text-slate-400">Total Inventory Valuation (Cost)</span>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{formatINR(totalValuation)}</p>
          </Card>

          <Card className="p-4 bg-amber-950/30 border-amber-800/50">
            <span className="text-xs text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Stock Alerts
            </span>
            <p className="text-2xl font-bold text-amber-400 mt-1">
              {lowStockCount + outOfStockCount} Items
            </p>
          </Card>
        </div>

        {/* Table */}
        <Card className="overflow-hidden border-slate-800 bg-slate-900/70">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-3">SKU</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3 text-right">Purchase Cost (₹)</th>
                  <th className="py-3 px-3 text-right">Current Stock</th>
                  <th className="py-3 px-3 text-right">Total Valuation (₹)</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
                      Loading inventory valuation...
                    </td>
                  </tr>
                ) : (
                  products.map((prod) => {
                    const valuation = (prod.currentStock || 0) * (prod.purchasePrice || 0);
                    return (
                      <tr key={prod._id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-semibold text-white">
                          <Link
                            href={`/inventory/products/${prod._id}`}
                            className="hover:text-blue-400 transition-colors"
                          >
                            {prod.name}
                          </Link>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-300">
                          {prod.sku}
                        </td>
                        <td className="py-3 px-3 text-slate-400">
                          {prod.category?.name || "General"}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-300">
                          {formatINR(prod.purchasePrice)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-white">
                          {prod.currentStock} Units
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                          {formatINR(valuation)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {prod.currentStock <= 0 ? (
                            <Badge variant="danger" className="text-[10px]">Out</Badge>
                          ) : prod.currentStock <= prod.lowStockThreshold ? (
                            <Badge variant="warning" className="text-[10px]">Low</Badge>
                          ) : (
                            <Badge variant="success" className="text-[10px]">Good</Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedProduct(prod);
                              setIsAdjustModalOpen(true);
                            }}
                          >
                            <ArrowDownUp className="w-3 h-3 mr-1" />
                            Adjust
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Adjust Stock Modal */}
        <Modal
          isOpen={isAdjustModalOpen}
          onClose={() => setIsAdjustModalOpen(false)}
          title={`Adjust Stock: ${selectedProduct?.name}`}
          description={`Current Stock: ${selectedProduct?.currentStock} units. Enter positive number to add or negative to deduct.`}
        >
          <form onSubmit={handleAdjustStock} className="space-y-4">
            <Select
              label="Reason for Adjustment"
              value={adjustmentType}
              onChange={(e) => setAdjustmentType(e.target.value as any)}
              options={[
                { label: "Stock Adjustment (Audit correction)", value: "ADJUSTMENT" },
                { label: "Damaged / Defective Stock", value: "DAMAGE" },
              ]}
            />

            <Input
              label="Quantity Delta (+ / -) *"
              type="number"
              required
              placeholder="e.g. +10 or -2"
              value={adjustmentQuantity}
              onChange={(e) => setAdjustmentQuantity(e.target.value)}
              helperText={`Resulting stock will be: ${
                selectedProduct
                  ? Math.max(
                      0,
                      selectedProduct.currentStock +
                        (parseInt(adjustmentQuantity, 10) || 0)
                    )
                  : 0
              } units`}
            />

            <Input
              label="Remarks / Audit Note"
              placeholder="e.g. Broken in transit or Physical count difference"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <Button type="button" variant="secondary" onClick={() => setIsAdjustModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={saving}>
                Apply Adjustment
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
}
