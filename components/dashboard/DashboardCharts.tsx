"use client";

import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/lib/ui";
import { formatINR } from "@/lib/utils";

const COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // purple
  "#06b6d4", // cyan
  "#f43f5e", // rose
];

interface DashboardChartsProps {
  charts: {
    monthlyTrend: Array<{
      month: string;
      revenue: number;
      expenses: number;
      profit: number;
    }>;
    salesByCategory: Array<{ name: string; value: number; units: number }>;
    salesByPlatform: Array<{
      platform: string;
      revenue: number;
      orders: number;
      profit: number;
    }>;
    expenseBreakdown: Array<{ category: string; amount: number }>;
    inventoryByCategory: Array<{
      category: string;
      value: number;
      stock: number;
    }>;
  };
}

export function DashboardCharts({ charts }: DashboardChartsProps) {
  const {
    monthlyTrend,
    salesByCategory,
    salesByPlatform,
    expenseBreakdown,
    inventoryByCategory,
  } = charts;

  return (
    <div className="space-y-6">
      {/* Chart Row 1: Revenue vs Expenses & Net Profit Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Revenue vs Expenses */}
        <Card className="p-5 border-slate-800 bg-slate-900/80">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-sm font-semibold text-white">
              1. Revenue vs Expenses Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-72">
            {monthlyTrend.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No monthly transactions recorded yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(val: any) => [formatINR(val), ""]}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                  <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Chart 2: Net Profit Trend */}
        <Card className="p-5 border-slate-800 bg-slate-900/80">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-sm font-semibold text-white">
              2. Net Profit Trend (Monthly)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-72">
            {monthlyTrend.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No profit history available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(val: any) => [formatINR(val), "Net Profit"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#profitGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chart Row 2: Sales by Category & Sales by Platform */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 3: Sales by Category */}
        <Card className="p-5 border-slate-800 bg-slate-900/80">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-sm font-semibold text-white">
              3. Sales by Product Category
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-72">
            {salesByCategory.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No category sales recorded
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={salesByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }: any) =>
                      `${name} (${(((percent || 0) * 100)).toFixed(0)}%)`
                    }
                  >
                    {salesByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(val: any) => [formatINR(val), "Sales"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Chart 4: Sales by Ecommerce Platform */}
        <Card className="p-5 border-slate-800 bg-slate-900/80">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-sm font-semibold text-white">
              4. Sales by Marketplace Platform
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-72">
            {salesByPlatform.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No platform sales records
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesByPlatform} layout="vertical" margin={{ top: 10, right: 20, left: 30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis
                    type="number"
                    stroke="#64748b"
                    fontSize={11}
                    tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  />
                  <YAxis type="category" dataKey="platform" stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(val: any) => [formatINR(val), "Revenue"]}
                  />
                  <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chart Row 3: Expense Breakdown & Inventory Value */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 5: Expense Breakdown */}
        <Card className="p-5 border-slate-800 bg-slate-900/80">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-sm font-semibold text-white">
              5. Operational Expense Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-72">
            {expenseBreakdown.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No expense debits recorded
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseBreakdown}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="amount"
                    nameKey="category"
                    label={({ name, percent }: any) =>
                      `${name} (${(((percent || 0) * 100)).toFixed(0)}%)`
                    }
                  >
                    {expenseBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(val: any) => [formatINR(val), "Expense"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Chart 6: Inventory Valuation by Category */}
        <Card className="p-5 border-slate-800 bg-slate-900/80">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-sm font-semibold text-white">
              6. Stock Valuation by Category
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-72">
            {inventoryByCategory.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No inventory categories found
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={inventoryByCategory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="category" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(val: any) => [formatINR(val), "Cost Valuation"]}
                  />
                  <Bar dataKey="value" name="Valuation (₹)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chart Row 4: Monthly Revenue & Monthly Profit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 7: Monthly Revenue */}
        <Card className="p-5 border-slate-800 bg-slate-900/80">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-sm font-semibold text-white">
              7. Monthly Revenue Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(val: any) => [formatINR(val), "Revenue"]}
                />
                <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Chart 8: Monthly Profit */}
        <Card className="p-5 border-slate-800 bg-slate-900/80">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-sm font-semibold text-white">
              8. Monthly Net Profit Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(val: any) => [formatINR(val), "Net Profit"]}
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ fill: "#3b82f6", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
