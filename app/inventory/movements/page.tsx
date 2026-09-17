"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, Badge, Button } from "@/lib/ui";
import { History, RefreshCw, ArrowLeft, Package } from "lucide-react";
import { formatIndianDate } from "@/lib/utils";
import { toast } from "sonner";

export default function StockMovementsPage() {
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMovements = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/movements?limit=150");
      const data = await res.json();
      if (Array.isArray(data)) setMovements(data);
    } catch {
      toast.error("Failed to load stock movements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, []);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Stock Movements Audit Trail
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Every opening, purchase inward, ecommerce sale, return, and damage recorded with historical balances
            </p>
          </div>

          <Button variant="secondary" onClick={fetchMovements}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Refresh
          </Button>
        </div>

        <Card className="overflow-hidden border-slate-800 bg-slate-900/70">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-3">Product Name</th>
                  <th className="py-3 px-3">SKU</th>
                  <th className="py-3 px-3">Movement Type</th>
                  <th className="py-3 px-3 text-right">Delta</th>
                  <th className="py-3 px-3 text-right">Previous</th>
                  <th className="py-3 px-3 text-right">New Stock</th>
                  <th className="py-3 px-3">Reference</th>
                  <th className="py-3 px-4">Remarks / By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
                      Loading movements...
                    </td>
                  </tr>
                ) : movements.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No stock movements recorded yet.
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => {
                    const isPositive = m.quantity > 0;
                    return (
                      <tr key={m._id} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                          {formatIndianDate(m.date, { withTime: true })}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-white">
                          <Link
                            href={`/inventory/products/${m.productId?._id}`}
                            className="hover:text-blue-400 transition-colors"
                          >
                            {m.productId?.name || "Product"}
                          </Link>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                          {m.productId?.sku || "—"}
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
                        <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                          {m.previousStock}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                          {m.newStock}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">
                          {m.referenceId ? `#${m.referenceId}` : "—"}
                        </td>
                        <td className="py-2.5 px-4 text-slate-400 text-xs">
                          {m.remarks || "—"}
                          {m.createdBy && (
                            <span className="block text-[10px] text-slate-400">
                              By: {m.createdBy}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
