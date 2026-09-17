"use client";

import React from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, Button } from "@/lib/ui";
import {
  BarChart3,
  TrendingUp,
  Receipt,
  FileText,
  DollarSign,
  Layers,
  ArrowDownUp,
  Landmark,
  ShieldCheck,
  Store,
} from "lucide-react";

export default function ReportsHubPage() {
  const reports = [
    {
      title: "Profit & Loss Statement",
      href: "/reports/pnl",
      icon: DollarSign,
      description: "Real P&L: Gross Revenue, Product COGS, Marketplace Fees, Operating Expenses, and Net Margin",
      color: "text-emerald-400 bg-emerald-950/40 border-emerald-800/40",
    },
    {
      title: "GST Tax Report",
      href: "/reports/gst",
      icon: ShieldCheck,
      description: "Output GST collected on sales vs Input Tax Credit (ITC) paid on purchases and expenses",
      color: "text-blue-400 bg-blue-950/40 border-blue-800/40",
    },
    {
      title: "Cash Flow Statement",
      href: "/reports/cashflow",
      icon: Landmark,
      description: "Comprehensive cash and bank inflows, outflows, and net liquidity movement",
      color: "text-cyan-400 bg-cyan-950/40 border-cyan-800/40",
    },
    {
      title: "Sales Report",
      href: "/reports/sales",
      icon: TrendingUp,
      description: "Channel sales, revenue totals, discount deductions, and customer order history",
      color: "text-amber-400 bg-amber-950/40 border-amber-800/40",
    },
    {
      title: "Purchase Report",
      href: "/reports/purchases",
      icon: Receipt,
      description: "Vendor procurement, product inward costs, GST invoices, and payment statuses",
      color: "text-purple-400 bg-purple-950/40 border-purple-800/40",
    },
    {
      title: "Expense Report",
      href: "/reports/expenses",
      icon: FileText,
      description: "Detailed categorical breakdown of operational overheads, rent, salaries, utilities, and marketing",
      color: "text-rose-400 bg-rose-950/40 border-rose-800/40",
    },
    {
      title: "Inventory Report",
      href: "/reports/inventory",
      icon: Layers,
      description: "Stock on hand, inventory valuation at cost, turnover metrics, and reorder levels",
      color: "text-indigo-400 bg-indigo-950/40 border-indigo-800/40",
    },
    {
      title: "Ecommerce Analytics",
      href: "/ecommerce/sales",
      icon: Store,
      description: "Comparative marketplace economics across Amazon, Meesho, Flipkart, and Direct sales",
      color: "text-orange-400 bg-orange-950/40 border-orange-800/40",
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Business Financial & Operational Reports
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time business intelligence, compliance reporting, and audited accounting statements for Foxion
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((rep) => (
            <Link key={rep.href} href={rep.href}>
              <Card className="p-5 border-slate-800 bg-slate-900/80 hover:bg-slate-900 transition-all hover:border-slate-700 h-full flex flex-col justify-between group cursor-pointer">
                <div className="space-y-3">
                  <div className={`p-2.5 rounded-lg border inline-flex items-center justify-center ${rep.color}`}>
                    <rep.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                      {rep.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {rep.description}
                    </p>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between text-xs text-blue-400 font-medium">
                  <span>View Report</span>
                  <span>→</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
