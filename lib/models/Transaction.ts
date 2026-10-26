import mongoose, { Schema, Document, Model } from "mongoose";

export type AccountType = "MAIN";
export type TransactionOrigin = "COMPANY" | "PRE_COMPANY";
export type PaymentSource =
  | "Company Bank"
  | "Company Cash"
  | "Personal Bank"
  | "Personal Cash"
  | "Other";

export interface ITransactionAttachment {
  fileId?: mongoose.Types.ObjectId;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface ITransaction extends Document {
  accountType: AccountType;
  transactionOrigin: TransactionOrigin;
  paidBy?: string;
  paymentSource?: PaymentSource | string;
  date: Date;
  description: string;
  category: string;
  debit: number;
  credit: number;
  balance?: number;
  paymentMode: string;
  bankOrCash: "Bank" | "Cash" | "Personal Bank" | "Personal Cash" | "N/A";
  partyName?: string;
  invoiceOrderId?: string;
  gstApplicable: boolean;
  gstAmount: number;
  tdsTcsAmount: number;
  remarks?: string;
  billAvailable: boolean;
  billId?: mongoose.Types.ObjectId;
  attachment?: ITransactionAttachment | null;
  source: "MANUAL" | "PURCHASE" | "ORDER" | "EXCEL_IMPORT" | "ADJUSTMENT";
  sourceId?: mongoose.Types.ObjectId;
  importBatchId?: string;
  isArchived: boolean;
  normalizedDate?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    accountType: {
      type: String,
      enum: ["MAIN"],
      required: true,
      default: "MAIN",
      index: true,
    },
    transactionOrigin: {
      type: String,
      enum: ["COMPANY", "PRE_COMPANY"],
      required: true,
      default: "COMPANY",
      index: true,
    },
    paidBy: { type: String, trim: true, index: true },
    paymentSource: {
      type: String,
      enum: ["Company Bank", "Company Cash", "Personal Bank", "Personal Cash", "Other"],
      default: "Company Bank",
      index: true,
    },
    date: { type: Date, required: true, default: Date.now, index: true },
    normalizedDate: { type: String, index: true },
    description: { type: String, required: true, trim: true, index: true },
    category: { type: String, required: true, trim: true, index: true },
    debit: { type: Number, required: true, default: 0, min: 0 },
    credit: { type: Number, required: true, default: 0, min: 0 },
    balance: { type: Number },
    paymentMode: {
      type: String,
      required: true,
      default: "Bank Transfer",
      trim: true,
      index: true,
    },
    bankOrCash: {
      type: String,
      enum: ["Bank", "Cash", "Personal Bank", "Personal Cash", "N/A"],
      required: true,
      default: "Bank",
      index: true,
    },
    partyName: { type: String, trim: true, index: true },
    invoiceOrderId: { type: String, trim: true, index: true },
    gstApplicable: { type: Boolean, default: false },
    gstAmount: { type: Number, default: 0, min: 0 },
    tdsTcsAmount: { type: Number, default: 0, min: 0 },
    remarks: { type: String, trim: true },
    billAvailable: { type: Boolean, default: false },
    billId: { type: Schema.Types.ObjectId, ref: "Bill" },
    attachment: {
      type: {
        fileId: { type: Schema.Types.ObjectId },
        url: { type: String, trim: true },
        originalName: { type: String, trim: true },
        mimeType: { type: String, trim: true },
        size: { type: Number },
      },
      default: undefined,
    },
    source: {
      type: String,
      enum: ["MANUAL", "PURCHASE", "ORDER", "EXCEL_IMPORT", "ADJUSTMENT"],
      default: "MANUAL",
      index: true,
    },
    sourceId: { type: Schema.Types.ObjectId },
    importBatchId: { type: String, trim: true, index: true },
    isArchived: { type: Boolean, default: false, index: true },
    createdBy: { type: String, default: "System", trim: true },
  },
  { timestamps: true }
);

// Compound indexes for high performance querying
TransactionSchema.index({ accountType: 1, transactionOrigin: 1, date: -1, isArchived: 1 });
TransactionSchema.index({ transactionOrigin: 1, date: -1, isArchived: 1 });
TransactionSchema.index({ bankOrCash: 1, date: -1, isArchived: 1 });
TransactionSchema.index({ category: 1, date: -1 });

// Database-level uniqueness constraint to prevent race conditions on duplicate transaction dates
TransactionSchema.index(
  { accountType: 1, transactionOrigin: 1, normalizedDate: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isArchived: { $ne: true },
      normalizedDate: { $type: "string" },
    },
  }
);

export const Transaction: Model<ITransaction> =
  mongoose.models.Transaction ||
  mongoose.model<ITransaction>("Transaction", TransactionSchema);
export default Transaction;
