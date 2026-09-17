import mongoose, { Schema, Document, Model } from "mongoose";

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  sku: string;
  productName: string;
  quantity: number;
  sellingPrice: number;
  purchaseCost: number;
  discount: number;
  gstRate: number;
  gstAmount: number;
  total: number;
  isReturned?: boolean;
}

export interface IOrder extends Document {
  orderId: string;
  platform: string;
  date: Date;
  customerId?: mongoose.Types.ObjectId;
  customerName: string;
  customerPhone?: string;
  orderStatus: "PENDING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "RETURNED";
  paymentStatus: "PAID" | "PENDING" | "REFUNDED";
  items: IOrderItem[];
  subtotal: number;
  shippingFee: number;
  marketplaceFee: number;
  packagingFee: number;
  totalGst: number;
  netAmount: number;
  estimatedCogs: number;
  grossProfit: number;
  remarks?: string;
  transactionId?: mongoose.Types.ObjectId;
  returnTransactionId?: mongoose.Types.ObjectId;
  returnedAt?: Date;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    sku: { type: String, required: true, trim: true, uppercase: true },
    productName: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    sellingPrice: { type: Number, required: true, min: 0 },
    purchaseCost: { type: Number, required: true, min: 0, default: 0 },
    discount: { type: Number, default: 0, min: 0 },
    gstRate: { type: Number, default: 18, min: 0 },
    gstAmount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    isReturned: { type: Boolean, default: false },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    platform: { type: String, required: true, trim: true, index: true },
    date: { type: Date, required: true, default: Date.now, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Party" },
    customerName: { type: String, required: true, trim: true, index: true },
    customerPhone: { type: String, trim: true },
    orderStatus: {
      type: String,
      enum: ["PENDING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"],
      default: "DELIVERED",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ["PAID", "PENDING", "REFUNDED"],
      default: "PAID",
      index: true,
    },
    items: { type: [OrderItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    shippingFee: { type: Number, default: 0, min: 0 },
    marketplaceFee: { type: Number, default: 0, min: 0 },
    packagingFee: { type: Number, default: 0, min: 0 },
    totalGst: { type: Number, default: 0, min: 0 },
    netAmount: { type: Number, required: true, min: 0 },
    estimatedCogs: { type: Number, default: 0, min: 0 },
    grossProfit: { type: Number, default: 0 },
    remarks: { type: String, trim: true },
    transactionId: { type: Schema.Types.ObjectId, ref: "Transaction" },
    returnTransactionId: { type: Schema.Types.ObjectId, ref: "Transaction" },
    returnedAt: { type: Date },
    createdBy: { type: String, default: "System" },
  },
  { timestamps: true }
);

OrderSchema.index({ platform: 1, date: -1 });
OrderSchema.index({ orderStatus: 1, date: -1 });

export const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>("Order", OrderSchema);
export default Order;
