import { connectDB } from "@/lib/db/connection";
import { InvoiceSettings, IInvoiceSettings } from "@/lib/models/InvoiceSettings";
import { invoiceSettingsSchema, InvoiceSettingsInput } from "@/lib/invoices/validation";

const DEFAULT_SETTINGS = {
  sellerLegalName: "Foxion Private Limited",
  sellerTradeName: "Foxion",
  sellerAddress: {
    line1: "Business Hub, Ring Road",
    line2: "Near Trade Centre",
    city: "Surat",
    state: "Gujarat",
    stateCode: "24",
    pincode: "395002",
    country: "India",
  },
  sellerGstin: "",
  sellerPhone: "+91 98765 43210",
  sellerEmail: "billing@foxion.in",
  logoUrl: "",
  brandColor: "#1e3a5f",
  invoicePrefix: "INV",
  gstRegistrationEffectiveDate: null,
  registrationVerified: false,
  registrationVerifiedAt: null,
  registrationVerifiedBy: "",
  registrationReference: "",
  defaultPaymentTerms: "Payment due within 15 days of invoice date.",
  defaultDeclarations:
    "We declare that this invoice shows the actual price of the goods or services described and that all particulars are true and correct.",
  testMode: true,
};

/**
 * Retrieve the current invoice settings singleton.
 * If none exists, creates and returns the default configuration.
 */
export async function getInvoiceSettings(): Promise<IInvoiceSettings> {
  await connectDB();

  let settings = await InvoiceSettings.findOne();
  if (!settings) {
    settings = await InvoiceSettings.create(DEFAULT_SETTINGS);
  }
  return settings;
}

/**
 * Update invoice settings.
 * Sensitive fields (registrationVerified) cannot be altered through ordinary updates
 * and must be confirmed through verifyGstRegistration.
 */
export async function updateInvoiceSettings(
  input: Partial<InvoiceSettingsInput>,
  updatedBy: string
): Promise<IInvoiceSettings> {
  await connectDB();

  // Validate the incoming input partially
  const validated = invoiceSettingsSchema.partial().parse(input);

  const current = await getInvoiceSettings();

  // Prevent direct bypass of registrationVerified via general settings update
  // unless explicitly preserving current state
  delete (validated as Record<string, unknown>).registrationVerified;
  delete (validated as Record<string, unknown>).registrationVerifiedAt;
  delete (validated as Record<string, unknown>).registrationVerifiedBy;

  Object.assign(current, validated, { updatedBy });
  await current.save();

  return current;
}

/**
 * Explicit registration verification step.
 * Records evidence, actor, and timestamp.
 */
export async function verifyGstRegistration(
  reference: string,
  verifiedBy: string,
  effectiveDate?: Date | null
): Promise<IInvoiceSettings> {
  await connectDB();

  const settings = await getInvoiceSettings();

  if (!settings.sellerGstin) {
    throw new Error("Cannot verify registration: Seller GSTIN is missing. Please save GSTIN first.");
  }

  settings.registrationVerified = true;
  settings.registrationVerifiedAt = new Date();
  settings.registrationVerifiedBy = verifiedBy;
  settings.registrationReference = reference || "Direct verification via Admin Console";

  if (effectiveDate) {
    settings.gstRegistrationEffectiveDate = effectiveDate;
  }

  await settings.save();
  return settings;
}

/**
 * Revoke or unverify GST registration.
 */
export async function revokeGstVerification(
  revokedBy: string
): Promise<IInvoiceSettings> {
  await connectDB();

  const settings = await getInvoiceSettings();
  settings.registrationVerified = false;
  settings.registrationVerifiedAt = null;
  settings.registrationVerifiedBy = "";
  settings.registrationReference = "";
  settings.updatedBy = revokedBy;
  await settings.save();
  return settings;
}

export interface ProductionReadinessCheck {
  isReady: boolean;
  blockers: string[];
}

/**
 * Check whether seller settings allow issuing genuine production GST invoices.
 */
export function checkProductionReadiness(settings: IInvoiceSettings): ProductionReadinessCheck {
  const blockers: string[] = [];

  if (!settings.registrationVerified) {
    blockers.push("GST registration has not been verified. An explicit verification step is required.");
  }
  if (!settings.sellerGstin || settings.sellerGstin.trim().length === 0) {
    blockers.push("Seller GSTIN is missing.");
  }
  if (!settings.gstRegistrationEffectiveDate) {
    blockers.push("GST registration effective date is not configured.");
  }
  if (!settings.sellerLegalName || settings.sellerLegalName.trim().length === 0) {
    blockers.push("Seller legal name is required.");
  }
  if (
    !settings.sellerAddress ||
    !settings.sellerAddress.line1 ||
    !settings.sellerAddress.city ||
    !settings.sellerAddress.state ||
    !settings.sellerAddress.stateCode
  ) {
    blockers.push("Complete registered seller address (including 2-digit state code) is required.");
  }

  return {
    isReady: blockers.length === 0,
    blockers,
  };
}
