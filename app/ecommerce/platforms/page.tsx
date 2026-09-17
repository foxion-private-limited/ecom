"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, Badge, Button, Modal, Input } from "@/lib/ui";
import { Store, Plus, RefreshCw, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function PlatformsPage() {
  const [platforms, setPlatforms] = useState<any[]>([
    { name: "Amazon", code: "AMZ", commission: "15%", color: "#f59e0b", status: "Active" },
    { name: "Meesho", code: "MSH", commission: "5%", color: "#ec4899", status: "Active" },
    { name: "Flipkart", code: "FLP", commission: "14%", color: "#3b82f6", status: "Active" },
    { name: "Direct (Website)", code: "DIR", commission: "2%", color: "#10b981", status: "Active" },
    { name: "Instagram", code: "INSTA", commission: "0%", color: "#8b5cf6", status: "Active" },
  ]);

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Ecommerce Platforms & Marketplaces
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Configure marketplace channels, default commission deductibles, and order tracking
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {platforms.map((p) => (
            <Card key={p.code} className="p-5 border-slate-800 bg-slate-900/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <h3 className="font-bold text-white text-base">{p.name}</h3>
                </div>
                <Badge variant="success" className="text-[10px]">
                  {p.status}
                </Badge>
              </div>

              <div className="text-xs text-slate-400 space-y-1 pt-2 border-t border-slate-800">
                <div className="flex justify-between">
                  <span>Channel Code:</span>
                  <span className="font-mono text-white">{p.code}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Marketplace Fee:</span>
                  <span className="font-mono text-amber-400">{p.commission}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
