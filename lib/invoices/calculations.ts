/**
 * Decimal-safe GST calculations using integer paise arithmetic.
 * All amounts stored as paise (1 paise = 0.01 rupees) internally during calculation
 * to avoid floating-point rounding errors, then converted back to rupees.
 *
 * Rounding policy: Half-up rounding at the paisa level for each component.
 */

export type TaxTreatment = "INTRA_STATE" | "INTER_STATE" | "EXEMPT" | "NIL";
export type GSTRate = 0 | 0.1 | 0.25 | 3 | 5 | 12 | 18 | 28;

export interface InvoiceLineItemInput {
  description: string;
  hsnSac: string;
  quantity: number;
  unit: string;
  unitPrice: number; // in rupees, tax-exclusive
  discountType: "NONE" | "PERCENT" | "FIXED";
  discountValue: number;
  gstRate: number; // 0–28
}

export interface CalculatedLineItem {
  description: string;
  hsnSac: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountType: "NONE" | "PERCENT" | "FIXED";
  discountValue: number;
  discountAmount: number;
  taxableValue: number;
  gstRate: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstAmount: number;
  lineTotal: number;
}

export interface InvoiceTotals {
  taxableSubtotal: number;
  totalDiscount: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  totalGst: number;
  grossTotal: number;
  roundOff: number;
  amountPayable: number;
  lineItems: CalculatedLineItem[];
}

/** Convert rupees to paise (integer, half-up rounding) */
function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Convert paise to rupees (2 decimal places) */
function fromPaise(paise: number): number {
  return parseFloat((paise / 100).toFixed(2));
}

/**
 * Half-up round to 2 decimal places in rupees.
 * Works by operating in paise to avoid float issues.
 */
function rupeeRound(value: number): number {
  return fromPaise(Math.round(value * 100));
}

/**
 * Calculate the discount amount for a line item.
 */
function calcDiscount(
  subtotal: number, // unitPrice * quantity in rupees
  discountType: "NONE" | "PERCENT" | "FIXED",
  discountValue: number
): number {
  if (discountType === "NONE" || discountValue <= 0) return 0;
  if (discountType === "PERCENT") {
    return rupeeRound((subtotal * discountValue) / 100);
  }
  // FIXED — cannot exceed subtotal
  return rupeeRound(Math.min(discountValue, subtotal));
}

/**
 * Calculate all GST amounts for a single line item.
 * Treatment determines whether CGST+SGST or IGST applies.
 */
export function calculateLineItem(
  item: InvoiceLineItemInput,
  treatment: TaxTreatment
): CalculatedLineItem {
  const grossValue = rupeeRound(item.unitPrice * item.quantity);
  const discountAmount = calcDiscount(grossValue, item.discountType, item.discountValue);
  const taxableValue = rupeeRound(grossValue - discountAmount);

  const rate = Math.max(0, item.gstRate);

  let cgstRate = 0;
  let sgstRate = 0;
  let igstRate = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (treatment === "INTRA_STATE" && rate > 0) {
    cgstRate = rate / 2;
    sgstRate = rate / 2;
    // Calculate using paise for precision
    const totalGstPaise = toPaise((taxableValue * rate) / 100);
    // Split evenly; if odd paise, CGST gets the extra
    const cgstPaise = Math.ceil(totalGstPaise / 2);
    const sgstPaise = Math.floor(totalGstPaise / 2);
    cgstAmount = fromPaise(cgstPaise);
    sgstAmount = fromPaise(sgstPaise);
  } else if (treatment === "INTER_STATE" && rate > 0) {
    igstRate = rate;
    igstAmount = rupeeRound((taxableValue * rate) / 100);
  }
  // EXEMPT / NIL → all zero

  const gstAmount = rupeeRound(cgstAmount + sgstAmount + igstAmount);
  const lineTotal = rupeeRound(taxableValue + gstAmount);

  return {
    description: item.description,
    hsnSac: item.hsnSac,
    quantity: item.quantity,
    unit: item.unit,
    unitPrice: item.unitPrice,
    discountType: item.discountType,
    discountValue: item.discountValue,
    discountAmount,
    taxableValue,
    gstRate: rate,
    cgstRate,
    sgstRate,
    igstRate,
    cgstAmount,
    sgstAmount,
    igstAmount,
    gstAmount,
    lineTotal,
  };
}

/**
 * Calculate totals for all invoice line items.
 * Round-off: nearest rupee, half-up.
 */
export function calculateInvoiceTotals(
  items: InvoiceLineItemInput[],
  treatment: TaxTreatment,
  applyRoundOff: boolean = true
): InvoiceTotals {
  const calculatedItems = items.map((item) => calculateLineItem(item, treatment));

  let taxableSubtotalPaise = 0;
  let totalDiscountPaise = 0;
  let cgstTotalPaise = 0;
  let sgstTotalPaise = 0;
  let igstTotalPaise = 0;

  for (const item of calculatedItems) {
    taxableSubtotalPaise += toPaise(item.taxableValue);
    totalDiscountPaise += toPaise(item.discountAmount);
    cgstTotalPaise += toPaise(item.cgstAmount);
    sgstTotalPaise += toPaise(item.sgstAmount);
    igstTotalPaise += toPaise(item.igstAmount);
  }

  const taxableSubtotal = fromPaise(taxableSubtotalPaise);
  const totalDiscount = fromPaise(totalDiscountPaise);
  const cgstTotal = fromPaise(cgstTotalPaise);
  const sgstTotal = fromPaise(sgstTotalPaise);
  const igstTotal = fromPaise(igstTotalPaise);
  const totalGst = rupeeRound(cgstTotal + sgstTotal + igstTotal);
  const grossTotal = rupeeRound(taxableSubtotal + totalGst);

  let roundOff = 0;
  let amountPayable = grossTotal;

  if (applyRoundOff) {
    const rounded = Math.round(grossTotal);
    roundOff = rupeeRound(rounded - grossTotal);
    amountPayable = rupeeRound(grossTotal + roundOff);
  }

  return {
    taxableSubtotal,
    totalDiscount,
    cgstTotal,
    sgstTotal,
    igstTotal,
    totalGst,
    grossTotal,
    roundOff,
    amountPayable,
    lineItems: calculatedItems,
  };
}
