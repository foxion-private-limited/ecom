import mongoose, { Schema, Document, Model } from "mongoose";

export interface IProductCategory extends Document {
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductCategorySchema = new Schema<IProductCategory>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

ProductCategorySchema.index({ name: 1 }, { unique: true });

export const ProductCategory: Model<IProductCategory> =
  mongoose.models.ProductCategory ||
  mongoose.model<IProductCategory>(
    "ProductCategory",
    ProductCategorySchema,
    "product_categories"
  );

export default ProductCategory;
