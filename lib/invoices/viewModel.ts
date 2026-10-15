/**
 * Invoice View Model — transforms raw invoice data into a display-ready structure.
 * This is the single source of truth for what the HTML template renders.
 * All formatting happens here, not in the template.
 */

import type { ITaxInvoice } from "@/lib/models/TaxInvoice";
import type { IInvoiceSettings } from "@/lib/models/InvoiceSettings";
import type { InvoiceTotals } from "@/lib/invoices/calculations";
import { amountToWords } from "@/lib/invoices/numberToWords";
import { getFinancialYearLabel } from "@/lib/invoices/financialYear";

function formatINR(amount: number): string {
  if (isNaN(amount)) return "₹0.00";
  const fixed = amount.toFixed(2);
  const [integer, decimal] = fixed.split(".");
  let lastThree = integer.slice(-3);
  const rest = integer.slice(0, -3);
  if (rest) lastThree = "," + lastThree;
  const formatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
  return `₹${formatted}.${decimal}`;
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export interface InvoiceAddress {
  line1: string;
  line2: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  country: string;
  formatted: string; // multi-line HTML-safe string
}

export interface InvoiceViewModel {
  // Meta
  isTestMode: boolean;
  status: string;
  // Header
  invoiceTitle: string; // "TAX INVOICE"
  serialNumber: string;
  financialYear: string;
  invoiceDate: string;
  // Seller
  sellerLegalName: string;
  sellerTradeName: string;
  sellerAddress: InvoiceAddress;
  sellerGstin: string;
  sellerPhone: string;
  sellerEmail: string;
  sellerLogoUrl: string;
  brandColor: string;
  // Buyer
  buyerName: string;
  buyerType: string;
  buyerGstin: string;
  buyerBillingAddress: InvoiceAddress;
  buyerShippingAddress: InvoiceAddress | null;
  buyerPhone: string;
  buyerEmail: string;
  placeOfSupply: string;
  placeOfSupplyCode: string;
  // Marketplace
  platform: string;
  marketplaceOrderId: string;
  marketplaceRef: string;
  // Shipment
  courierCompany: string;
  awbNumber: string;
  trackingNumber: string;
  // Tax
  taxTreatment: string;
  reverseChargeApplicable: boolean;
  // Line items (display-formatted)
  lineItems: {
    no: number;
    description: string;
    hsnSac: string;
    quantity: string;
    unit: string;
    unitPrice: string;
    discountAmount: string;
    taxableValue: string;
    gstRate: string;
    cgstRate: string;
    cgstAmount: string;
    sgstRate: string;
    sgstAmount: string;
    igstRate: string;
    igstAmount: string;
    lineTotal: string;
  }[];
  // Show/hide columns
  showCgstSgst: boolean;
  showIgst: boolean;
  showDiscount: boolean;
  showHsn: boolean;
  // Totals
  taxableSubtotal: string;
  totalDiscount: string;
  cgstTotal: string;
  sgstTotal: string;
  igstTotal: string;
  totalGst: string;
  grossTotal: string;
  roundOff: string;
  amountPayable: string;
  amountInWords: string;
  // GST rate breakdown (for summary table)
  gstRateBreakdown: {
    rate: string;
    taxableValue: string;
    cgstAmount: string;
    sgstAmount: string;
    igstAmount: string;
    total: string;
  }[];
  // Footer
  notes: string;
  paymentTerms: string;
  additionalDeclarations: string;
  defaultDeclarations: string;
}

function formatAddress(addr: {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  stateCode: string;
  pincode?: string;
  country?: string;
}): InvoiceAddress {
  const parts = [
    addr.line1,
    addr.line2,
    addr.city,
    `${addr.state} - ${addr.stateCode}`,
    addr.pincode ? `PIN: ${addr.pincode}` : "",
    addr.country || "India",
  ].filter(Boolean);

  return {
    line1: addr.line1,
    line2: addr.line2 ?? "",
    city: addr.city,
    state: addr.state,
    stateCode: addr.stateCode,
    pincode: addr.pincode ?? "",
    country: addr.country ?? "India",
    formatted: parts.join(", "),
  };
}

/**
 * Build a complete view model for the invoice template.
 * Call this when rendering HTML preview or generating PDF/PNG.
 */
export function buildInvoiceViewModel(
  invoice: Partial<ITaxInvoice> & {
    buyer: ITaxInvoice["buyer"];
    lineItems: ITaxInvoice["lineItems"];
    taxTreatment: ITaxInvoice["taxTreatment"];
  },
  settings: IInvoiceSettings,
  totals: InvoiceTotals
): InvoiceViewModel {
  const seller = invoice.sellerSnapshot;
  const buyer = invoice.buyer;
  const treatment = invoice.taxTreatment;

  const showCgstSgst = treatment === "INTRA_STATE";
  const showIgst = treatment === "INTER_STATE";
  const showDiscount = totals.lineItems.some((li) => li.discountAmount > 0);
  const showHsn = totals.lineItems.some((li) => li.hsnSac);

  // Build GST rate breakdown table
  const rateMap = new Map<
    number,
    { taxable: number; cgst: number; sgst: number; igst: number }
  >();
  for (const li of totals.lineItems) {
    const existing = rateMap.get(li.gstRate) ?? { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    rateMap.set(li.gstRate, {
      taxable: existing.taxable + li.taxableValue,
      cgst: existing.cgst + li.cgstAmount,
      sgst: existing.sgst + li.sgstAmount,
      igst: existing.igst + li.igstAmount,
    });
  }

  const gstRateBreakdown = Array.from(rateMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([rate, amounts]) => ({
      rate: `${rate}%`,
      taxableValue: formatINR(amounts.taxable),
      cgstAmount: formatINR(amounts.cgst),
      sgstAmount: formatINR(amounts.sgst),
      igstAmount: formatINR(amounts.igst),
      total: formatINR(amounts.cgst + amounts.sgst + amounts.igst),
    }));

  const roundOffValue = totals.roundOff;
  const roundOffStr =
    roundOffValue > 0
      ? `+${formatINR(roundOffValue)}`
      : roundOffValue < 0
      ? `-${formatINR(Math.abs(roundOffValue))}`
      : "₹0.00";

  const financialYear =
    invoice.financialYear ??
    getFinancialYearLabel(invoice.invoiceDate ?? new Date());

  return {
    isTestMode: invoice.mode === "TEST",
    status: invoice.status ?? "DRAFT",
    invoiceTitle: "TAX INVOICE",
    serialNumber: invoice.serialNumber ?? "DRAFT",
    financialYear,
    invoiceDate: formatDate(invoice.invoiceDate ?? new Date()),
    // Seller
    sellerLegalName: seller?.legalName ?? settings.sellerLegalName,
    sellerTradeName: seller?.tradeName ?? settings.sellerTradeName ?? "",
    sellerAddress: formatAddress(
      (seller?.address ?? settings.sellerAddress) as Parameters<typeof formatAddress>[0]
    ),
    sellerGstin: seller?.gstin ?? settings.sellerGstin ?? "",
    sellerPhone: seller?.phone ?? settings.sellerPhone ?? "",
    sellerEmail: seller?.email ?? settings.sellerEmail ?? "",
    sellerLogoUrl: seller?.logoUrl ?? settings.logoUrl ?? "",
    brandColor: seller?.brandColor ?? settings.brandColor ?? "#1e3a5f",
    // Buyer
    buyerName: buyer.name,
    buyerType: buyer.type,
    buyerGstin: buyer.gstin ?? "",
    buyerBillingAddress: formatAddress(buyer.billingAddress as Parameters<typeof formatAddress>[0]),
    buyerShippingAddress: buyer.shippingAddress
      ? formatAddress(buyer.shippingAddress as Parameters<typeof formatAddress>[0])
      : null,
    buyerPhone: buyer.phone ?? "",
    buyerEmail: buyer.email ?? "",
    placeOfSupply: buyer.placeOfSupply,
    placeOfSupplyCode: buyer.placeOfSupplyCode,
    // Marketplace
    platform: invoice.platform ?? "",
    marketplaceOrderId: invoice.marketplaceOrderId ?? "",
    marketplaceRef: invoice.marketplaceRef ?? "",
    // Shipment
    courierCompany: invoice.courierCompany ?? "",
    awbNumber: invoice.awbNumber ?? "",
    trackingNumber: invoice.trackingNumber ?? "",
    // Tax
    taxTreatment: treatment,
    reverseChargeApplicable: invoice.reverseChargeApplicable ?? false,
    // Line items
    lineItems: totals.lineItems.map((li, i) => ({
      no: i + 1,
      description: li.description,
      hsnSac: li.hsnSac,
      quantity: String(li.quantity),
      unit: li.unit,
      unitPrice: formatINR(li.unitPrice),
      discountAmount: li.discountAmount > 0 ? formatINR(li.discountAmount) : "—",
      taxableValue: formatINR(li.taxableValue),
      gstRate: `${li.gstRate}%`,
      cgstRate: `${li.cgstRate}%`,
      cgstAmount: formatINR(li.cgstAmount),
      sgstRate: `${li.sgstRate}%`,
      sgstAmount: formatINR(li.sgstAmount),
      igstRate: `${li.igstRate}%`,
      igstAmount: formatINR(li.igstAmount),
      lineTotal: formatINR(li.lineTotal),
    })),
    showCgstSgst,
    showIgst,
    showDiscount,
    showHsn,
    // Totals
    taxableSubtotal: formatINR(totals.taxableSubtotal),
    totalDiscount: formatINR(totals.totalDiscount),
    cgstTotal: formatINR(totals.cgstTotal),
    sgstTotal: formatINR(totals.sgstTotal),
    igstTotal: formatINR(totals.igstTotal),
    totalGst: formatINR(totals.totalGst),
    grossTotal: formatINR(totals.grossTotal),
    roundOff: roundOffStr,
    amountPayable: formatINR(totals.amountPayable),
    amountInWords: amountToWords(totals.amountPayable),
    gstRateBreakdown,
    // Footer
    notes: invoice.notes ?? "",
    paymentTerms: invoice.paymentTerms ?? settings.defaultPaymentTerms ?? "",
    additionalDeclarations: invoice.additionalDeclarations ?? "",
    defaultDeclarations:
      settings.defaultDeclarations ??
      "We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.",
  };
}
