import mongoose, { Schema, Document, Model } from "mongoose";

export interface IBill extends Document {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedBy?: string;
  category?: string;
  relatedType?: "TRANSACTION" | "PURCHASE" | "EXPENSE";
  relatedId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BillSchema = new Schema<IBill>(
  {
    filename: { type: String, required: true, trim: true },
    originalName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    size: { type: Number, required: true },
    url: { type: String, required: true, trim: true },
    uploadedBy: { type: String, default: "System" },
    category: { type: String, trim: true },
    relatedType: {
      type: String,
      enum: ["TRANSACTION", "PURCHASE", "EXPENSE"],
    },
    relatedId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true }
);

export const Bill: Model<IBill> =
  mongoose.models.Bill || mongoose.model<IBill>("Bill", BillSchema);
export default Bill;
