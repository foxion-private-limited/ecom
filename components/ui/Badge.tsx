import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "success" | "warning" | "danger" | "outline" | "info";
}

export function Badge({
  className,
  variant = "default",
  children,
  ...props
}: BadgeProps) {
  const variants = {
    default: "bg-blue-950/80 text-blue-300 border-blue-800/60",
    secondary: "bg-slate-800 text-slate-300 border-slate-700",
    success: "bg-emerald-950/80 text-emerald-300 border-emerald-800/60",
    warning: "bg-amber-950/80 text-amber-300 border-amber-800/60",
    danger: "bg-rose-950/80 text-rose-300 border-rose-800/60",
    info: "bg-cyan-950/80 text-cyan-300 border-cyan-800/60",
    outline: "border-slate-700 text-slate-300",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
