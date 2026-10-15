import mongoose, { Schema, Document, Model } from "mongoose";

export interface IInvoiceSettings extends Document {
  // Seller details
  sellerLegalName: string;
  sellerTradeName?: string;
  sellerAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    stateCode: string;
    pincode?: string;
    country?: string;
  };
  sellerGstin?: string;
  sellerPhone?: string;
  sellerEmail?: string;
  logoUrl?: string;
  brandColor: string;
  // Invoice series
  invoicePrefix: string;
  // GST Registration
  gstRegistrationEffectiveDate?: Date | null;
  registrationVerified: boolean;
  registrationVerifiedAt?: Date | null;
  registrationVerifiedBy?: string;
  registrationReference?: string;
  // Defaults
  defaultPaymentTerms?: string;
  defaultDeclarations?: string;
  // Mode
  testMode: boolean;
  // Meta
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AddressSubSchema = new Schema(
  {
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true, default: "" },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    stateCode: { type: String, required: true, trim: true, maxlength: 2 },
    pincode: { type: String, trim: true, default: "" },
    country: { type: String, trim: true, default: "India" },
  },
  { _id: false }
);

const InvoiceSettingsSchema = new Schema<IInvoiceSettings>(
  {
    sellerLegalName: { type: String, required: true, trim: true },
    sellerTradeName: { type: String, trim: true, default: "" },
    sellerAddress: { type: AddressSubSchema, required: true },
    sellerGstin: { type: String, trim: true },
    sellerPhone: { type: String, trim: true, default: "" },
    sellerEmail: { type: String, trim: true, default: "" },
    logoUrl: { type: String, trim: true, default: "" },
    brandColor: { type: String, trim: true, default: "#1e3a5f" },
    invoicePrefix: { type: String, trim: true, default: "INV" },
    gstRegistrationEffectiveDate: { type: Date, default: null },
    registrationVerified: { type: Boolean, default: false },
    registrationVerifiedAt: { type: Date, default: null },
    registrationVerifiedBy: { type: String, trim: true, default: "" },
    registrationReference: { type: String, trim: true, default: "" },
    defaultPaymentTerms: { type: String, trim: true, default: "" },
    defaultDeclarations: { type: String, trim: true, default: "" },
    testMode: { type: Boolean, default: true },
    updatedBy: { type: String, trim: true },
  },
  { timestamps: true }
);

export const InvoiceSettings: Model<IInvoiceSettings> =
  mongoose.models.InvoiceSettings ||
  mongoose.model<IInvoiceSettings>("InvoiceSettings", InvoiceSettingsSchema);

export default InvoiceSettings;
