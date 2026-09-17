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
  console.log("[Foxion DB] Connecting to database...");
  await connectDB();

  console.log("[Foxion DB] Purging all dummy & sample records...");
  const results = await Promise.all([
    Order.deleteMany({}),
    Purchase.deleteMany({}),
    Transaction.deleteMany({}),
    StockMovement.deleteMany({}),
    Product.deleteMany({}),
    Party.deleteMany({}),
    Bill.deleteMany({}),
    ImportBatch.deleteMany({}),
  ]);

  console.log("[Foxion DB] Dummy data successfully purged:");
  console.log(` - Orders deleted: ${results[0].deletedCount}`);
  console.log(` - Purchases deleted: ${results[1].deletedCount}`);
  console.log(` - Transactions deleted: ${results[2].deletedCount}`);
  console.log(` - Stock movements deleted: ${results[3].deletedCount}`);
  console.log(` - Products deleted: ${results[4].deletedCount}`);
  console.log(` - Parties deleted: ${results[5].deletedCount}`);
  console.log(` - Bills deleted: ${results[6].deletedCount}`);
  console.log(` - Import batches deleted: ${results[7].deletedCount}`);

  // Ensure Admin User Exists
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
    console.log(`[Foxion DB] Verified admin user: ${adminEmail}`);
  }

  // Ensure Standard Taxonomy (Categories) Exist
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

  // Ensure Standard Platforms Exist
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

  console.log("====================================================");
  console.log("All dummy records cleared! Database is completely clean.");
  console.log("Standard admin, categories, and platforms are preserved.");
  console.log("====================================================");

  return {
    success: true,
    message: "All dummy data cleared successfully. System is in clean production state.",
    clearedCounts: {
      orders: results[0].deletedCount,
      purchases: results[1].deletedCount,
      transactions: results[2].deletedCount,
      stockMovements: results[3].deletedCount,
      products: results[4].deletedCount,
      parties: results[5].deletedCount,
      bills: results[6].deletedCount,
      importBatches: results[7].deletedCount,
    },
  };
}

if (require.main === module || process.argv[1]?.endsWith("clear-dummy-data.ts")) {
  clearAllDummyData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[Foxion DB] Error clearing dummy data:", err);
      process.exit(1);
    });
}
