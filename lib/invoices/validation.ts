import { z } from "zod";

// ─── Shared enums ───────────────────────────────────────────────────────────

export const INVOICE_MODES = ["TEST", "PRODUCTION"] as const;
export const INVOICE_STATUSES = ["DRAFT", "ISSUED", "CANCELLED"] as const;
export const TAX_TREATMENTS = ["INTRA_STATE", "INTER_STATE", "EXEMPT", "NIL"] as const;
export const PLATFORMS = [
  "Meesho",
  "Amazon",
  "Flipkart",
  "Direct Webstore",
  "Instagram",
  "Other",
] as const;
export const UNITS = ["NOS", "PCS", "KG", "G", "L", "ML", "MTR", "SQM", "SET", "BOX", "PAIR", "ROLL", "SHEET"] as const;
export const CUSTOMER_TYPES = ["B2C_UNREGISTERED", "B2B_REGISTERED", "OTHER"] as const;

export interface IndianState {
  name: string;
  code: string;
}

export const INDIAN_STATES: IndianState[] = [
  { name: "Jammu and Kashmir", code: "01" },
  { name: "Himachal Pradesh", code: "02" },
  { name: "Punjab", code: "03" },
  { name: "Chandigarh", code: "04" },
  { name: "Uttarakhand", code: "05" },
  { name: "Haryana", code: "06" },
  { name: "Delhi", code: "07" },
  { name: "Rajasthan", code: "08" },
  { name: "Uttar Pradesh", code: "09" },
  { name: "Bihar", code: "10" },
  { name: "Sikkim", code: "11" },
  { name: "Arunachal Pradesh", code: "12" },
  { name: "Nagaland", code: "13" },
  { name: "Manipur", code: "14" },
  { name: "Mizoram", code: "15" },
  { name: "Tripura", code: "16" },
  { name: "Meghalaya", code: "17" },
  { name: "Assam", code: "18" },
  { name: "West Bengal", code: "19" },
  { name: "Jharkhand", code: "20" },
  { name: "Odisha", code: "21" },
  { name: "Chhattisgarh", code: "22" },
  { name: "Madhya Pradesh", code: "23" },
  { name: "Gujarat", code: "24" },
  { name: "Daman and Diu", code: "25" },
  { name: "Dadra and Nagar Haveli", code: "26" },
  { name: "Maharashtra", code: "27" },
  { name: "Andhra Pradesh", code: "28" },
  { name: "Karnataka", code: "29" },
  { name: "Goa", code: "30" },
  { name: "Lakshadweep", code: "31" },
  { name: "Kerala", code: "32" },
  { name: "Tamil Nadu", code: "33" },
  { name: "Puducherry", code: "34" },
  { name: "Andaman and Nicobar Islands", code: "35" },
  { name: "Telangana", code: "36" },
  { name: "Ladakh", code: "38" },
  { name: "Other Territory", code: "97" },
];

// ─── Zod sub-schemas ────────────────────────────────────────────────────────

const addressSchema = z.object({
  line1: z.string().min(1, "Address line 1 required").max(200).trim(),
  line2: z.string().max(200).trim().optional().default(""),
  city: z.string().min(1, "City required").max(100).trim(),
  state: z.string().min(1, "State required").max(100).trim(),
  stateCode: z
    .string()
    .min(2, "State code required")
    .max(2)
    .regex(/^\d{2}$/, "State code must be 2 digits")
    .trim(),
  pincode: z.string().max(10).trim().optional().default(""),
  country: z.string().max(100).trim().optional().default("India"),
});

const gstinSchema = z
  .string()
  .max(15)
  .trim()
  .optional()
  .transform((val) => (val ? val.toUpperCase() : undefined))
  .refine(
    (val) => {
      if (!val) return true; // optional
      // GSTIN format: 2-digit state + 10-char PAN + 1 entity + Z + 1 checksum
      return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(val);
    },
    { message: "Invalid GSTIN format" }
  );

export const invoiceLineItemSchema = z.object({
  description: z.string().min(1, "Description required").max(500).trim(),
  hsnSac: z.string().max(20).trim().optional().default(""),
  quantity: z.coerce.number().positive("Quantity must be > 0"),
  unit: z.string().max(20).trim().default("NOS"),
  unitPrice: z.coerce.number().min(0, "Unit price cannot be negative"),
  discountType: z.enum(["NONE", "PERCENT", "FIXED"]).default("NONE"),
  discountValue: z.coerce.number().min(0).default(0),
  gstRate: z.coerce.number().min(0).max(100).default(18),
});

export type InvoiceLineItemInput = z.infer<typeof invoiceLineItemSchema>;

export const invoiceSettingsSchema = z.object({
  sellerLegalName: z.string().min(1, "Seller legal name required").max(200).trim(),
  sellerTradeName: z.string().max(200).trim().optional().default(""),
  sellerAddress: addressSchema,
  sellerGstin: gstinSchema.optional(),
  sellerPhone: z.string().max(20).trim().optional().default(""),
  sellerEmail: z.string().email("Invalid email").optional().or(z.literal("")).default(""),
  logoUrl: z.string().max(500).trim().optional().default(""),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{3,6}$/, "Invalid hex color")
    .optional()
    .default("#1e3a5f"),
  invoicePrefix: z.string().max(20).trim().default("INV"),
  defaultPaymentTerms: z.string().max(500).trim().optional().default(""),
  defaultDeclarations: z.string().max(1000).trim().optional().default(""),
  gstRegistrationEffectiveDate: z.coerce.date().optional().nullable(),
  registrationVerified: z.boolean().default(false),
  registrationVerifiedAt: z.coerce.date().optional().nullable(),
  registrationVerifiedBy: z.string().max(200).trim().optional().default(""),
  registrationReference: z.string().max(500).trim().optional().default(""),
  testMode: z.boolean().default(true),
});

export type InvoiceSettingsInput = z.infer<typeof invoiceSettingsSchema>;

export const createInvoiceDraftSchema = z.object({
  mode: z.enum(INVOICE_MODES).default("TEST"),
  invoiceDate: z.coerce.date(),
  // Buyer details
  buyerName: z.string().min(1, "Buyer name required").max(300).trim(),
  buyerType: z.enum(CUSTOMER_TYPES).default("B2C_UNREGISTERED"),
  buyerGstin: gstinSchema.optional(),
  buyerBillingAddress: addressSchema,
  buyerShippingAddress: addressSchema.optional(),
  buyerPhone: z.string().max(20).trim().optional().default(""),
  buyerEmail: z.string().email().optional().or(z.literal("")).default(""),
  placeOfSupply: z
    .string()
    .min(1, "Place of supply required")
    .max(100)
    .trim(),
  placeOfSupplyCode: z
    .string()
    .min(2)
    .max(2)
    .regex(/^\d{2}$/, "Must be 2-digit state code")
    .trim(),
  taxTreatment: z.enum(TAX_TREATMENTS),
  // Marketplace
  platform: z.enum(PLATFORMS).optional(),
  marketplaceOrderId: z.string().max(100).trim().optional().default(""),
  marketplaceRef: z.string().max(100).trim().optional().default(""),
  // Shipment
  courierCompany: z.string().max(100).trim().optional().default(""),
  awbNumber: z.string().max(100).trim().optional().default(""),
  trackingNumber: z.string().max(100).trim().optional().default(""),
  // Line items
  items: z
    .array(invoiceLineItemSchema)
    .min(1, "At least one line item required"),
  // Settings
  applyRoundOff: z.boolean().default(true),
  reverseChargeApplicable: z.boolean().default(false),
  // Additional
  notes: z.string().max(1000).trim().optional().default(""),
  paymentTerms: z.string().max(500).trim().optional().default(""),
  additionalDeclarations: z.string().max(1000).trim().optional().default(""),
  // Export preferences (informational, not trusted for server logic)
  exportPng: z.boolean().default(false),
});

export type CreateInvoiceDraftInput = z.infer<typeof createInvoiceDraftSchema>;

export const updateInvoiceDraftSchema = createInvoiceDraftSchema.partial().extend({
  // items still required if provided
});

export type UpdateInvoiceDraftInput = z.infer<typeof updateInvoiceDraftSchema>;

export const issueInvoiceSchema = z.object({
  idempotencyKey: z.string().min(1).max(100).optional(),
});

export type IssueInvoiceInput = z.infer<typeof issueInvoiceSchema>;

export const cancelInvoiceSchema = z.object({
  reason: z.string().min(1, "Cancellation reason required").max(500).trim(),
});

export type CancelInvoiceInput = z.infer<typeof cancelInvoiceSchema>;

export const listInvoicesSchema = z.object({
  mode: z.enum([...INVOICE_MODES, "ALL"]).optional().default("ALL"),
  status: z.enum([...INVOICE_STATUSES, "ALL"]).optional().default("ALL"),
  financialYear: z.string().max(10).optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().positive().max(200).default(50),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type ListInvoicesInput = z.infer<typeof listInvoicesSchema>;
