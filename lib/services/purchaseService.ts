import { connectDB } from "@/lib/db/connection";
import { Purchase, IPurchase } from "@/lib/models/Purchase";
import { Product } from "@/lib/models/Product";
import { Party } from "@/lib/models/Party";
import { Transaction } from "@/lib/models/Transaction";
import { recordStockMovement } from "./inventoryService";
import mongoose from "mongoose";

export interface PurchaseFilterOptions {
  startDate?: Date | string;
  endDate?: Date | string;
  supplierName?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export async function createPurchase(
  data: {
    supplierName: string;
    supplierId?: string;
    invoiceNumber: string;
    date: Date | string;
    paymentMode: string;
    paymentStatus?: "PAID" | "PENDING" | "PARTIAL";
    items: {
      productId: string;
      sku: string;
      productName: string;
      quantity: number;
      purchasePrice: number;
      gstRate: number;
      gstAmount: number;
      total: number;
    }[];
    remarks?: string;
    billId?: string;
  },
  userEmail: string = "System"
): Promise<IPurchase> {
  await connectDB();

  // 1. Calculate totals
  let subtotal = 0;
  let totalGst = 0;
  let totalAmount = 0;

  for (const it of data.items) {
    subtotal += it.purchasePrice * it.quantity;
    totalGst += it.gstAmount;
    totalAmount += it.total;
  }

  // Ensure Party exists or update supplier
  let supplierPartyId: mongoose.Types.ObjectId | undefined;
  if (data.supplierName) {
    let party = await Party.findOne({
      name: { $regex: new RegExp(`^${data.supplierName.trim()}$`, "i") },
      type: "SUPPLIER",
    });
    if (!party) {
      party = await Party.create({
        name: data.supplierName.trim(),
        type: "SUPPLIER",
        isActive: true,
      });
    }
    supplierPartyId = party._id as mongoose.Types.ObjectId;
  }

  // 2. Create Purchase record
  const purchase = await Purchase.create({
    supplierId: supplierPartyId,
    supplierName: data.supplierName.trim(),
    invoiceNumber: data.invoiceNumber.trim(),
    date: new Date(data.date),
    paymentMode: data.paymentMode || "Bank Transfer",
    paymentStatus: data.paymentStatus || "PAID",
    items: data.items.map((i) => ({
      productId: new mongoose.Types.ObjectId(i.productId),
      sku: i.sku,
      productName: i.productName,
      quantity: i.quantity,
      purchasePrice: i.purchasePrice,
      gstRate: i.gstRate,
      gstAmount: i.gstAmount,
      total: i.total,
    })),
    subtotal,
    totalGst,
    totalAmount,
    remarks: data.remarks,
    billId: data.billId ? new mongoose.Types.ObjectId(data.billId) : undefined,
    createdBy: userEmail,
  });

  // 3. For each item: increment inventory & record StockMovement
  for (const it of data.items) {
    await recordStockMovement({
      productId: it.productId,
      type: "PURCHASE",
      quantity: it.quantity,
      referenceId: purchase.invoiceNumber,
      referenceType: "PURCHASE",
      remarks: `Inward Purchase #${purchase.invoiceNumber} from ${purchase.supplierName}`,
      createdBy: userEmail,
    });
  }

  // 4. Create Main Accounting Transaction (Debit)
  const isPaid = (data.paymentStatus || "PAID") === "PAID";
  const tx = await Transaction.create({
    accountType: "MAIN",
    date: new Date(data.date),
    description: `Purchase: ${data.items.map((i) => `${i.productName} (${i.quantity})`).join(", ")}`,
    category: "Purchases / Inventory Inward",
    debit: isPaid ? totalAmount : 0, // If paid, record debit; if credit purchase, recorded when paid
    credit: 0,
    paymentMode: data.paymentMode || "Bank Transfer",
    bankOrCash: (data.paymentMode || "").toLowerCase().includes("cash") ? "Cash" : "Bank",
    partyName: data.supplierName,
    invoiceOrderId: data.invoiceNumber,
    gstApplicable: totalGst > 0,
    gstAmount: totalGst,
    tdsTcsAmount: 0,
    remarks: `Linked to Purchase #${purchase.invoiceNumber}. ${data.remarks || ""}`.trim(),
    billAvailable: !!data.billId,
    billId: data.billId ? new mongoose.Types.ObjectId(data.billId) : undefined,
    source: "PURCHASE",
    sourceId: purchase._id,
    createdBy: userEmail,
  });

  // Cross-link
  purchase.transactionId = tx._id as mongoose.Types.ObjectId;
  await purchase.save();

  return purchase;
}

export async function getPurchases(options: PurchaseFilterOptions = {}) {
  await connectDB();

  const {
    startDate,
    endDate,
    supplierName,
    search,
    page = 1,
    limit = 50,
  } = options;

  const query: any = {};

  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.date.$lte = end;
    }
  }

  if (supplierName) {
    query.supplierName = { $regex: supplierName, $options: "i" };
  }

  if (search) {
    query.$or = [
      { invoiceNumber: { $regex: search, $options: "i" } },
      { supplierName: { $regex: search, $options: "i" } },
      { "items.productName": { $regex: search, $options: "i" } },
      { "items.sku": { $regex: search, $options: "i" } },
    ];
  }

  const total = await Purchase.countDocuments(query);
  const skip = (page - 1) * limit;

  const purchases = await Purchase.find(query)
    .sort({ date: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return {
    purchases,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getPurchaseById(id: string) {
  await connectDB();
  return Purchase.findById(id).populate("supplierId").lean();
}
