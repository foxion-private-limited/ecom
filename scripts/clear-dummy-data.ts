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

export async function clearAllDummyData() {
  console.log("[Foxion Cleanup] Connecting to database...");
  await connectDB();

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Failed to access native MongoDB database connection.");
  }

  // 1. Inspect initial document counts before cleanup
  const [
    initialTxCount,
    initialOrderCount,
    initialPurchaseCount,
    initialStockCount,
    initialProductCount,
    initialPartyCount,
    initialBillCount,
    initialBatchCount,
  ] = await Promise.all([
    Transaction.countDocuments(),
    Order.countDocuments(),
    Purchase.countDocuments(),
    StockMovement.countDocuments(),
    Product.countDocuments(),
    Party.countDocuments(),
    Bill.countDocuments(),
    ImportBatch.countDocuments(),
  ]);

  console.log("[Foxion Cleanup] Current operational document counts before cleanup:");
  console.log(` - Transactions: ${initialTxCount}`);
  console.log(` - Orders: ${initialOrderCount}`);
  console.log(` - Purchases: ${initialPurchaseCount}`);
  console.log(` - Stock Movements: ${initialStockCount}`);
  console.log(` - Products: ${initialProductCount}`);
  console.log(` - Parties: ${initialPartyCount}`);
  console.log(` - Bills: ${initialBillCount}`);
  console.log(` - Import Batches: ${initialBatchCount}`);

  // 2. Targeted Deletion of Operational Dummy Records
  console.log("\n[Foxion Cleanup] Deleting dummy operational records...");
  const [
    txRes,
    orderRes,
    purchaseRes,
    stockRes,
    productRes,
    partyRes,
    billRes,
    batchRes,
  ] = await Promise.all([
    Transaction.deleteMany({}),
    Order.deleteMany({}),
    Purchase.deleteMany({}),
    StockMovement.deleteMany({}),
    Product.deleteMany({}),
    Party.deleteMany({}),
    Bill.deleteMany({}),
    ImportBatch.deleteMany({}),
  ]);

  // 3. Drop legacy / obsolete collections if present (e.g. bankreconciliations)
  const existingCollections = await db.listCollections().toArray();
  const collectionNames = existingCollections.map((c) => c.name);

  let droppedLegacyCollections = 0;
  if (collectionNames.includes("bankreconciliations")) {
    await db.dropCollection("bankreconciliations");
    console.log("[Foxion Cleanup] Dropped obsolete legacy collection: bankreconciliations");
    droppedLegacyCollections++;
  }

  // 4. Preserve / Ensure Required System & Configuration Data
  console.log("\n[Foxion Cleanup] Preserving and verifying required system data...");

  // Admin user
  const adminEmail = process.env.ADMIN_EMAIL || "admin@foxion.in";
  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    const password = process.env.ADMIN_PASSWORD || "Ecom_Foxion_Password@2026";
    const passwordHash = await hashPassword(password);
    admin = await User.create({
      name: "Foxion Admin",
      email: adminEmail,
      passwordHash,
      role: "admin",
      isActive: true,
    });
    console.log(`[Foxion Cleanup] Admin account created: ${adminEmail}`);
  } else {
    // Ensure active and admin role
    admin.role = "admin";
    admin.isActive = true;
    await admin.save();
    console.log(`[Foxion Cleanup] Admin account verified: ${adminEmail}`);
  }

  // Categories
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

  // Platforms
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

  // 5. Final Post-Cleanup Verification Counts
  const [
    finalTxCount,
    finalOrderCount,
    finalPurchaseCount,
    finalStockCount,
    finalProductCount,
    finalPartyCount,
    finalBillCount,
    finalBatchCount,
    finalUserCount,
    finalCategoryCount,
    finalPlatformCount,
  ] = await Promise.all([
    Transaction.countDocuments(),
    Order.countDocuments(),
    Purchase.countDocuments(),
    StockMovement.countDocuments(),
    Product.countDocuments(),
    Party.countDocuments(),
    Bill.countDocuments(),
    ImportBatch.countDocuments(),
    User.countDocuments(),
    Category.countDocuments(),
    Platform.countDocuments(),
  ]);

  console.log("\n====================================================");
  console.log("Foxion Cleanup Completed Successfully!");
  console.log("====================================================");
  console.log("Deleted Records:");
  console.log(` - Transactions: ${txRes.deletedCount}`);
  console.log(` - Orders: ${orderRes.deletedCount}`);
  console.log(` - Purchases: ${purchaseRes.deletedCount}`);
  console.log(` - Stock Movements: ${stockRes.deletedCount}`);
  console.log(` - Products: ${productRes.deletedCount}`);
  console.log(` - Parties: ${partyRes.deletedCount}`);
  console.log(` - Bills: ${billRes.deletedCount}`);
  console.log(` - Import Batches: ${batchRes.deletedCount}`);
  console.log(` - Obsolete Legacy Collections Dropped: ${droppedLegacyCollections}`);
  console.log("----------------------------------------------------");
  console.log("Remaining Operational Records (must be 0):");
  console.log(` - Transactions: ${finalTxCount}`);
  console.log(` - Orders: ${finalOrderCount}`);
  console.log(` - Purchases: ${finalPurchaseCount}`);
  console.log(` - Stock Movements: ${finalStockCount}`);
  console.log(` - Products: ${finalProductCount}`);
  console.log(` - Parties: ${finalPartyCount}`);
  console.log(` - Bills: ${finalBillCount}`);
  console.log(` - Import Batches: ${finalBatchCount}`);
  console.log("----------------------------------------------------");
  console.log("Preserved System & Configuration Records:");
  console.log(` - Admin Users: ${finalUserCount}`);
  console.log(` - Categories: ${finalCategoryCount}`);
  console.log(` - Ecommerce Platforms: ${finalPlatformCount}`);
  console.log("====================================================");

  return {
    deleted: {
      transactions: txRes.deletedCount,
      orders: orderRes.deletedCount,
      purchases: purchaseRes.deletedCount,
      stockMovements: stockRes.deletedCount,
      products: productRes.deletedCount,
      parties: partyRes.deletedCount,
      bills: billRes.deletedCount,
      importBatches: batchRes.deletedCount,
      reconciliationCollectionsDropped: droppedLegacyCollections,
    },
    preserved: {
      adminUsers: finalUserCount,
      categories: finalCategoryCount,
      platforms: finalPlatformCount,
    },
    finalOperationalCounts: {
      transactions: finalTxCount,
      orders: finalOrderCount,
      purchases: finalPurchaseCount,
      stockMovements: finalStockCount,
      products: finalProductCount,
      parties: finalPartyCount,
      bills: finalBillCount,
      importBatches: finalBatchCount,
    },
  };
}

if (require.main === module || process.argv[1]?.endsWith("clear-dummy-data.ts")) {
  clearAllDummyData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[Foxion Cleanup] Fatal error during cleanup:", err);
      process.exit(1);
    });
}
