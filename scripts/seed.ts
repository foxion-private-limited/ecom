import mongoose from "mongoose";
import { connectDB } from "../lib/db/connection";
import { User } from "../lib/models/User";
import { Category } from "../lib/models/Category";
import { Platform } from "../lib/models/Platform";
import { hashPassword } from "../lib/auth/session";

import { clearAllDummyData } from "./clear-dummy-data";

export interface SeedOptions {
  clearDummyData?: boolean;
  resetAdminPassword?: boolean;
}

export async function runSeed(options: SeedOptions = {}) {
  console.log("[Foxion Seed] Connecting to database...");
  await connectDB();

  if (options.clearDummyData) {
    console.log("[Foxion Seed] clearDummyData requested. Purging any operational dummy data first...");
    await clearAllDummyData();
  }

  // 1. Initialize Admin User
  const adminEmail = process.env.ADMIN_EMAIL || "admin@foxion.in";
  const defaultPassword = process.env.ADMIN_PASSWORD || "Ecom_Foxion_Password@2026";
  let admin = await User.findOne({ email: adminEmail });

  if (!admin) {
    const passwordHash = await hashPassword(defaultPassword);
    admin = await User.create({
      name: "Foxion Admin",
      email: adminEmail,
      passwordHash,
      role: "admin",
      isActive: true,
    });
    console.log(`[Foxion Seed] Admin account initialized: ${adminEmail}`);
  } else if (options.resetAdminPassword) {
    admin.passwordHash = await hashPassword(defaultPassword);
    admin.role = "admin";
    admin.isActive = true;
    await admin.save();
    console.log(`[Foxion Seed] Admin account password reset: ${adminEmail}`);
  } else {
    console.log(`[Foxion Seed] Admin account already exists: ${adminEmail}`);
  }

  // 2. Initialize Standard Categories (Taxonomy)
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
    // Pre-Company & Setup Expense Categories
    { name: "Registration Expense", slug: "registration-expense", type: "EXPENSE" as const, description: "Company incorporation and registration expenses" },
    { name: "Government Fees", slug: "government-fees", type: "EXPENSE" as const, description: "Official statutory and regulatory filing fees" },
    { name: "Professional Fees", slug: "professional-fees", type: "EXPENSE" as const, description: "Chartered accountant, consultant, and agency fees" },
    { name: "Legal Fees", slug: "legal-fees", type: "EXPENSE" as const, description: "Legal documentation and trademark filing" },
    { name: "Business Setup", slug: "business-setup", type: "EXPENSE" as const, description: "Pre-incorporation capital and setup costs" },
    { name: "Domain / Hosting", slug: "domain-hosting", type: "EXPENSE" as const, description: "Domain registration, cloud hosting, email" },
    { name: "Software", slug: "software", type: "EXPENSE" as const, description: "SaaS tools and operational software licenses" },
    { name: "Travel", slug: "travel", type: "EXPENSE" as const, description: "Business travel, lodging, and conveyance" },
    { name: "Office Setup", slug: "office-setup", type: "EXPENSE" as const, description: "Furniture, hardware, and office readiness" },
    { name: "Equipment", slug: "equipment", type: "EXPENSE" as const, description: "Computers, printers, machinery" },
    { name: "Other Pre-Company Expense", slug: "other-pre-company-expense", type: "EXPENSE" as const, description: "Miscellaneous expenses prior to company bank opening" },
  ];

  let categoriesCreated = 0;
  for (const c of categoryDefs) {
    const existing = await Category.findOne({ name: c.name });
    if (!existing) {
      await Category.create(c);
      categoriesCreated++;
    }
  }
  console.log(`[Foxion Seed] Standard categories verified (${categoriesCreated} created).`);

  // 3. Initialize Standard E-Commerce Platforms
  const platformDefs = [
    { name: "Amazon", code: "AMZ", defaultCommissionPercentage: 15, color: "#f59e0b" },
    { name: "Meesho", code: "MSH", defaultCommissionPercentage: 5, color: "#ec4899" },
    { name: "Flipkart", code: "FLP", defaultCommissionPercentage: 14, color: "#3b82f6" },
    { name: "Direct", code: "DIR", defaultCommissionPercentage: 2, color: "#10b981" },
    { name: "Instagram", code: "INSTA", defaultCommissionPercentage: 0, color: "#8b5cf6" },
  ];

  let platformsCreated = 0;
  for (const p of platformDefs) {
    const existing = await Platform.findOne({ code: p.code });
    if (!existing) {
      await Platform.create(p);
      platformsCreated++;
    }
  }
  console.log(`[Foxion Seed] Standard platforms verified (${platformsCreated} created).`);

  console.log("====================================================");
  console.log("Foxion Essential System Configuration Initialized!");
  console.log("No dummy or operational records were created.");
  console.log(`Admin Login: ${adminEmail}`);
  console.log("Ready for real Foxion production data entry.");
  console.log("====================================================");

  return {
    success: true,
    message: "Essential system data seeded successfully without dummy business data.",
  };
}

// Support direct command line execution: npm run seed
if (require.main === module || process.argv[1]?.endsWith("seed.ts")) {
  runSeed()
    .then(() => {
      console.log("[Foxion Seed] Script finished successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Foxion Seed] Fatal error seeding database:", err);
      process.exit(1);
    });
}
