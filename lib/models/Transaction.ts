import mongoose, { Schema, Document, Model } from "mongoose";

export type AccountType = "MAIN" | "ECOMMERCE";

export interface ITransaction extends Document {
  accountType: AccountType;
  date: Date;
  description: string;
  category: string;
  debit: number;
  credit: number;
  paymentMode: string;
  bankOrCash: "Bank" | "Cash" | "N/A";
  partyName?: string;
  invoiceOrderId?: string;
  gstApplicable: boolean;
  gstAmount: number;
  tdsTcsAmount: number;
  remarks?: string;
  billAvailable: boolean;
  billId?: mongoose.Types.ObjectId;
  source: "MANUAL" | "PURCHASE" | "ORDER" | "EXCEL_IMPORT" | "ADJUSTMENT";
  sourceId?: mongoose.Types.ObjectId;
  importBatchId?: string;
  isArchived: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    accountType: {
      type: String,
      enum: ["MAIN", "ECOMMERCE"],
      required: true,
      index: true,
    },
    date: { type: Date, required: true, default: Date.now, index: true },
    description: { type: String, required: true, trim: true, index: true },
    category: { type: String, required: true, trim: true, index: true },
    debit: { type: Number, required: true, default: 0, min: 0 },
    credit: { type: Number, required: true, default: 0, min: 0 },
    paymentMode: {
      type: String,
      required: true,
      default: "Bank Transfer",
      trim: true,
      index: true,
    },
    bankOrCash: {
      type: String,
      enum: ["Bank", "Cash", "N/A"],
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
TransactionSchema.index({ accountType: 1, date: -1, isArchived: 1 });
TransactionSchema.index({ accountType: 1, category: 1 });
TransactionSchema.index({ accountType: 1, bankOrCash: 1 });
TransactionSchema.index({ invoiceOrderId: 1, accountType: 1 });

export const Transaction: Model<ITransaction> =
  mongoose.models.Transaction ||
  mongoose.model<ITransaction>("Transaction", TransactionSchema);
export default Transaction;
