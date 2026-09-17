import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICategory extends Document {
  name: string;
  slug: string;
  type: "PRODUCT" | "EXPENSE" | "INCOME";
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    type: {
      type: String,
      enum: ["PRODUCT", "EXPENSE", "INCOME"],
      default: "PRODUCT",
      index: true,
    },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

CategorySchema.index({ name: 1, type: 1 }, { unique: true });

export const Category: Model<ICategory> =
  mongoose.models.Category ||
  mongoose.model<ICategory>("Category", CategorySchema);
export default Category;
