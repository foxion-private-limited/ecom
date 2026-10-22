import { connectDB } from "@/lib/db/connection";
import { Product, IProduct } from "@/lib/models/Product";
import {
  StockMovement,
  IStockMovement,
  StockMovementType,
} from "@/lib/models/StockMovement";
import { Category } from "@/lib/models/Category";
import { ProductCategory } from "@/lib/models/ProductCategory";
import { Order } from "@/lib/models/Order";
import { Purchase } from "@/lib/models/Purchase";
import { cleanupImageIfUnreferenced } from "@/lib/services/imageStorageService";
import mongoose from "mongoose";

export interface ProductFilterOptions {
  category?: string;
  stockStatus?: "ALL" | "GOOD" | "LOW" | "OUT";
  isActive?: boolean;
  search?: string;
  sortBy?: "name" | "price" | "stock" | "createdAt";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface InventoryOverview {
  totalProducts: number;
  totalStockUnits: number;
  totalInventoryValue: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export async function getProducts(options: ProductFilterOptions = {}) {
  await connectDB();

  const {
    category,
    stockStatus,
    isActive = true,
    search,
    sortBy = "createdAt",
    sortOrder = "desc",
    page = 1,
    limit = 50,
  } = options;

  const query: Record<string, unknown> = {};
  if (isActive !== undefined) {
    query.isActive = isActive;
  }

  if (category && category !== "ALL") {
    if (mongoose.Types.ObjectId.isValid(category)) {
      query.category = category;
    } else {
      const prodCat = await ProductCategory.findOne({ name: category });
      if (prodCat) {
        query.category = prodCat._id;
      } else {
        const cat = await Category.findOne({ name: category });
        if (cat) query.category = cat._id;
      }
    }
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { sku: { $regex: search, $options: "i" } },
      { brand: { $regex: search, $options: "i" } },
    ];
  }

  const sortMap: Record<string, Record<string, 1 | -1>> = {
    name: { name: sortOrder === "asc" ? 1 : -1 },
    price: { sellingPrice: sortOrder === "asc" ? 1 : -1 },
    stock: { currentStock: sortOrder === "asc" ? 1 : -1 },
    createdAt: { createdAt: sortOrder === "asc" ? 1 : -1 },
  };

  const sort = sortMap[sortBy] || { createdAt: -1 };

  let products = await Product.find(query)
    .populate("category", "name slug")
    .sort(sort)
    .lean();

  // Filter by stockStatus in memory if requested
  if (stockStatus && stockStatus !== "ALL") {
    products = products.filter((p) => {
      if (stockStatus === "OUT") {
        return p.currentStock <= 0;
      }
      if (stockStatus === "LOW") {
        return p.currentStock > 0 && p.currentStock <= p.lowStockThreshold;
      }
      if (stockStatus === "GOOD") {
        return p.currentStock > p.lowStockThreshold;
      }
      return true;
    });
  }

  const total = products.length;
  const skip = (page - 1) * limit;
  const paginated = products.slice(skip, skip + limit);

  return {
    products: paginated,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getProductById(id: string) {
  await connectDB();
  return Product.findById(id).populate("category", "name slug").lean();
}

export type ProductInputData = Omit<Partial<IProduct>, "category" | "imageId"> & {
  category?: string | mongoose.Types.ObjectId;
  imageId?: string | mongoose.Types.ObjectId;
};

export async function createProduct(
  data: ProductInputData & { category: string | mongoose.Types.ObjectId },
  userEmail: string = "System"
): Promise<IProduct> {
  await connectDB();

  const product = await Product.create({
    ...data,
    sku: data.sku?.toUpperCase().trim(),
  });

  // If opening stock is greater than 0, create an OPENING StockMovement
  if (data.currentStock && data.currentStock > 0) {
    await StockMovement.create({
      productId: product._id,
      type: "OPENING",
      quantity: data.currentStock,
      referenceType: "OPENING",
      previousStock: 0,
      newStock: data.currentStock,
      date: new Date(),
      remarks: "Initial opening stock recorded",
      createdBy: userEmail,
    });
  }

  return product;
}

export async function updateProduct(
  id: string,
  data: ProductInputData
): Promise<IProduct | null> {
  await connectDB();
  const updateData: Record<string, unknown> = { ...data };
  if (data.sku) {
    updateData.sku = data.sku.toUpperCase().trim();
  }

  const existing = await Product.findById(id);
  if (!existing) return null;

  const oldImageId =
    existing.imageId?.toString() ||
    (existing.imageUrl?.startsWith("/api/products/images/")
      ? existing.imageUrl.replace("/api/products/images/", "").trim()
      : null);

  // If new image is an external URL or removed, unset stored GridFS imageId
  if (
    data.imageType === "URL" ||
    (typeof data.imageUrl === "string" && !data.imageUrl.startsWith("/api/products/images/"))
  ) {
    delete updateData.imageId;
    updateData.$unset = { imageId: 1 };
  } else if (data.imageId && typeof data.imageId === "string" && mongoose.Types.ObjectId.isValid(data.imageId)) {
    updateData.imageId = new mongoose.Types.ObjectId(data.imageId);
  }

  const updated = await Product.findByIdAndUpdate(id, updateData, {
    returnDocument: "after",
  });

  // Clean up old uploaded image only after successful update, and only if not referenced elsewhere
  if (updated && oldImageId) {
    const newImageId =
      updated.imageId?.toString() ||
      (updated.imageUrl?.startsWith("/api/products/images/")
        ? updated.imageUrl.replace("/api/products/images/", "").trim()
        : null);

    if (newImageId !== oldImageId) {
      await cleanupImageIfUnreferenced(oldImageId, id);
    }
  }

  return updated;
}

export async function deleteProduct(id: string): Promise<boolean> {
  await connectDB();
  const product = await Product.findById(id);
  if (!product) return false;

  const imageId =
    product.imageId?.toString() ||
    (product.imageUrl?.startsWith("/api/products/images/")
      ? product.imageUrl.replace("/api/products/images/", "").trim()
      : null);

  if (imageId) {
    await cleanupImageIfUnreferenced(imageId, id);
  }

  await Product.findByIdAndDelete(id);
  return true;
}

export async function archiveProduct(id: string): Promise<boolean> {
  await connectDB();
  const res = await Product.findByIdAndUpdate(id, { isActive: false });
  return !!res;
}

/**
 * Record a stock movement atomically and adjust Product currentStock
 */
export async function recordStockMovement(params: {
  productId: string | mongoose.Types.ObjectId;
  type: StockMovementType;
  quantity: number;
  referenceId?: string;
  referenceType?: "PURCHASE" | "ORDER" | "RETURN" | "DAMAGE" | "ADJUSTMENT" | "OPENING";
  remarks?: string;
  createdBy?: string;
}): Promise<IStockMovement> {
  await connectDB();

  const product = await Product.findById(params.productId);
  if (!product) {
    throw new Error(`Product not found with ID: ${params.productId}`);
  }

  const previousStock = product.currentStock;
  const newStock = previousStock + params.quantity;

  if (newStock < 0 && params.type !== "ADJUSTMENT") {
    // We allow adjustment or log warning, but preferably clamp or check
    console.warn(
      `[Stock Warning] Product ${product.sku} stock dropping below zero: ${newStock}`
    );
  }

  product.currentStock = Math.max(0, newStock);
  await product.save();

  const movement = await StockMovement.create({
    productId: product._id,
    type: params.type,
    quantity: params.quantity,
    referenceId: params.referenceId,
    referenceType: params.referenceType,
    previousStock,
    newStock: product.currentStock,
    date: new Date(),
    remarks: params.remarks,
    createdBy: params.createdBy || "System",
  });

  return movement;
}

export async function getStockMovements(
  productId?: string,
  limit: number = 100
) {
  await connectDB();
  const query: Record<string, unknown> = {};
  if (productId) {
    query.productId = productId;
  }
  return StockMovement.find(query)
    .populate("productId", "name sku")
    .sort({ date: -1, createdAt: -1 })
    .limit(limit)
    .lean();
}

export async function getInventorySummary(): Promise<InventoryOverview> {
  await connectDB();

  const products = await Product.find({ isActive: true }).lean();

  let totalStockUnits = 0;
  let totalInventoryValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  for (const p of products) {
    const stock = p.currentStock || 0;
    const price = p.purchasePrice || 0;
    totalStockUnits += stock;
    totalInventoryValue += stock * price;

    if (stock <= 0) {
      outOfStockCount++;
    } else if (stock <= (p.lowStockThreshold || 10)) {
      lowStockCount++;
    }
  }

  return {
    totalProducts: products.length,
    totalStockUnits,
    totalInventoryValue,
    lowStockCount,
    outOfStockCount,
  };
}

export async function getProductDetailMetrics(productId: string) {
  await connectDB();
  const prodId = new mongoose.Types.ObjectId(productId);

  const [movements, orders, purchases] = await Promise.all([
    StockMovement.find({ productId: prodId }).sort({ date: -1 }).lean(),
    Order.find({ "items.productId": prodId }).sort({ date: -1 }).lean(),
    Purchase.find({ "items.productId": prodId }).sort({ date: -1 }).lean(),
  ]);

  let totalSoldUnits = 0;
  let totalSalesRevenue = 0;
  let totalPurchasedUnits = 0;
  let totalPurchaseCost = 0;

  for (const o of orders) {
    for (const item of o.items) {
      if (item.productId.toString() === productId && !item.isReturned) {
        totalSoldUnits += item.quantity;
        totalSalesRevenue += item.total;
      }
    }
  }

  for (const p of purchases) {
    for (const item of p.items) {
      if (item.productId.toString() === productId) {
        totalPurchasedUnits += item.quantity;
        totalPurchaseCost += item.total;
      }
    }
  }

  return {
    movements,
    orders,
    purchases,
    totalSoldUnits,
    totalSalesRevenue,
    totalPurchasedUnits,
    totalPurchaseCost,
  };
}
