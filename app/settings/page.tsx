"use client";

import React, { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input, Badge } from "@/lib/ui";
import { Settings, Shield, Database, RefreshCw, Sparkles, Building, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const [seeding, setSeeding] = useState(false);

  const handleResetData = async () => {
    if (!confirm("This will reset all transactional data (products, orders, purchases, ledger entries) and ensure a clean production database state. Continue?")) return;

    setSeeding(true);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success("Database cleanly initialized with zero dummy records!");
      } else {
        throw new Error(data.error || "Reset failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to reset database");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            System & Company Settings
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Foxion business suite configuration, company parameters, and database utilities
          </p>
        </div>

        {/* Company Profile Card */}
        <Card className="p-6 border-slate-800 bg-slate-900/80 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <Building className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-base font-bold text-white">Company Profile</h2>
              <p className="text-xs text-slate-400">Primary legal entity settings</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block mb-1">Company Name</span>
              <span className="text-sm font-semibold text-white">Foxion</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-1">Base Currency</span>
              <span className="text-sm font-semibold text-emerald-400">INR (₹ - Indian Rupee)</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-1">Standard GST Bracket</span>
              <span className="text-sm font-semibold text-white">18% (Applicable on Electronics & Kitchen Goods)</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-1">Costing Method</span>
              <span className="text-sm font-semibold text-white">Standard Purchase Cost (Extensible to FIFO / W.Avg)</span>
            </div>
          </div>
        </Card>

        {/* Database Utilities */}
        <Card className="p-6 border-slate-800 bg-slate-900/80 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <Database className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold text-white">Database Maintenance</h2>
              <p className="text-xs text-slate-400">System initialization and clean state maintenance</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div className="space-y-1">
              <span className="text-sm font-semibold text-white flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 text-blue-400" />
                Initialize Clean Database
              </span>
              <p className="text-xs text-slate-400">
                Purges any temporary test records and ensures standard business categories, platforms, and admin credentials are ready for production.
              </p>
            </div>

            <Button
              variant="outline"
              onClick={handleResetData}
              loading={seeding}
              disabled={seeding}
            >
              Reset to Clean State
            </Button>
          </div>
        </Card>

        {/* Architecture & Security Info */}
        <Card className="p-6 border-slate-800 bg-slate-900/80 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <Shield className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-base font-bold text-white">Architecture & Security</h2>
              <p className="text-xs text-slate-400">Production environment verification</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Single Next.js App Router Architecture</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>MongoDB with Mongoose Connection Pooling</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>HTTP-Only Encrypted JWT Cookie Sessions</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Zod Validation on all Transactions & Excel Rows</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Deterministic Running Balance Accounting Engine</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Full StockMovement Audit Trail on all Products</span>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
