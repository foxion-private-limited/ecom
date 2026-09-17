"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, Badge, Button } from "@/lib/ui";
import { RotateCcw, RefreshCw, ShoppingCart } from "lucide-react";
import { formatINR, formatIndianDate } from "@/lib/utils";
import { toast } from "sonner";

export default function EcommerceReturnsPage() {
  const [returnedOrders, setReturnedOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/orders?orderStatus=RETURNED");
      const data = await res.json();
      if (data.orders) setReturnedOrders(data.orders);
    } catch {
      toast.error("Failed to load returned orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, []);

  const totalRefunds = returnedOrders.reduce((acc, curr) => acc + curr.netAmount, 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Returns & Customer Refunds
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Restocked inventory and accounting adjustment entries for returned marketplace orders
            </p>
          </div>

          <Button variant="secondary" onClick={fetchReturns}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="p-4 bg-slate-900/60 border-slate-800">
            <span className="text-xs text-slate-400">Total Returned Orders</span>
            <p className="text-2xl font-bold text-white mt-1">{returnedOrders.length}</p>
          </Card>

          <Card className="p-4 bg-rose-950/30 border-rose-800/50">
            <span className="text-xs text-rose-400">Total Refunds Processed</span>
            <p className="text-2xl font-bold text-rose-400 mt-1">{formatINR(totalRefunds)}</p>
          </Card>
        </div>

        <Card className="overflow-hidden border-slate-800 bg-slate-900/70">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-3">Platform</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Returned Items (Restocked)</th>
                  <th className="py-3 px-3 text-right">Refund Amount</th>
                  <th className="py-3 px-3">Returned At</th>
                  <th className="py-3 px-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
                      Loading returns...
                    </td>
                  </tr>
                ) : returnedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No returned orders recorded.
                    </td>
                  </tr>
                ) : (
                  returnedOrders.map((o) => (
                    <tr key={o._id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-mono font-bold text-blue-400">
                        #{o.orderId}
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="secondary">{o.platform}</Badge>
                      </td>
                      <td className="py-3 px-3 text-white">
                        {o.customerName}
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        {o.items?.map((i: any) => `${i.productName} ×${i.quantity}`).join(", ")}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-rose-400">
                        {formatINR(o.netAmount)}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400">
                        {formatIndianDate(o.returnedAt || o.updatedAt)}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-xs">
                        {o.remarks || "—"}
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
