import React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", label, error, helperText, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-slate-300"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          type={type}
          ref={ref}
          className={cn(
            "flex h-9 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
            error && "border-rose-500 focus:border-rose-500 focus:ring-rose-500",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-rose-400">{error}</p>}
        {helperText && !error && (
          <p className="text-xs text-slate-400">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
