"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, Button } from "@/lib/ui";
import { FileText, RefreshCw, Printer } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { toast } from "sonner";

export default function ExpenseReportPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports/pnl?preset=THIS_MONTH")
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(() => toast.error("Failed to load expense report"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Operational Expense Report
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Main Accounts expense debits categorized by administrative and operational head
            </p>
          </div>

          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer className="w-3.5 h-3.5 mr-1" />
            Print
          </Button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
            Loading expenses...
          </div>
        ) : (
          <Card className="overflow-hidden border-slate-800 bg-slate-900/70">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Category Head
              </span>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Total Debit Amount
              </span>
            </div>
            <div className="divide-y divide-slate-800/60">
              {data?.operatingExpenses?.map((oe: any) => (
                <div key={oe.category} className="p-4 flex justify-between items-center text-xs">
                  <span className="font-semibold text-white">{oe.category}</span>
                  <span className="font-mono font-bold text-rose-400">{formatINR(oe.amount)}</span>
                </div>
              ))}
              <div className="p-4 bg-slate-950/60 flex justify-between items-center font-bold text-sm">
                <span className="text-slate-200">Total Operational Overhead:</span>
                <span className="font-mono text-rose-400">{formatINR(data?.totalOperatingExpenses || 0)}</span>
              </div>
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
