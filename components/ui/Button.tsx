import React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost" | "success";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none text-sm";

    const variants = {
      primary:
        "bg-blue-600 hover:bg-blue-500 text-white shadow-sm focus:ring-blue-500 active:scale-[0.98]",
      secondary:
        "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 focus:ring-slate-500 active:scale-[0.98]",
      outline:
        "border border-slate-700 hover:bg-slate-800/80 text-slate-200 hover:text-white focus:ring-slate-500",
      danger:
        "bg-rose-600 hover:bg-rose-500 text-white shadow-sm focus:ring-rose-500 active:scale-[0.98]",
      ghost:
        "text-slate-300 hover:bg-slate-800 hover:text-white focus:ring-slate-500",
      success:
        "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm focus:ring-emerald-500 active:scale-[0.98]",
    };

    const sizes = {
      sm: "h-8 px-2.5 text-xs gap-1.5",
      md: "h-9 px-3.5 py-2 text-sm gap-2",
      lg: "h-11 px-5 text-base gap-2.5",
      icon: "h-9 w-9 p-0 justify-center",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
