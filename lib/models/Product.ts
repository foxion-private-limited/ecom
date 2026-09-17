import mongoose, { Schema, Document, Model } from "mongoose";

export interface IProduct extends Document {
  name: string;
  sku: string;
  category: mongoose.Types.ObjectId;
  brand: string;
  imageUrl?: string;
  purchasePrice: number;
  sellingPrice: number;
  gstPercentage: number;
  currentStock: number;
  lowStockThreshold: number;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true, index: true },
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    brand: { type: String, default: "Foxion", trim: true },
    imageUrl: { type: String, trim: true },
    purchasePrice: { type: Number, required: true, min: 0, default: 0 },
    sellingPrice: { type: Number, required: true, min: 0, default: 0 },
    gstPercentage: { type: Number, required: true, min: 0, default: 18 },
    currentStock: { type: Number, required: true, default: 0, index: true },
    lowStockThreshold: { type: Number, required: true, default: 10 },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

ProductSchema.index({ name: "text", sku: "text", brand: "text" });

export const Product: Model<IProduct> =
  mongoose.models.Product || mongoose.model<IProduct>("Product", ProductSchema);
export default Product;
