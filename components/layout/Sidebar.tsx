"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Package,
  ShoppingCart,
  Receipt,
  BarChart3,
  FileText,
  Settings,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Tag,
  ArrowDownUp,
  History,
  Store,
  Layers,
  FileSpreadsheet,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  title: string;
  href?: string;
  icon: React.ElementType;
  children?: { title: string; href: string; icon?: React.ElementType }[];
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Accounts",
    icon: BookOpen,
    children: [
      { title: "Main Accounts", href: "/accounts/main", icon: BookOpen },
      { title: "Ecommerce Accounts", href: "/accounts/ecommerce", icon: Store },
      { title: "Import Excel", href: "/accounts/import", icon: FileSpreadsheet },
    ],
  },
  {
    title: "Inventory",
    icon: Package,
    children: [
      { title: "Products", href: "/inventory/products", icon: Package },
      { title: "Categories", href: "/inventory/categories", icon: Tag },
      { title: "Stock Valuation", href: "/inventory/stock", icon: Layers },
      { title: "Stock Movements", href: "/inventory/movements", icon: History },
    ],
  },
  {
    title: "Ecommerce",
    icon: ShoppingCart,
    children: [
      { title: "Orders", href: "/ecommerce/orders", icon: ShoppingCart },
      { title: "Sales & Performance", href: "/ecommerce/sales", icon: TrendingUp },
      { title: "Returns & Refunds", href: "/ecommerce/returns", icon: ArrowDownUp },
      { title: "Platforms", href: "/ecommerce/platforms", icon: Store },
    ],
  },
  {
    title: "Purchases",
    href: "/purchases",
    icon: Receipt,
  },
  {
    title: "Reports",
    icon: BarChart3,
    children: [
      { title: "Profit & Loss", href: "/reports/pnl" },
      { title: "Sales Report", href: "/reports/sales" },
      { title: "Purchase Report", href: "/reports/purchases" },
      { title: "Expense Report", href: "/reports/expenses" },
      { title: "Inventory Report", href: "/reports/inventory" },
      { title: "Cash Flow", href: "/reports/cashflow" },
      { title: "GST Report", href: "/reports/gst" },
    ],
  },
  {
    title: "Bills / Documents",
    href: "/bills",
    icon: FileText,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function Sidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Accounts: true,
    Inventory: true,
    Ecommerce: false,
    Reports: false,
  });

  const toggleSection = (title: string) => {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden backdrop-blur-xs"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-screen w-64 border-r border-slate-800/80 bg-slate-950/95 flex flex-col transition-transform duration-200 md:translate-x-0 backdrop-blur-md",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Foxion Brand Header */}
        <div className="flex h-16 items-center px-6 border-b border-slate-800/80 gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20 text-base tracking-wider">
            FX
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight text-white">
              Foxion
            </span>
            <span className="block text-[10px] uppercase font-semibold tracking-wider text-slate-400">
              Business Suite
            </span>
          </div>
        </div>

        {/* Navigation links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 scrollbar-thin">
          {navItems.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const isChildActive =
              hasChildren &&
              item.children?.some((child) => pathname.startsWith(child.href));
            const isDirectActive = item.href && pathname === item.href;
            const isSectionOpen = openSections[item.title];

            if (hasChildren) {
              return (
                <div key={item.title} className="space-y-1">
                  <button
                    onClick={() => toggleSection(item.title)}
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors group cursor-pointer",
                      isChildActive
                        ? "text-blue-400 bg-blue-950/30"
                        : "text-slate-300 hover:text-white hover:bg-slate-900"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon
                        className={cn(
                          "w-4 h-4 transition-colors",
                          isChildActive
                            ? "text-blue-400"
                            : "text-slate-400 group-hover:text-slate-200"
                        )}
                      />
                      <span>{item.title}</span>
                    </div>
                    {isSectionOpen ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {isSectionOpen && (
                    <div className="pl-6 space-y-1">
                      {item.children?.map((child) => {
                        const isActive = pathname === child.href;
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={onClose}
                            className={cn(
                              "flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                              isActive
                                ? "text-blue-400 bg-blue-900/40 font-semibold"
                                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                            )}
                          >
                            {child.icon && (
                              <child.icon className="w-3.5 h-3.5 opacity-70" />
                            )}
                            <span>{child.title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href!}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors group",
                  isDirectActive
                    ? "text-white bg-blue-600 font-semibold shadow-sm shadow-blue-500/20"
                    : "text-slate-300 hover:text-white hover:bg-slate-900"
                )}
              >
                <item.icon
                  className={cn(
                    "w-4 h-4",
                    isDirectActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                  )}
                />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/80">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Currency: INR (₹)</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
