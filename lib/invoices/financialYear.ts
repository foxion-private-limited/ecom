/**
 * Indian Financial Year utilities.
 * FY runs April 1 → March 31 (e.g. FY 2026-27 = 1 Apr 2026 – 31 Mar 2027).
 */

export interface FinancialYear {
  /** Human-readable label, e.g. "2026-27" */
  label: string;
  /** Start date at midnight UTC-equivalent (2026-04-01T00:00:00.000Z) */
  start: Date;
  /** End date inclusive, last millisecond of 31 Mar (2027-03-31T23:59:59.999Z) */
  end: Date;
  /** Short code used in invoice numbers, e.g. "26-27" */
  code: string;
}

/**
 * Returns the Indian Financial Year that contains the given date.
 * If no date provided, uses today (in IST).
 */
export function getFinancialYear(date?: Date | string): FinancialYear {
  const d = date ? new Date(date) : new Date();

  // Determine IST month/year to correctly classify the FY boundary
  const istFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  });
  const parts = istFormatter.formatToParts(d);
  const month = parseInt(parts.find((p) => p.type === "month")?.value ?? "1", 10);
  const year = parseInt(parts.find((p) => p.type === "year")?.value ?? "2026", 10);

  // April (month 4) or later → FY starts in this calendar year
  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd = fyStart + 1;

  return {
    label: `${fyStart}-${String(fyEnd).slice(-2)}`,
    code: `${String(fyStart).slice(-2)}-${String(fyEnd).slice(-2)}`,
    start: new Date(Date.UTC(fyStart, 3, 1)), // April 1 at 00:00 UTC
    end: new Date(Date.UTC(fyEnd, 2, 31, 23, 59, 59, 999)), // March 31 end-of-day UTC
  };
}

/**
 * Returns the financial year label for a given date, e.g. "2026-27".
 */
export function getFinancialYearLabel(date?: Date | string): string {
  return getFinancialYear(date).label;
}

/**
 * Returns the financial year code for use in invoice serial numbers, e.g. "26-27".
 */
export function getFinancialYearCode(date?: Date | string): string {
  return getFinancialYear(date).code;
}

/**
 * Validates that a given date falls within the provided financial year label.
 */
export function isDateInFinancialYear(date: Date | string, fyLabel: string): boolean {
  const fy = getFinancialYear(date);
  return fy.label === fyLabel;
}

/**
 * Validates an invoice date is not before a given effective date.
 */
export function isInvoiceDateValid(invoiceDate: Date | string, effectiveDate: Date | string): boolean {
  const inv = new Date(invoiceDate);
  const eff = new Date(effectiveDate);
  if (isNaN(inv.getTime()) || isNaN(eff.getTime())) return false;
  return inv >= eff;
}
