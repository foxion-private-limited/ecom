import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPurchaseItem {
  productId: mongoose.Types.ObjectId;
  sku: string;
  productName: string;
  quantity: number;
  purchasePrice: number;
  gstRate: number;
  gstAmount: number;
  total: number;
}

export interface IPurchase extends Document {
  supplierId?: mongoose.Types.ObjectId;
  supplierName: string;
  invoiceNumber: string;
  date: Date;
  paymentMode: string;
  paymentStatus: "PAID" | "PENDING" | "PARTIAL";
  items: IPurchaseItem[];
  subtotal: number;
  totalGst: number;
  totalAmount: number;
  remarks?: string;
  billId?: mongoose.Types.ObjectId;
  transactionId?: mongoose.Types.ObjectId;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseItemSchema = new Schema<IPurchaseItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    sku: { type: String, required: true, trim: true, uppercase: true },
    productName: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    purchasePrice: { type: Number, required: true, min: 0 },
    gstRate: { type: Number, required: true, min: 0, default: 18 },
    gstAmount: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const PurchaseSchema = new Schema<IPurchase>(
  {
    supplierId: { type: Schema.Types.ObjectId, ref: "Party" },
    supplierName: { type: String, required: true, trim: true, index: true },
    invoiceNumber: { type: String, required: true, trim: true, index: true },
    date: { type: Date, required: true, default: Date.now, index: true },
    paymentMode: { type: String, required: true, default: "Bank Transfer" },
    paymentStatus: {
      type: String,
      enum: ["PAID", "PENDING", "PARTIAL"],
      default: "PAID",
    },
    items: { type: [PurchaseItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    totalGst: { type: Number, required: true, min: 0, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    remarks: { type: String, trim: true },
    billId: { type: Schema.Types.ObjectId, ref: "Bill" },
    transactionId: { type: Schema.Types.ObjectId, ref: "Transaction" },
    createdBy: { type: String, default: "System" },
  },
  { timestamps: true }
);

PurchaseSchema.index({ date: -1, supplierName: 1 });

export const Purchase: Model<IPurchase> =
  mongoose.models.Purchase ||
  mongoose.model<IPurchase>("Purchase", PurchaseSchema);
export default Purchase;
