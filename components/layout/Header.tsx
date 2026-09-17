"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Menu, LogOut, User, Plus, Search, Shield } from "lucide-react";
import { Button } from "@/lib/ui";
import { toast } from "sonner";

export function Header({
  onMenuToggle,
  onQuickAction,
}: {
  onMenuToggle: () => void;
  onQuickAction?: (action: string) => void;
}) {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          setUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("Logged out successfully");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Failed to logout");
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-800/80 bg-slate-900/80 px-4 md:px-8 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white md:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
          <span className="font-semibold text-slate-200">Foxion Management</span>
          <span>/</span>
          <span className="text-blue-400">Production</span>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {/* User profile dropdown & logout */}
        {user && (
          <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-semibold text-white">{user.name}</span>
              <span className="text-[10px] text-slate-400 capitalize">{user.role}</span>
            </div>
            <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 font-semibold text-xs">
              {user.name.slice(0, 2).toUpperCase()}
            </div>
            <button
              onClick={handleLogout}
              title="Log out"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
