"use client";

import React, { useState, useRef } from "react";
import { formatIndianDate, parseIndianDate, toInputDateString } from "@/lib/utils";
import { Calendar as CalendarIcon } from "lucide-react";

interface IndianDateInputProps {
  label?: string;
  value?: Date | string | null;
  onChange: (date: Date | null, formattedStr: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  error?: string;
}

export function IndianDateInput({
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder = "DD/MM/YYYY",
  className = "",
  error,
}: IndianDateInputProps) {
  const hiddenDateInputRef = useRef<HTMLInputElement>(null);

  const parsedPropDate = typeof value === "string" ? parseIndianDate(value) : value;
  const formattedFromProp =
    parsedPropDate && !isNaN(parsedPropDate.getTime())
      ? formatIndianDate(parsedPropDate)
      : "";

  const [localInput, setLocalInput] = useState<string | null>(null);
  const textVal = localInput !== null ? localInput : formattedFromProp;

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalInput(raw);

    const parsed = parseIndianDate(raw);
    if (parsed) {
      onChange(parsed, formatIndianDate(parsed));
    } else if (raw.trim() === "") {
      onChange(null, "");
    }
  };

  const handleBlur = () => {
    setLocalInput(null);
  };

  const handleNativePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value; // YYYY-MM-DD
    if (!val) return;
    const parsed = parseIndianDate(val);
    if (parsed) {
      const formatted = formatIndianDate(parsed);
      setLocalInput(null);
      onChange(parsed, formatted);
    }
  };

  const openPicker = () => {
    const el = hiddenDateInputRef.current;
    if (el && !disabled) {
      if ("showPicker" in el && typeof el.showPicker === "function") {
        try {
          el.showPicker();
        } catch {
          el.focus();
        }
      } else {
        el.focus();
      }
    }
  };

  const nativeDateVal = value ? toInputDateString(value) : "";

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-xs font-medium text-slate-300">
          {label} {required && <span className="text-rose-400">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        <input
          type="text"
          value={textVal}
          onChange={handleTextChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`w-full rounded-lg border bg-slate-800/80 px-3 py-1.5 pr-10 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
            error ? "border-rose-500" : "border-slate-700"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        />

        {/* Hidden native input for calendar popover trigger */}
        <input
          ref={hiddenDateInputRef}
          type="date"
          value={nativeDateVal}
          onChange={handleNativePickerChange}
          tabIndex={-1}
          aria-hidden="true"
          className="absolute inset-0 opacity-0 pointer-events-none w-0 h-0"
        />

        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={openPicker}
          title="Pick calendar date (DD/MM/YYYY)"
          className="absolute right-2 p-1 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
        >
          <CalendarIcon className="w-4 h-4 text-slate-400 hover:text-blue-400 transition-colors" />
        </button>
      </div>

      {error && <p className="text-[11px] text-rose-400">{error}</p>}
    </div>
  );
}
