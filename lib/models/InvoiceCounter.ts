import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * InvoiceCounter maintains monotonically increasing, concurrency-safe
 * sequential counters per (mode, financialYear, prefix) combination.
 *
 * Atomic increment via findOneAndUpdate with $inc prevents duplicate numbers
 * even under concurrent requests.
 */
export interface IInvoiceCounter extends Document {
  /** Unique key: e.g. "TEST::26-27::INV" or "PRODUCTION::26-27::INV" */
  key: string;
  mode: "TEST" | "PRODUCTION";
  financialYear: string;
  prefix: string;
  lastSequence: number;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceCounterSchema = new Schema<IInvoiceCounter>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    mode: { type: String, enum: ["TEST", "PRODUCTION"], required: true },
    financialYear: { type: String, required: true, trim: true },
    prefix: { type: String, required: true, trim: true },
    lastSequence: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true }
);

export const InvoiceCounter: Model<IInvoiceCounter> =
  mongoose.models.InvoiceCounter ||
  mongoose.model<IInvoiceCounter>("InvoiceCounter", InvoiceCounterSchema);

export default InvoiceCounter;
