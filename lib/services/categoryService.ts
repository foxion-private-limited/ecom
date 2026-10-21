import { connectDB } from "@/lib/db/connection";
import { Category, ICategory } from "@/lib/models/Category";
import { ProductCategory, IProductCategory } from "@/lib/models/ProductCategory";
import { Transaction } from "@/lib/models/Transaction";
import { Product } from "@/lib/models/Product";
import mongoose from "mongoose";

/**
 * Ensures the CRED category exists in the accounting Category collection idempotently.
 * Never creates duplicates.
 */
export async function ensureCredCategory(): Promise<void> {
  await connectDB();
  const existing = await Category.findOne({
    name: { $regex: /^CRED$/i },
  });

  if (!existing) {
    await Category.create({
      name: "CRED",
      slug: "cred",
      type: "EXPENSE",
      description: "CRED transactions and card payments",
      isActive: true,
    });
  }
}

export interface AccountingCategoryWithUsage {
  _id: string;
  name: string;
  slug: string;
  type: "PRODUCT" | "EXPENSE" | "INCOME";
  description?: string;
  isActive: boolean;
  transactionCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProductCategoriesWithUsage {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  productCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// ==========================================
// 1. ACCOUNTING CATEGORIES (Accounts -> Categories)
// ==========================================

export async function getAccountingCategories(filters: {
  type?: string;
  search?: string;
  isActive?: boolean;
} = {}): Promise<AccountingCategoryWithUsage[]> {
  await connectDB();
  await ensureCredCategory();

  const query: Record<string, unknown> = {};

  if (filters.isActive !== undefined) {
    query.isActive = filters.isActive;
  }

  if (filters.type && filters.type !== "ALL") {
    query.type = filters.type;
  }

  if (filters.search && filters.search.trim()) {
    const s = filters.search.trim();
    query.$or = [
      { name: { $regex: s, $options: "i" } },
      { description: { $regex: s, $options: "i" } },
    ];
  }

  const [categories, txCounts] = await Promise.all([
    Category.find(query).sort({ name: 1 }).lean(),
    Transaction.aggregate([
      { $match: { isArchived: { $ne: true } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]),
  ]);

  const txCountMap = new Map<string, number>();
  for (const item of txCounts) {
    if (item._id) {
      txCountMap.set(String(item._id).trim().toLowerCase(), item.count);
    }
  }

  return categories.map((cat) => ({
    ...cat,
    _id: String(cat._id),
    transactionCount: txCountMap.get(cat.name.trim().toLowerCase()) || 0,
  })) as AccountingCategoryWithUsage[];
}

export async function getAccountingCategoryById(id: string): Promise<ICategory | null> {
  await connectDB();
  return Category.findById(id).lean();
}

export async function createAccountingCategory(data: {
  name: string;
  type: "PRODUCT" | "EXPENSE" | "INCOME";
  description?: string;
  isActive?: boolean;
}): Promise<ICategory> {
  await connectDB();

  const trimmedName = data.name.trim();
  const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const existing = await Category.findOne({
    name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
    type: data.type,
  });

  if (existing) {
    throw new Error(`An accounting category with the name "${trimmedName}" (${data.type}) already exists.`);
  }

  const category = await Category.create({
    name: trimmedName,
    slug,
    type: data.type,
    description: data.description?.trim() || "",
    isActive: data.isActive !== undefined ? data.isActive : true,
  });

  return category;
}

export async function updateAccountingCategory(
  id: string,
  data: {
    name?: string;
    type?: "PRODUCT" | "EXPENSE" | "INCOME";
    description?: string;
    isActive?: boolean;
  }
): Promise<ICategory> {
  await connectDB();

  const category = await Category.findById(id);
  if (!category) {
    throw new Error("Accounting category not found");
  }

  if (data.name && data.name.trim() !== category.name) {
    const trimmedName = data.name.trim();
    const typeToCheck = data.type || category.type;
    const existing = await Category.findOne({
      _id: { $ne: id },
      name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
      type: typeToCheck,
    });
    if (existing) {
      throw new Error(`An accounting category named "${trimmedName}" (${typeToCheck}) already exists.`);
    }
    category.name = trimmedName;
    category.slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }

  if (data.type) {
    category.type = data.type;
  }

  if (data.description !== undefined) {
    category.description = data.description.trim();
  }

  if (data.isActive !== undefined) {
    category.isActive = data.isActive;
  }

  await category.save();
  return category;
}

export async function deleteAccountingCategory(id: string): Promise<{ success: boolean; message: string }> {
  await connectDB();

  const category = await Category.findById(id);
  if (!category) {
    throw new Error("Accounting category not found");
  }

  // Safe reference check: do any transactions use this category name?
  const usageCount = await Transaction.countDocuments({
    category: category.name,
    isArchived: { $ne: true },
  });

  if (usageCount > 0) {
    throw new Error(
      `Cannot delete category "${category.name}" because it is currently assigned to ${usageCount} transaction(s). Reassign or archive those transactions first.`
    );
  }

  await Category.findByIdAndDelete(id);
  return { success: true, message: `Category "${category.name}" deleted successfully.` };
}

// ==========================================
// 2. PRODUCT CATEGORIES (Inventory -> Categories)
// ==========================================

export async function getProductCategories(filters: {
  search?: string;
  isActive?: boolean;
} = {}): Promise<ProductCategoriesWithUsage[]> {
  await connectDB();

  const query: Record<string, unknown> = {};

  if (filters.isActive !== undefined) {
    query.isActive = filters.isActive;
  }

  if (filters.search && filters.search.trim()) {
    const s = filters.search.trim();
    query.$or = [
      { name: { $regex: s, $options: "i" } },
      { description: { $regex: s, $options: "i" } },
    ];
  }

  const [categories, prodCounts] = await Promise.all([
    ProductCategory.find(query).sort({ name: 1 }).lean(),
    Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]),
  ]);

  const prodCountMap = new Map<string, number>();
  for (const item of prodCounts) {
    if (item._id) {
      prodCountMap.set(String(item._id), item.count);
    }
  }

  return categories.map((cat) => ({
    ...cat,
    _id: String(cat._id),
    productCount: prodCountMap.get(String(cat._id)) || 0,
  })) as ProductCategoriesWithUsage[];
}

export async function getProductCategoryById(id: string): Promise<IProductCategory | null> {
  await connectDB();
  return ProductCategory.findById(id).lean();
}

export async function createProductCategory(data: {
  name: string;
  description?: string;
  isActive?: boolean;
}): Promise<IProductCategory> {
  await connectDB();

  const trimmedName = data.name.trim();
  const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const existing = await ProductCategory.findOne({
    name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
  });

  if (existing) {
    throw new Error(`A product category with the name "${trimmedName}" already exists.`);
  }

  const category = await ProductCategory.create({
    name: trimmedName,
    slug,
    description: data.description?.trim() || "",
    isActive: data.isActive !== undefined ? data.isActive : true,
  });

  return category;
}

export async function updateProductCategory(
  id: string,
  data: {
    name?: string;
    description?: string;
    isActive?: boolean;
  }
): Promise<IProductCategory> {
  await connectDB();

  const category = await ProductCategory.findById(id);
  if (!category) {
    throw new Error("Product category not found");
  }

  if (data.name && data.name.trim() !== category.name) {
    const trimmedName = data.name.trim();
    const existing = await ProductCategory.findOne({
      _id: { $ne: id },
      name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
    });
    if (existing) {
      throw new Error(`A product category named "${trimmedName}" already exists.`);
    }
    category.name = trimmedName;
    category.slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }

  if (data.description !== undefined) {
    category.description = data.description.trim();
  }

  if (data.isActive !== undefined) {
    category.isActive = data.isActive;
  }

  await category.save();
  return category;
}

export async function deleteProductCategory(id: string): Promise<{ success: boolean; message: string }> {
  await connectDB();

  const category = await ProductCategory.findById(id);
  if (!category) {
    throw new Error("Product category not found");
  }

  const usageCount = await Product.countDocuments({
    category: new mongoose.Types.ObjectId(id),
    isActive: true,
  });

  if (usageCount > 0) {
    throw new Error(
      `Cannot delete product category "${category.name}" because it is currently assigned to ${usageCount} product(s).`
    );
  }

  await ProductCategory.findByIdAndDelete(id);
  return { success: true, message: `Product category "${category.name}" deleted successfully.` };
}
