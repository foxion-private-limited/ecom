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
  console.log("[Foxion Seed] Connecting to database...");
  await connectDB();

  if (options.clearDummyData) {
    console.log("[Foxion Seed] Purging existing records to ensure clean development seed...");
    await Promise.all([
      Order.deleteMany({}),
      Purchase.deleteMany({}),
      Transaction.deleteMany({}),
      StockMovement.deleteMany({}),
      Product.deleteMany({}),
      Party.deleteMany({}),
      Bill.deleteMany({}),
      ImportBatch.deleteMany({}),
      Category.deleteMany({}),
      Platform.deleteMany({}),
    ]);
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
    console.log(`[Foxion Seed] Admin account initialized: ${adminEmail}`);
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

  const categoryMap = new Map<string, mongoose.Types.ObjectId>();
  for (const c of categoryDefs) {
    let cat = await Category.findOne({ name: c.name });
    if (!cat) {
      cat = await Category.create(c);
    }
    categoryMap.set(c.name, cat._id as mongoose.Types.ObjectId);
  }
  console.log("[Foxion Seed] Categories initialized.");

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
  console.log("[Foxion Seed] Platforms initialized.");

  // 4. Initialize Standard Parties (Suppliers & Customers)
  const supplierParty = await Party.create({
    name: "Apex Tech Supplies Ltd",
    type: "SUPPLIER",
    email: "orders@apextech.in",
    phone: "+91 98765 43210",
    address: "Bhiwandi Warehousing Hub, Maharashtra",
    gstin: "27AABCA1234A1Z5",
    isActive: true,
  });

  const customer1 = await Party.create({
    name: "Rahul Sharma",
    type: "CUSTOMER",
    phone: "+91 98111 22334",
    address: "New Delhi",
    isActive: true,
  });

  const customer2 = await Party.create({
    name: "Priya Patel",
    type: "CUSTOMER",
    phone: "+91 98222 33445",
    address: "Ahmedabad, Gujarat",
    isActive: true,
  });

  // 5. Initialize Foxion Required Dynamic Products (Requirement 71)
  const lighter = await Product.create({
    name: "Everyday Rechargeable Gas Lighter",
    sku: "FOX-GL-001",
    category: categoryMap.get("Kitchen"),
    brand: "Foxion",
    purchasePrice: 120,
    sellingPrice: 199,
    gstPercentage: 18,
    currentStock: 129,
    lowStockThreshold: 15,
    description: "USB Type-C rechargeable flameless electronic candle and gas stove lighter.",
    isActive: true,
  });

  const speaker = await Product.create({
    name: "Bluetooth Speaker",
    sku: "FOX-SP-001",
    category: categoryMap.get("Electronics"),
    brand: "Foxion",
    purchasePrice: 500,
    sellingPrice: 899,
    gstPercentage: 18,
    currentStock: 34,
    lowStockThreshold: 10,
    description: "Portable 10W wireless outdoor waterproof bass speaker.",
    isActive: true,
  });

  const chopper = await Product.create({
    name: "Kitchen Chopper",
    sku: "FOX-CH-001",
    category: categoryMap.get("Kitchen"),
    brand: "Foxion",
    purchasePrice: 200,
    sellingPrice: 349,
    gstPercentage: 12,
    currentStock: 4, // Critical stock alert on dashboard (< 5 units)
    lowStockThreshold: 10,
    description: "Manual handy pull-string quick kitchen vegetable and fruit chopper.",
    isActive: true,
  });

  console.log("[Foxion Seed] Standard products initialized (Gas Lighter, Bluetooth Speaker, Kitchen Chopper).");

  // 6. Record Initial Inward Purchases
  const purchase1 = await Purchase.create({
    supplierId: supplierParty._id,
    supplierName: supplierParty.name,
    invoiceNumber: "INV-2026-081",
    date: new Date("2026-09-01T10:00:00.000Z"),
    paymentMode: "Bank Transfer",
    paymentStatus: "PAID",
    items: [
      {
        productId: lighter._id,
        sku: lighter.sku,
        productName: lighter.name,
        quantity: 150,
        purchasePrice: 120,
        gstRate: 18,
        gstAmount: 3240,
        total: 21240,
      },
      {
        productId: speaker._id,
        sku: speaker.sku,
        productName: speaker.name,
        quantity: 40,
        purchasePrice: 500,
        gstRate: 18,
        gstAmount: 3600,
        total: 23600,
      },
      {
        productId: chopper._id,
        sku: chopper.sku,
        productName: chopper.name,
        quantity: 20,
        purchasePrice: 200,
        gstRate: 12,
        gstAmount: 480,
        total: 4480,
      },
    ],
    subtotal: 42000,
    totalGst: 7320,
    totalAmount: 49320,
    remarks: "Bulk inward inventory batch shipment",
    createdBy: "admin@foxion.in",
  });

  // Stock movements for Purchase
  await StockMovement.create([
    {
      productId: lighter._id,
      type: "PURCHASE",
      quantity: 150,
      previousStock: 0,
      newStock: 150,
      referenceId: purchase1.invoiceNumber,
      referenceType: "PURCHASE",
      date: new Date("2026-09-01T10:00:00.000Z"),
      remarks: "Inward shipment from Apex Tech Supplies",
      createdBy: "admin@foxion.in",
    },
    {
      productId: speaker._id,
      type: "PURCHASE",
      quantity: 40,
      previousStock: 0,
      newStock: 40,
      referenceId: purchase1.invoiceNumber,
      referenceType: "PURCHASE",
      date: new Date("2026-09-01T10:00:00.000Z"),
      remarks: "Inward shipment from Apex Tech Supplies",
      createdBy: "admin@foxion.in",
    },
    {
      productId: chopper._id,
      type: "PURCHASE",
      quantity: 20,
      previousStock: 0,
      newStock: 20,
      referenceId: purchase1.invoiceNumber,
      referenceType: "PURCHASE",
      date: new Date("2026-09-01T10:00:00.000Z"),
      remarks: "Inward shipment from Apex Tech Supplies",
      createdBy: "admin@foxion.in",
    },
  ]);

  // Main Accounting debit for purchase
  const purchaseTx = await Transaction.create({
    accountType: "MAIN",
    date: new Date("2026-09-01T10:00:00.000Z"),
    description: "Purchase of Stock: Gas Lighters (150), Speakers (40), Choppers (20)",
    category: "Purchases / Inventory Inward",
    debit: 49320,
    credit: 0,
    paymentMode: "Bank Transfer",
    bankOrCash: "Bank",
    partyName: supplierParty.name,
    invoiceOrderId: purchase1.invoiceNumber,
    gstApplicable: true,
    gstAmount: 7320,
    tdsTcsAmount: 0,
    remarks: "Bank NEFT to Apex Tech Supplies Ltd",
    billAvailable: true,
    source: "PURCHASE",
    sourceId: purchase1._id,
    createdBy: "admin@foxion.in",
  });

  purchase1.transactionId = purchaseTx._id as mongoose.Types.ObjectId;
  await purchase1.save();

  // 7. Initial E-Commerce Orders & Sales
  const order1 = await Order.create({
    orderId: "AMZ-89101",
    platform: "Amazon",
    date: new Date("2026-09-05T14:30:00.000Z"),
    customerId: customer1._id,
    customerName: customer1.name,
    customerPhone: customer1.phone,
    orderStatus: "DELIVERED",
    paymentStatus: "PAID",
    items: [
      {
        productId: lighter._id,
        sku: lighter.sku,
        productName: lighter.name,
        quantity: 12,
        sellingPrice: 199,
        purchaseCost: 120,
        discount: 0,
        gstRate: 18,
        gstAmount: 364,
        total: 2388,
        isReturned: false,
      },
    ],
    subtotal: 2388,
    shippingFee: 0,
    marketplaceFee: 358,
    packagingFee: 60,
    totalGst: 364,
    netAmount: 2388,
    estimatedCogs: 1440,
    grossProfit: 530,
    remarks: "Amazon Prime Fast Dispatch",
    createdBy: "admin@foxion.in",
  });

  await StockMovement.create({
    productId: lighter._id,
    type: "SALE",
    quantity: -12,
    previousStock: 150,
    newStock: 138,
    referenceId: order1.orderId,
    referenceType: "ORDER",
    date: new Date("2026-09-05T14:30:00.000Z"),
    remarks: "Amazon Sale - Order #AMZ-89101",
    createdBy: "admin@foxion.in",
  });

  const order2 = await Order.create({
    orderId: "MSH-44122",
    platform: "Meesho",
    date: new Date("2026-09-08T11:20:00.000Z"),
    customerId: customer2._id,
    customerName: customer2.name,
    customerPhone: customer2.phone,
    orderStatus: "DELIVERED",
    paymentStatus: "PAID",
    items: [
      {
        productId: lighter._id,
        sku: lighter.sku,
        productName: lighter.name,
        quantity: 8,
        sellingPrice: 199,
        purchaseCost: 120,
        discount: 0,
        gstRate: 18,
        gstAmount: 243,
        total: 1592,
        isReturned: false,
      },
      {
        productId: chopper._id,
        sku: chopper.sku,
        productName: chopper.name,
        quantity: 16,
        sellingPrice: 349,
        purchaseCost: 200,
        discount: 0,
        gstRate: 12,
        gstAmount: 598,
        total: 5584,
        isReturned: false,
      },
    ],
    subtotal: 7176,
    shippingFee: 0,
    marketplaceFee: 350,
    packagingFee: 120,
    totalGst: 841,
    netAmount: 7176,
    estimatedCogs: 4160,
    grossProfit: 2546,
    remarks: "Meesho Festival Order Dispatch",
    createdBy: "admin@foxion.in",
  });

  await StockMovement.create([
    {
      productId: lighter._id,
      type: "SALE",
      quantity: -8,
      previousStock: 138,
      newStock: 130,
      referenceId: order2.orderId,
      referenceType: "ORDER",
      date: new Date("2026-09-08T11:20:00.000Z"),
      remarks: "Meesho Sale - Order #MSH-44122",
      createdBy: "admin@foxion.in",
    },
    {
      productId: chopper._id,
      type: "SALE",
      quantity: -16,
      previousStock: 20,
      newStock: 4,
      referenceId: order2.orderId,
      referenceType: "ORDER",
      date: new Date("2026-09-08T11:20:00.000Z"),
      remarks: "Meesho Sale - Order #MSH-44122",
      createdBy: "admin@foxion.in",
    },
  ]);

  const order3 = await Order.create({
    orderId: "FLP-33091",
    platform: "Flipkart",
    date: new Date("2026-09-12T16:45:00.000Z"),
    customerName: "Amit Verma",
    orderStatus: "DELIVERED",
    paymentStatus: "PAID",
    items: [
      {
        productId: speaker._id,
        sku: speaker.sku,
        productName: speaker.name,
        quantity: 6,
        sellingPrice: 899,
        purchaseCost: 500,
        discount: 0,
        gstRate: 18,
        gstAmount: 823,
        total: 5394,
        isReturned: false,
      },
    ],
    subtotal: 5394,
    shippingFee: 0,
    marketplaceFee: 755,
    packagingFee: 60,
    totalGst: 823,
    netAmount: 5394,
    estimatedCogs: 3000,
    grossProfit: 1579,
    remarks: "Flipkart BBD Sale Dispatch",
    createdBy: "admin@foxion.in",
  });

  await StockMovement.create({
    productId: speaker._id,
    type: "SALE",
    quantity: -6,
    previousStock: 40,
    newStock: 34,
    referenceId: order3.orderId,
    referenceType: "ORDER",
    date: new Date("2026-09-12T16:45:00.000Z"),
    remarks: "Flipkart Sale - Order #FLP-33091",
    createdBy: "admin@foxion.in",
  });

  // Return +1 lighter movement (demonstrating customer return history)
  await StockMovement.create({
    productId: lighter._id,
    type: "RETURN",
    quantity: 1,
    previousStock: 130,
    newStock: 129,
    referenceId: "AMZ-89101",
    referenceType: "RETURN",
    date: new Date("2026-09-15T09:15:00.000Z"),
    remarks: "Customer return replacement credit",
    createdBy: "admin@foxion.in",
  });

  // 8. General Main & Ecommerce Accounting Transactions
  const sampleTransactions = [
    // Main Accounts
    {
      accountType: "MAIN" as const,
      date: new Date("2026-09-01T09:00:00.000Z"),
      description: "Opening Bank Capital Deposit",
      category: "Other Income / Capital",
      debit: 0,
      credit: 250000,
      paymentMode: "Bank Transfer",
      bankOrCash: "Bank" as const,
      partyName: "Foxion Directors",
      invoiceOrderId: "CAP-001",
      gstApplicable: false,
      gstAmount: 0,
      tdsTcsAmount: 0,
      remarks: "Initial business capital infusion",
      billAvailable: false,
      createdBy: "admin@foxion.in",
    },
    {
      accountType: "MAIN" as const,
      date: new Date("2026-09-03T11:00:00.000Z"),
      description: "Warehouse & Office Rent (September 2026)",
      category: "Office Expenses",
      debit: 25000,
      credit: 0,
      paymentMode: "Bank Transfer",
      bankOrCash: "Bank" as const,
      partyName: "Sunrise Commercial Properties",
      invoiceOrderId: "RENT-SEP-26",
      gstApplicable: true,
      gstAmount: 4500,
      tdsTcsAmount: 2500,
      remarks: "TDS @ 10% deducted",
      billAvailable: true,
      createdBy: "admin@foxion.in",
    },
    {
      accountType: "MAIN" as const,
      date: new Date("2026-09-04T15:30:00.000Z"),
      description: "Office Electricity Bill",
      category: "Office Expenses",
      debit: 3200,
      credit: 0,
      paymentMode: "UPI",
      bankOrCash: "Bank" as const,
      partyName: "Adani Electricity Mumbai",
      invoiceOrderId: "MSEB-9981",
      gstApplicable: false,
      gstAmount: 0,
      tdsTcsAmount: 0,
      remarks: "Online Bill Payment via UPI",
      billAvailable: true,
      createdBy: "admin@foxion.in",
    },
    {
      accountType: "MAIN" as const,
      date: new Date("2026-09-07T12:00:00.000Z"),
      description: "Warehouse Labor & Packaging Wages",
      category: "Salaries & Wages",
      debit: 18000,
      credit: 0,
      paymentMode: "Cash",
      bankOrCash: "Cash" as const,
      partyName: "Contract Staff",
      invoiceOrderId: "WAGE-W1",
      gstApplicable: false,
      gstAmount: 0,
      tdsTcsAmount: 0,
      remarks: "Cash drawer withdrawal for weekly wages",
      billAvailable: false,
      createdBy: "admin@foxion.in",
    },
    {
      accountType: "MAIN" as const,
      date: new Date("2026-09-10T14:15:00.000Z"),
      description: "Meta & Google Ads Campaign",
      category: "Advertising & Marketing",
      debit: 12500,
      credit: 0,
      paymentMode: "Card",
      bankOrCash: "Bank" as const,
      partyName: "Meta Platforms Ireland",
      invoiceOrderId: "FB-ADS-772",
      gstApplicable: true,
      gstAmount: 2250,
      tdsTcsAmount: 0,
      remarks: "Product PPC advertising campaign",
      billAvailable: true,
      createdBy: "admin@foxion.in",
    },
    // Ecommerce Accounts
    {
      accountType: "ECOMMERCE" as const,
      date: new Date("2026-09-06T10:00:00.000Z"),
      description: "Amazon Order Sales Batch #AMZ-89101",
      category: "Amazon Sales",
      debit: 0,
      credit: 2388,
      paymentMode: "Marketplace",
      bankOrCash: "Bank" as const,
      partyName: "Amazon India Seller Services",
      invoiceOrderId: "AMZ-89101",
      gstApplicable: true,
      gstAmount: 364,
      tdsTcsAmount: 24,
      remarks: "Amazon FBA settlement",
      billAvailable: false,
      createdBy: "admin@foxion.in",
    },
    {
      accountType: "ECOMMERCE" as const,
      date: new Date("2026-09-09T10:00:00.000Z"),
      description: "Meesho Order Sales Batch #MSH-44122",
      category: "Meesho Sales",
      debit: 0,
      credit: 7176,
      paymentMode: "Marketplace",
      bankOrCash: "Bank" as const,
      partyName: "Meesho Payments",
      invoiceOrderId: "MSH-44122",
      gstApplicable: true,
      gstAmount: 841,
      tdsTcsAmount: 72,
      remarks: "Meesho weekly payout",
      billAvailable: false,
      createdBy: "admin@foxion.in",
    },
    {
      accountType: "ECOMMERCE" as const,
      date: new Date("2026-09-13T10:00:00.000Z"),
      description: "Flipkart Order Sales Batch #FLP-33091",
      category: "Flipkart Sales",
      debit: 0,
      credit: 5394,
      paymentMode: "Marketplace",
      bankOrCash: "Bank" as const,
      partyName: "Flipkart Internet Pvt Ltd",
      invoiceOrderId: "FLP-33091",
      gstApplicable: true,
      gstAmount: 823,
      tdsTcsAmount: 54,
      remarks: "Flipkart automated payout",
      billAvailable: false,
      createdBy: "admin@foxion.in",
    },
    {
      accountType: "ECOMMERCE" as const,
      date: new Date("2026-09-14T17:00:00.000Z"),
      description: "Courier Shipping & Packaging Charges",
      category: "Logistics & Packaging",
      debit: 4800,
      credit: 0,
      paymentMode: "Bank Transfer",
      bankOrCash: "Bank" as const,
      partyName: "Delhivery Logistics",
      invoiceOrderId: "DLV-9901",
      gstApplicable: true,
      gstAmount: 732,
      tdsTcsAmount: 0,
      remarks: "B2C courier forward shipment freight",
      billAvailable: true,
      createdBy: "admin@foxion.in",
    },
  ];

  await Transaction.insertMany(sampleTransactions);
  console.log(`[Foxion Seed] Created ${sampleTransactions.length + 1} sample transactions.`);

  console.log("====================================================");
  console.log("Foxion Business Suite seed initialization COMPLETED!");
  console.log("Admin Login: admin@foxion.in / admin123456");
  console.log("Products: Everyday Rechargeable Gas Lighter, Bluetooth Speaker, Kitchen Chopper");
  console.log("====================================================");

  return {
    success: true,
    message: "Foxion database successfully seeded with standard catalog and live business transactions",
  };
}

// Support direct command line execution: npx tsx scripts/seed.ts
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
