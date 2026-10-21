import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number into Indian Rupee currency format (e.g., ₹1,24,500.00)
 */
export function formatINR(
  amount: number | null | undefined,
  options?: {
    showDecimals?: boolean;
    compact?: boolean;
  }
): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "₹0.00";
  }

  const { showDecimals = true, compact = false } = options || {};

  if (compact) {
    const abs = Math.abs(amount);
    const sign = amount < 0 ? "-" : "";
    if (abs >= 10000000) {
      return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
    }
    if (abs >= 100000) {
      return `${sign}₹${(abs / 100000).toFixed(2)} L`;
    }
    if (abs >= 1000) {
      return `${sign}₹${(abs / 1000).toFixed(1)} K`;
    }
  }

  const parts = Number(amount).toFixed(showDecimals ? 2 : 0).split(".");
  let integerPart = parts[0];
  const decimalPart = parts[1];

  const isNegative = integerPart.startsWith("-");
  if (isNegative) {
    integerPart = integerPart.substring(1);
  }

  // Indian numbering system: last 3 digits, then groups of 2 digits
  let lastThree = integerPart.substring(integerPart.length - 3);
  const otherNumbers = integerPart.substring(0, integerPart.length - 3);
  if (otherNumbers !== "") {
    lastThree = "," + lastThree;
  }
  const formattedInteger =
    otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;

  const result = `${isNegative ? "-" : ""}₹${formattedInteger}${
    showDecimals && decimalPart ? `.${decimalPart}` : ""
  }`;

  return result;
}

/**
 * Format date in standard Indian business format: DD/MM/YYYY
 * Strictly anchored to Asia/Kolkata timezone to avoid date shifts across client platforms
 */
export function formatIndianDate(
  dateInput: Date | string | number | null | undefined,
  options?: { withTime?: boolean; shortMonth?: boolean }
): string {
  if (!dateInput) return "—";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "—";

  if (options?.shortMonth) {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: options?.withTime ? "2-digit" : undefined,
      minute: options?.withTime ? "2-digit" : undefined,
      hour12: false,
    });
    return formatter.format(d);
  }

  const dmyFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: options?.withTime ? "2-digit" : undefined,
    minute: options?.withTime ? "2-digit" : undefined,
    hour12: false,
  });

  return dmyFormatter.format(d);
}

/**
 * Direct alias for formatIndianDate to ensure DD/MM/YYYY across application
 */
export function formatDate(dateInput: Date | string | number | null | undefined): string {
  return formatIndianDate(dateInput);
}

/**
 * Reliably parse DD/MM/YYYY, DD-MM-YYYY, Excel serial, or ISO string into a normalized Date
 * Stored at 12:00:00 UTC (17:30 IST) to prevent timezone drift across device platforms
 */
export function parseIndianDate(val: string | number | Date | null | undefined): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return new Date(Date.UTC(val.getUTCFullYear(), val.getUTCMonth(), val.getUTCDate(), 12, 0, 0));
  }

  if (typeof val === "number") {
    // Excel date serial number (days since Dec 30, 1899)
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const targetDate = new Date(excelEpoch.getTime() + Math.round(val * 86400 * 1000));
    if (isNaN(targetDate.getTime())) return null;
    return new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 12, 0, 0));
  }

  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return null;

    // Explicit DD/MM/YYYY or DD-MM-YYYY match
    const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      let year = parseInt(dmyMatch[3], 10);
      if (year < 100) year += 2000;

      if (day >= 1 && day <= 31 && month >= 0 && month <= 11 && year >= 1900 && year <= 2100) {
        return new Date(Date.UTC(year, month, day, 12, 0, 0));
      }
    }

    // YYYY-MM-DD match
    const ymdMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10) - 1;
      const day = parseInt(ymdMatch[3], 10);
      if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
        return new Date(Date.UTC(year, month, day, 12, 0, 0));
      }
    }

    const fallback = new Date(trimmed);
    if (!isNaN(fallback.getTime())) {
      return new Date(Date.UTC(fallback.getUTCFullYear(), fallback.getUTCMonth(), fallback.getUTCDate(), 12, 0, 0));
    }
  }

  return null;
}

/**
 * Returns ISO date string in YYYY-MM-DD format for date input controls
 */
export function toInputDateString(dateInput: Date | string | number | null | undefined): string {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(d);

  const day = parts.find((p) => p.type === "day")?.value || "01";
  const month = parts.find((p) => p.type === "month")?.value || "01";
  const year = parts.find((p) => p.type === "year")?.value || "2026";

  return `${year}-${month}-${day}`;
}

export interface ISTCalendarDate {
  dateStr: string; // Normalized YYYY-MM-DD
  displayDate: string; // Indian DD/MM/YYYY
  start: Date; // 00:00:00.000 IST (in UTC)
  end: Date; // 23:59:59.999 IST (in UTC)
  year: number;
  month: number;
  day: number;
}

/**
 * Normalizes any date input (string, Date, timestamp, Excel serial) into its exact IST calendar date.
 * Avoids any timezone off-by-one errors and does NOT rely on raw new Date("YYYY-MM-DD").
 * Start is 00:00:00.000 IST (previous day 18:30:00.000 UTC).
 * End is 23:59:59.999 IST (current day 18:29:59.999 UTC).
 */
export function getISTCalendarDate(
  val: Date | string | number | null | undefined
): ISTCalendarDate | null {
  if (val === null || val === undefined || val === "") return null;

  let year: number;
  let month: number;
  let day: number;

  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return null;

    // Matches DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dmyMatch) {
      day = parseInt(dmyMatch[1], 10);
      month = parseInt(dmyMatch[2], 10);
      year = parseInt(dmyMatch[3], 10);
    } else {
      // Matches YYYY-MM-DD (e.g. from <input type="date">) without timestamp
      const ymdMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:$|[^\d])/);
      if (ymdMatch && !trimmed.includes("T")) {
        year = parseInt(ymdMatch[1], 10);
        month = parseInt(ymdMatch[2], 10);
        day = parseInt(ymdMatch[3], 10);
      } else {
        // Fallback for ISO strings with T or general date strings
        const d = new Date(trimmed);
        if (isNaN(d.getTime())) return null;
        const parts = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Kolkata",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }).formatToParts(d);
        day = parseInt(parts.find((p) => p.type === "day")?.value || "1", 10);
        month = parseInt(parts.find((p) => p.type === "month")?.value || "1", 10);
        year = parseInt(parts.find((p) => p.type === "year")?.value || "2026", 10);
      }
    }
  } else {
    // Date object or number (timestamp / Excel serial)
    let d: Date;
    if (typeof val === "number" && val > 0 && val < 100000) {
      // Excel serial date number
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      d = new Date(excelEpoch.getTime() + Math.round(val * 86400 * 1000));
    } else {
      d = val instanceof Date ? val : new Date(val);
    }

    if (isNaN(d.getTime())) return null;

    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).formatToParts(d);
    day = parseInt(parts.find((p) => p.type === "day")?.value || "1", 10);
    month = parseInt(parts.find((p) => p.type === "month")?.value || "1", 10);
    year = parseInt(parts.find((p) => p.type === "year")?.value || "2026", 10);
  }

  if (
    isNaN(day) ||
    isNaN(month) ||
    isNaN(year) ||
    day < 1 ||
    day > 31 ||
    month < 1 ||
    month > 12 ||
    year < 1900 ||
    year > 2100
  ) {
    return null;
  }

  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - istOffsetMs);
  const end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - istOffsetMs);
  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const displayDate = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;

  return {
    dateStr,
    displayDate,
    start,
    end,
    year,
    month,
    day,
  };
}

