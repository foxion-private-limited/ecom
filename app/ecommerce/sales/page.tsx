"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, Badge, Button } from "@/lib/ui";
import { TrendingUp, RefreshCw, BarChart2 } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { toast } from "sonner";

export default function EcommerceSalesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchSalesData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/ecommerce");
      const json = await res.json();
      setData(json);
    } catch {
      toast.error("Failed to load ecommerce sales analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesData();
  }, []);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Ecommerce Sales & Channel Performance
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Cross-platform breakdown: Amazon, Meesho, Flipkart, and Direct sales margins
            </p>
          </div>

          <Button variant="secondary" onClick={fetchSalesData}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Refresh
          </Button>
        </div>

        <Card className="overflow-hidden border-slate-800 bg-slate-900/70">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Platform Channel</th>
                  <th className="py-3 px-3 text-right">Orders</th>
                  <th className="py-3 px-3 text-right">Delivered</th>
                  <th className="py-3 px-3 text-right">Returns</th>
                  <th className="py-3 px-3 text-right">Return Rate</th>
                  <th className="py-3 px-3 text-right">Revenue (₹)</th>
                  <th className="py-3 px-3 text-right">COGS (₹)</th>
                  <th className="py-3 px-3 text-right">Fees & Shipping (₹)</th>
                  <th className="py-3 px-3 text-right">Gross Profit (₹)</th>
                  <th className="py-3 px-4 text-right">Margin (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
                      Loading sales performance...
                    </td>
                  </tr>
                ) : !data?.platforms || data.platforms.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      No sales recorded for this period.
                    </td>
                  </tr>
                ) : (
                  data.platforms.map((p: any) => (
                    <tr key={p.platform} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-semibold text-white">
                        <Badge
                          variant={
                            p.platform === "Amazon"
                              ? "warning"
                              : p.platform === "Meesho"
                              ? "danger"
                              : p.platform === "Flipkart"
                              ? "info"
                              : "secondary"
                          }
                        >
                          {p.platform}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-white">
                        {p.orders}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-400">
                        {p.deliveredOrders}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-rose-400">
                        {p.returnedOrders}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-300">
                        {p.returnRate.toFixed(1)}%
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                        {formatINR(p.revenue)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-400">
                        {formatINR(p.cogs)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-amber-400">
                        {formatINR(p.marketplaceFees + p.shippingFees)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-blue-400">
                        {formatINR(p.grossProfit)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                        {p.margin.toFixed(1)}%
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
