import mongoose from "mongoose";
import { connectDB } from "../lib/db/connection";
import { User } from "../lib/models/User";
import { Category } from "../lib/models/Category";
import { Product } from "../lib/models/Product";
import { Platform } from "../lib/models/Platform";
import { Party } from "../lib/models/Party";
import { StockMovement } from "../lib/models/StockMovement";
import { Purchase } from "../lib/models/Purchase";
import { Order } from "../lib/models/Order";
import { Transaction } from "../lib/models/Transaction";
import { Bill } from "../lib/models/Bill";
import { ImportBatch } from "../lib/models/ImportBatch";
import { hashPassword } from "../lib/auth/session";

export interface SeedOptions {
  clearDummyData?: boolean;
}

export async function runSeed(options: SeedOptions = { clearDummyData: true }) {
  console.log("Initializing Foxion clean database configuration...");
  await connectDB();

  // If clearDummyData is requested, remove all dummy and sample records
  if (options.clearDummyData) {
    console.log("Purging any dummy and sample business data...");
    await Promise.all([
      Order.deleteMany({}),
      Purchase.deleteMany({}),
      Transaction.deleteMany({}),
      StockMovement.deleteMany({}),
      Product.deleteMany({}),
      Party.deleteMany({}),
      Bill.deleteMany({}),
      ImportBatch.deleteMany({}),
    ]);
    console.log("All dummy records cleared.");
  }

  // 1. Initialize Admin User
  const adminEmail = process.env.ADMIN_EMAIL || "admin@foxion.in";
  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    const password = process.env.ADMIN_PASSWORD || "admin123456";
    const passwordHash = await hashPassword(password);
    admin = await User.create({
      name: "Foxion Admin",
      email: adminEmail,
      passwordHash,
      role: "admin",
      isActive: true,
    });
    console.log(`Admin account initialized: ${adminEmail}`);
  }

  // 2. Initialize Standard Categories
  const categoryDefs = [
    { name: "Kitchen", slug: "kitchen", type: "PRODUCT" as const, description: "Kitchen tools, choppers, and lighters" },
    { name: "Electronics", slug: "electronics", type: "PRODUCT" as const, description: "Speakers, chargers, and electronic devices" },
    { name: "Home Appliances", slug: "home-appliances", type: "PRODUCT" as const, description: "Small home and kitchen appliances" },
    { name: "Accessories", slug: "accessories", type: "PRODUCT" as const, description: "Accessories and peripherals" },
    { name: "Office Expenses", slug: "office-expenses", type: "EXPENSE" as const, description: "Rent, electricity, internet" },
    { name: "Salaries & Wages", slug: "salaries", type: "EXPENSE" as const, description: "Employee salaries and contract labor" },
    { name: "Advertising & Marketing", slug: "advertising", type: "EXPENSE" as const, description: "Meta ads, Google ads, influencers" },
    { name: "Logistics & Packaging", slug: "logistics", type: "EXPENSE" as const, description: "Corrugated boxes, bubble wrap, tape" },
    { name: "Purchases / Inventory Inward", slug: "purchases-inward", type: "EXPENSE" as const, description: "Product purchase costs" },
  ];

  for (const c of categoryDefs) {
    const existing = await Category.findOne({ name: c.name });
    if (!existing) {
      await Category.create(c);
    }
  }
  console.log("Standard business categories initialized.");

  // 3. Initialize Standard E-Commerce Platforms
  const platformDefs = [
    { name: "Amazon", code: "AMZ", defaultCommissionPercentage: 15, color: "#f59e0b" },
    { name: "Meesho", code: "MSH", defaultCommissionPercentage: 5, color: "#ec4899" },
    { name: "Flipkart", code: "FLP", defaultCommissionPercentage: 14, color: "#3b82f6" },
    { name: "Direct", code: "DIR", defaultCommissionPercentage: 2, color: "#10b981" },
    { name: "Instagram", code: "INSTA", defaultCommissionPercentage: 0, color: "#8b5cf6" },
  ];

  for (const p of platformDefs) {
    const existing = await Platform.findOne({ code: p.code });
    if (!existing) {
      await Platform.create(p);
    }
  }
  console.log("E-commerce platforms initialized.");

  console.log("Foxion system initialization completed cleanly (no dummy data).");
  return { success: true, message: "Foxion initialized cleanly with zero dummy data" };
}
