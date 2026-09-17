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
 * Format date in standard Indian business format: DD/MM/YYYY or DD MMM YYYY
 */
export function formatIndianDate(
  dateInput: Date | string | number | null | undefined,
  options?: { withTime?: boolean; shortMonth?: boolean }
): string {
  if (!dateInput) return "—";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "—";

  const day = String(d.getDate()).padStart(2, "0");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const year = d.getFullYear();

  let formatted = "";
  if (options?.shortMonth) {
    formatted = `${day} ${months[d.getMonth()]} ${year}`;
  } else {
    const month = String(d.getMonth() + 1).padStart(2, "0");
    formatted = `${day}/${month}/${year}`;
  }

  if (options?.withTime) {
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    formatted += ` ${hours}:${minutes}`;
  }

  return formatted;
}
