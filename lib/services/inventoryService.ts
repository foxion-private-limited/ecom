import { connectDB } from "@/lib/db/connection";
import { Product, IProduct } from "@/lib/models/Product";
import {
  StockMovement,
  IStockMovement,
  StockMovementType,
} from "@/lib/models/StockMovement";
import { Category } from "@/lib/models/Category";
import { Order } from "@/lib/models/Order";
import { Purchase } from "@/lib/models/Purchase";
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

  const query: any = {};
  if (isActive !== undefined) {
    query.isActive = isActive;
  }

  if (category && category !== "ALL") {
    if (mongoose.Types.ObjectId.isValid(category)) {
      query.category = category;
    } else {
      const cat = await Category.findOne({ name: category });
      if (cat) query.category = cat._id;
    }
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { sku: { $regex: search, $options: "i" } },
      { brand: { $regex: search, $options: "i" } },
    ];
  }

  const sortMap: Record<string, any> = {
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

export async function createProduct(
  data: Partial<IProduct>,
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
  data: Partial<IProduct>
): Promise<IProduct | null> {
  await connectDB();
  if (data.sku) {
    data.sku = data.sku.toUpperCase().trim();
  }
  return Product.findByIdAndUpdate(id, data, { new: true });
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
  const query: any = {};
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
