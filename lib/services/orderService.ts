import { connectDB } from "@/lib/db/connection";
import { Order, IOrder, IOrderItem } from "@/lib/models/Order";
import { Product } from "@/lib/models/Product";
import { Transaction } from "@/lib/models/Transaction";
import { Party } from "@/lib/models/Party";
import { recordStockMovement } from "./inventoryService";
import mongoose from "mongoose";

export interface OrderFilterOptions {
  platform?: string;
  orderStatus?: string;
  paymentStatus?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  search?: string;
  page?: number;
  limit?: number;
}

export async function createOrder(
  data: {
    orderId: string;
    platform: string;
    date: Date | string;
    customerName: string;
    customerPhone?: string;
    orderStatus?: "PENDING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "RETURNED";
    paymentStatus?: "PAID" | "PENDING" | "REFUNDED";
    items: {
      productId: string;
      sku: string;
      productName: string;
      quantity: number;
      sellingPrice: number;
      discount?: number;
      gstRate?: number;
      gstAmount?: number;
      total: number;
    }[];
    shippingFee?: number;
    marketplaceFee?: number;
    packagingFee?: number;
    remarks?: string;
  },
  userEmail: string = "System"
): Promise<IOrder> {
  await connectDB();

  // 1. Fetch current purchase price (cost) for each product to calculate COGS
  let subtotal = 0;
  let totalGst = 0;
  let estimatedCogs = 0;

  const orderItems: IOrderItem[] = [];

  for (const it of data.items) {
    const prod = await Product.findById(it.productId);
    const purchaseCost = prod?.purchasePrice || 0;
    const itemCogs = purchaseCost * it.quantity;
    estimatedCogs += itemCogs;

    const discount = it.discount || 0;
    const itemTotal = it.total || (it.sellingPrice * it.quantity - discount);
    const gstRate = it.gstRate || 18;
    const gstAmount = it.gstAmount || Math.round((itemTotal * gstRate) / (100 + gstRate));

    subtotal += itemTotal;
    totalGst += gstAmount;

    orderItems.push({
      productId: new mongoose.Types.ObjectId(it.productId),
      sku: it.sku,
      productName: it.productName,
      quantity: it.quantity,
      sellingPrice: it.sellingPrice,
      purchaseCost,
      discount,
      gstRate,
      gstAmount,
      total: itemTotal,
      isReturned: false,
    });
  }

  const shippingFee = data.shippingFee || 0;
  const marketplaceFee = data.marketplaceFee || 0;
  const packagingFee = data.packagingFee || 0;
  const netAmount = subtotal + shippingFee;
  const grossProfit = netAmount - estimatedCogs - marketplaceFee - shippingFee - packagingFee;

  // 2. Ensure Party exists for customer
  let customerPartyId: mongoose.Types.ObjectId | undefined;
  if (data.customerName) {
    let party = await Party.findOne({
      name: { $regex: new RegExp(`^${data.customerName.trim()}$`, "i") },
      type: "CUSTOMER",
    });
    if (!party) {
      party = await Party.create({
        name: data.customerName.trim(),
        phone: data.customerPhone,
        type: "CUSTOMER",
        isActive: true,
      });
    }
    customerPartyId = party._id as mongoose.Types.ObjectId;
  }

  // 3. Save Order
  const order = await Order.create({
    orderId: data.orderId.trim(),
    platform: data.platform.trim(),
    date: new Date(data.date),
    customerId: customerPartyId,
    customerName: data.customerName.trim(),
    customerPhone: data.customerPhone,
    orderStatus: data.orderStatus || "DELIVERED",
    paymentStatus: data.paymentStatus || "PAID",
    items: orderItems,
    subtotal,
    shippingFee,
    marketplaceFee,
    packagingFee,
    totalGst,
    netAmount,
    estimatedCogs,
    grossProfit,
    remarks: data.remarks,
    createdBy: userEmail,
  });

  // 4. For each item: deduct stock & record StockMovement
  for (const it of orderItems) {
    await recordStockMovement({
      productId: it.productId,
      type: "SALE",
      quantity: -it.quantity,
      referenceId: order.orderId,
      referenceType: "ORDER",
      remarks: `Sale on ${order.platform} - Order #${order.orderId}`,
      createdBy: userEmail,
    });
  }

  // 5. Create Ecommerce Accounting Transaction (Credit revenue)
  const isPaid = (data.paymentStatus || "PAID") === "PAID";
  const tx = await Transaction.create({
    accountType: "ECOMMERCE",
    date: new Date(data.date),
    description: `Ecommerce Sale: ${order.platform} Order #${order.orderId} (${orderItems.map((i) => `${i.productName} ×${i.quantity}`).join(", ")})`,
    category: `${order.platform} Sales`,
    debit: 0,
    credit: isPaid ? netAmount : 0,
    paymentMode: order.platform.toLowerCase().includes("direct") ? "UPI" : "Marketplace",
    bankOrCash: "Bank",
    partyName: order.customerName,
    invoiceOrderId: order.orderId,
    gstApplicable: totalGst > 0,
    gstAmount: totalGst,
    tdsTcsAmount: 0,
    remarks: `Order items total: ₹${subtotal}, Marketplace Fee: ₹${marketplaceFee}, Shipping: ₹${shippingFee}`,
    billAvailable: false,
    source: "ORDER",
    sourceId: order._id,
    createdBy: userEmail,
  });

  order.transactionId = tx._id as mongoose.Types.ObjectId;
  await order.save();

  return order;
}

export async function processOrderReturn(
  orderId: string,
  returnedProductIds: string[],
  remarks: string = "Product returned by customer",
  userEmail: string = "System"
): Promise<IOrder> {
  await connectDB();

  const order = await Order.findOne({
    $or: [{ orderId }, { _id: mongoose.Types.ObjectId.isValid(orderId) ? orderId : undefined }],
  });

  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  let totalRefundAmount = 0;

  for (const item of order.items) {
    const isTarget =
      returnedProductIds.length === 0 ||
      returnedProductIds.includes(item.productId.toString()) ||
      returnedProductIds.includes(item.sku);

    if (isTarget && !item.isReturned) {
      item.isReturned = true;
      totalRefundAmount += item.total;

      // Restore stock
      await recordStockMovement({
        productId: item.productId,
        type: "RETURN",
        quantity: item.quantity,
        referenceId: order.orderId,
        referenceType: "RETURN",
        remarks: `Customer return for Order #${order.orderId} (${order.platform})`,
        createdBy: userEmail,
      });
    }
  }

  order.orderStatus = "RETURNED";
  order.returnedAt = new Date();

  // Create Accounting refund adjustment transaction (Debit)
  if (totalRefundAmount > 0) {
    const refundTx = await Transaction.create({
      accountType: "ECOMMERCE",
      date: new Date(),
      description: `Return & Refund: Order #${order.orderId} (${order.platform})`,
      category: "Sales Returns / Refunds",
      debit: totalRefundAmount,
      credit: 0,
      paymentMode: "Marketplace",
      bankOrCash: "Bank",
      partyName: order.customerName,
      invoiceOrderId: order.orderId,
      gstApplicable: false,
      gstAmount: 0,
      tdsTcsAmount: 0,
      remarks: `Return processed. ${remarks}`,
      billAvailable: false,
      source: "ADJUSTMENT",
      sourceId: order._id,
      createdBy: userEmail,
    });

    order.returnTransactionId = refundTx._id as mongoose.Types.ObjectId;
  }

  await order.save();
  return order;
}

export async function getOrders(options: OrderFilterOptions = {}) {
  await connectDB();

  const {
    platform,
    orderStatus,
    paymentStatus,
    startDate,
    endDate,
    search,
    page = 1,
    limit = 50,
  } = options;

  const query: any = {};

  if (platform && platform !== "ALL") {
    query.platform = platform;
  }

  if (orderStatus && orderStatus !== "ALL") {
    query.orderStatus = orderStatus;
  }

  if (paymentStatus && paymentStatus !== "ALL") {
    query.paymentStatus = paymentStatus;
  }

  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.date.$lte = end;
    }
  }

  if (search) {
    query.$or = [
      { orderId: { $regex: search, $options: "i" } },
      { customerName: { $regex: search, $options: "i" } },
      { platform: { $regex: search, $options: "i" } },
      { "items.productName": { $regex: search, $options: "i" } },
      { "items.sku": { $regex: search, $options: "i" } },
    ];
  }

  const total = await Order.countDocuments(query);
  const skip = (page - 1) * limit;

  const orders = await Order.find(query)
    .sort({ date: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return {
    orders,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getOrderById(id: string) {
  await connectDB();
  return Order.findById(id).populate("customerId").lean();
}
