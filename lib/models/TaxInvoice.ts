import mongoose, { Schema, Document, Model } from "mongoose";

// ─── Address ────────────────────────────────────────────────────────────────

export interface IAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  stateCode: string;
  pincode?: string;
  country?: string;
}

const AddressSchema = new Schema<IAddress>(
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

// ─── Seller Snapshot ─────────────────────────────────────────────────────────

export interface ISellerSnapshot {
  legalName: string;
  tradeName?: string;
  address: IAddress;
  gstin?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  brandColor?: string;
}

const SellerSnapshotSchema = new Schema<ISellerSnapshot>(
  {
    legalName: { type: String, required: true, trim: true },
    tradeName: { type: String, trim: true },
    address: { type: AddressSchema, required: true },
    gstin: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    logoUrl: { type: String, trim: true },
    brandColor: { type: String, trim: true, default: "#1e3a5f" },
  },
  { _id: false }
);

// ─── Buyer Snapshot ───────────────────────────────────────────────────────────

export interface IBuyerSnapshot {
  name: string;
  type: "B2C_UNREGISTERED" | "B2B_REGISTERED" | "OTHER";
  gstin?: string;
  billingAddress: IAddress;
  shippingAddress?: IAddress;
  phone?: string;
  email?: string;
  placeOfSupply: string;
  placeOfSupplyCode: string;
}

const BuyerSnapshotSchema = new Schema<IBuyerSnapshot>(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["B2C_UNREGISTERED", "B2B_REGISTERED", "OTHER"],
      default: "B2C_UNREGISTERED",
    },
    gstin: { type: String, trim: true },
    billingAddress: { type: AddressSchema, required: true },
    shippingAddress: { type: AddressSchema },
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    placeOfSupply: { type: String, required: true, trim: true },
    placeOfSupplyCode: { type: String, required: true, trim: true, maxlength: 2 },
  },
  { _id: false }
);

// ─── Line Item ────────────────────────────────────────────────────────────────

export interface ILineItemSnapshot {
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

const LineItemSnapshotSchema = new Schema<ILineItemSnapshot>(
  {
    description: { type: String, required: true, trim: true },
    hsnSac: { type: String, trim: true, default: "" },
    quantity: { type: Number, required: true },
    unit: { type: String, trim: true, default: "NOS" },
    unitPrice: { type: Number, required: true },
    discountType: { type: String, enum: ["NONE", "PERCENT", "FIXED"], default: "NONE" },
    discountValue: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    taxableValue: { type: Number, required: true },
    gstRate: { type: Number, default: 0 },
    cgstRate: { type: Number, default: 0 },
    sgstRate: { type: Number, default: 0 },
    igstRate: { type: Number, default: 0 },
    cgstAmount: { type: Number, default: 0 },
    sgstAmount: { type: Number, default: 0 },
    igstAmount: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    lineTotal: { type: Number, required: true },
  },
  { _id: false }
);

// ─── Tax Summary ──────────────────────────────────────────────────────────────

export interface ITaxSummary {
  taxableSubtotal: number;
  totalDiscount: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  totalGst: number;
  grossTotal: number;
  roundOff: number;
  amountPayable: number;
  amountInWords: string;
}

const TaxSummarySchema = new Schema<ITaxSummary>(
  {
    taxableSubtotal: { type: Number, required: true },
    totalDiscount: { type: Number, default: 0 },
    cgstTotal: { type: Number, default: 0 },
    sgstTotal: { type: Number, default: 0 },
    igstTotal: { type: Number, default: 0 },
    totalGst: { type: Number, required: true },
    grossTotal: { type: Number, required: true },
    roundOff: { type: Number, default: 0 },
    amountPayable: { type: Number, required: true },
    amountInWords: { type: String, required: true },
  },
  { _id: false }
);

// ─── Cancellation ─────────────────────────────────────────────────────────────

export interface ICancellationInfo {
  cancelledAt: Date;
  cancelledBy: string;
  reason: string;
}

const CancellationInfoSchema = new Schema<ICancellationInfo>(
  {
    cancelledAt: { type: Date, required: true },
    cancelledBy: { type: String, required: true, trim: true },
    reason: { type: String, required: true, trim: true },
  },
  { _id: false }
);

// ─── TaxInvoice ───────────────────────────────────────────────────────────────

export interface ITaxInvoice extends Document {
  mode: "TEST" | "PRODUCTION";
  status: "DRAFT" | "ISSUED" | "CANCELLED";
  serialNumber?: string;
  financialYear?: string;
  invoiceDate: Date;
  // Seller snapshot (copied at issuance; drafts may store a reference)
  sellerSnapshot?: ISellerSnapshot;
  // Buyer info
  buyer: IBuyerSnapshot;
  // Marketplace
  platform?: string;
  marketplaceOrderId?: string;
  marketplaceRef?: string;
  // Shipment
  courierCompany?: string;
  awbNumber?: string;
  trackingNumber?: string;
  // Tax
  taxTreatment: "INTRA_STATE" | "INTER_STATE" | "EXEMPT" | "NIL";
  applyRoundOff: boolean;
  reverseChargeApplicable: boolean;
  lineItems: ILineItemSnapshot[];
  taxSummary?: ITaxSummary;
  // Document
  notes?: string;
  paymentTerms?: string;
  additionalDeclarations?: string;
  // PDF / PNG
  pdfGridFsId?: mongoose.Types.ObjectId;
  pdfChecksum?: string;
  pdfFilename?: string;
  pngGridFsIds?: mongoose.Types.ObjectId[];
  pngFilenames?: string[];
  // Issuance
  issuedAt?: Date;
  issuedBy?: string;
  idempotencyKey?: string;
  templateVersion: string;
  // Cancellation
  cancellation?: ICancellationInfo;
  // Audit
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const TaxInvoiceSchema = new Schema<ITaxInvoice>(
  {
    mode: { type: String, enum: ["TEST", "PRODUCTION"], required: true, default: "TEST", index: true },
    status: {
      type: String,
      enum: ["DRAFT", "ISSUED", "CANCELLED"],
      required: true,
      default: "DRAFT",
      index: true,
    },
    serialNumber: { type: String, trim: true, index: true, sparse: true },
    financialYear: { type: String, trim: true, index: true },
    invoiceDate: { type: Date, required: true, index: true },
    sellerSnapshot: { type: SellerSnapshotSchema },
    buyer: { type: BuyerSnapshotSchema, required: true },
    platform: { type: String, trim: true, index: true },
    marketplaceOrderId: { type: String, trim: true, index: true },
    marketplaceRef: { type: String, trim: true },
    courierCompany: { type: String, trim: true },
    awbNumber: { type: String, trim: true },
    trackingNumber: { type: String, trim: true },
    taxTreatment: {
      type: String,
      enum: ["INTRA_STATE", "INTER_STATE", "EXEMPT", "NIL"],
      required: true,
    },
    applyRoundOff: { type: Boolean, default: true },
    reverseChargeApplicable: { type: Boolean, default: false },
    lineItems: { type: [LineItemSnapshotSchema], required: true, default: [] },
    taxSummary: { type: TaxSummarySchema },
    notes: { type: String, trim: true },
    paymentTerms: { type: String, trim: true },
    additionalDeclarations: { type: String, trim: true },
    pdfGridFsId: { type: Schema.Types.ObjectId },
    pdfChecksum: { type: String, trim: true },
    pdfFilename: { type: String, trim: true },
    pngGridFsIds: { type: [Schema.Types.ObjectId], default: [] },
    pngFilenames: { type: [String], default: [] },
    issuedAt: { type: Date },
    issuedBy: { type: String, trim: true },
    idempotencyKey: { type: String, trim: true, sparse: true },
    templateVersion: { type: String, trim: true, default: "1.0" },
    cancellation: { type: CancellationInfoSchema },
    createdBy: { type: String, trim: true, default: "System" },
  },
  { timestamps: true }
);

// Unique constraint: serial number must be unique within (mode, financialYear)
// Only enforced for issued invoices where serialNumber is allocated (string)
TaxInvoiceSchema.index(
  { mode: 1, financialYear: 1, serialNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { serialNumber: { $type: "string" } },
  }
);
TaxInvoiceSchema.index({ createdAt: -1 });
TaxInvoiceSchema.index({ mode: 1, status: 1, createdAt: -1 });
TaxInvoiceSchema.index({ "buyer.name": "text", marketplaceOrderId: "text", serialNumber: "text" });

export const TaxInvoice: Model<ITaxInvoice> =
  mongoose.models.TaxInvoice ||
  mongoose.model<ITaxInvoice>("TaxInvoice", TaxInvoiceSchema);

export default TaxInvoice;
