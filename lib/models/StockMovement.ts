import mongoose, { Schema, Document, Model } from "mongoose";

export type StockMovementType =
  | "OPENING"
  | "PURCHASE"
  | "SALE"
  | "RETURN"
  | "DAMAGE"
  | "ADJUSTMENT";

export interface IStockMovement extends Document {
  productId: mongoose.Types.ObjectId;
  type: StockMovementType;
  quantity: number; // positive or negative
  referenceId?: string;
  referenceType?: "PURCHASE" | "ORDER" | "RETURN" | "DAMAGE" | "ADJUSTMENT" | "OPENING";
  previousStock: number;
  newStock: number;
  date: Date;
  remarks?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StockMovementSchema = new Schema<IStockMovement>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["OPENING", "PURCHASE", "SALE", "RETURN", "DAMAGE", "ADJUSTMENT"],
      required: true,
      index: true,
    },
    quantity: { type: Number, required: true },
    referenceId: { type: String, trim: true, index: true },
    referenceType: {
      type: String,
      enum: ["PURCHASE", "ORDER", "RETURN", "DAMAGE", "ADJUSTMENT", "OPENING"],
      index: true,
    },
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true },
    date: { type: Date, required: true, default: Date.now, index: true },
    remarks: { type: String, trim: true },
    createdBy: { type: String, default: "System", trim: true },
  },
  { timestamps: true }
);

StockMovementSchema.index({ productId: 1, date: -1 });

export const StockMovement: Model<IStockMovement> =
  mongoose.models.StockMovement ||
  mongoose.model<IStockMovement>("StockMovement", StockMovementSchema);
export default StockMovement;
