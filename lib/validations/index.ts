import { z } from "zod";

export const transactionSchema = z
  .object({
    accountType: z.enum(["MAIN", "ECOMMERCE"]),
    date: z.coerce.date(),
    description: z.string().min(1, "Description is required").trim(),
    category: z.string().min(1, "Category is required").trim(),
    debit: z.coerce.number().min(0, "Debit cannot be negative").default(0),
    credit: z.coerce.number().min(0, "Credit cannot be negative").default(0),
    paymentMode: z.string().min(1, "Payment mode is required").default("Bank Transfer"),
    bankOrCash: z.enum(["Bank", "Cash", "N/A"]).default("Bank"),
    partyName: z.string().optional().default(""),
    invoiceOrderId: z.string().optional().default(""),
    gstApplicable: z.boolean().default(false),
    gstAmount: z.coerce.number().min(0).default(0),
    tdsTcsAmount: z.coerce.number().min(0).default(0),
    remarks: z.string().optional().default(""),
    billAvailable: z.boolean().default(false),
    billId: z.string().optional(),
  })
  .refine((data) => data.debit > 0 || data.credit > 0, {
    message: "Either Debit or Credit must be greater than 0",
    path: ["debit"],
  });

export type TransactionFormData = z.infer<typeof transactionSchema>;

export const productSchema = z.object({
  name: z.string().min(1, "Product name is required").trim(),
  sku: z.string().min(1, "SKU is required").trim().toUpperCase(),
  category: z.string().min(1, "Category is required"),
  brand: z.string().trim().default("Foxion"),
  imageUrl: z.string().optional().default(""),
  purchasePrice: z.coerce.number().min(0, "Purchase price cannot be negative"),
  sellingPrice: z.coerce.number().min(0, "Selling price cannot be negative"),
  gstPercentage: z.coerce.number().min(0, "GST % cannot be negative").default(18),
  currentStock: z.coerce.number().min(0, "Stock cannot be negative").default(0),
  lowStockThreshold: z.coerce.number().min(0, "Threshold cannot be negative").default(10),
  description: z.string().optional().default(""),
  isActive: z.boolean().default(true),
});

export type ProductFormData = z.infer<typeof productSchema>;

export const categorySchema = z.object({
  name: z.string().min(1, "Category name is required").trim(),
  type: z.enum(["PRODUCT", "EXPENSE", "INCOME"]).default("PRODUCT"),
  description: z.string().optional().default(""),
  isActive: z.boolean().default(true),
});

export type CategoryFormData = z.infer<typeof categorySchema>;

export const purchaseItemSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  sku: z.string().min(1, "SKU is required"),
  productName: z.string().min(1, "Product name is required"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  purchasePrice: z.coerce.number().min(0, "Price cannot be negative"),
  gstRate: z.coerce.number().min(0).default(18),
  gstAmount: z.coerce.number().min(0).default(0),
  total: z.coerce.number().min(0),
});

export const purchaseSchema = z.object({
  supplierName: z.string().min(1, "Supplier name is required").trim(),
  supplierId: z.string().optional(),
  invoiceNumber: z.string().min(1, "Invoice number is required").trim(),
  date: z.coerce.date(),
  paymentMode: z.string().min(1, "Payment mode is required").default("Bank Transfer"),
  paymentStatus: z.enum(["PAID", "PENDING", "PARTIAL"]).default("PAID"),
  items: z.array(purchaseItemSchema).min(1, "At least one item is required"),
  remarks: z.string().optional().default(""),
});

export type PurchaseFormData = z.infer<typeof purchaseSchema>;

export const orderItemSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  sku: z.string().min(1, "SKU is required"),
  productName: z.string().min(1, "Product name is required"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  sellingPrice: z.coerce.number().min(0, "Price cannot be negative"),
  purchaseCost: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
  gstRate: z.coerce.number().min(0).default(18),
  gstAmount: z.coerce.number().min(0).default(0),
  total: z.coerce.number().min(0),
});

export const orderSchema = z.object({
  orderId: z.string().min(1, "Order ID is required").trim(),
  platform: z.string().min(1, "Platform is required").trim(),
  date: z.coerce.date(),
  customerName: z.string().min(1, "Customer name is required").trim(),
  customerPhone: z.string().optional().default(""),
  orderStatus: z.enum(["PENDING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"]).default("DELIVERED"),
  paymentStatus: z.enum(["PAID", "PENDING", "REFUNDED"]).default("PAID"),
  items: z.array(orderItemSchema).min(1, "At least one item is required"),
  shippingFee: z.coerce.number().min(0).default(0),
  marketplaceFee: z.coerce.number().min(0).default(0),
  packagingFee: z.coerce.number().min(0).default(0),
  remarks: z.string().optional().default(""),
});

export type OrderFormData = z.infer<typeof orderSchema>;

export const partySchema = z.object({
  name: z.string().min(1, "Name is required").trim(),
  type: z.enum(["CUSTOMER", "SUPPLIER", "MARKETPLACE", "OTHER"]).default("OTHER"),
  phone: z.string().optional().default(""),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().optional().default(""),
  gstin: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  isActive: z.boolean().default(true),
});

export type PartyFormData = z.infer<typeof partySchema>;

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address").trim().toLowerCase(),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginFormData = z.infer<typeof loginSchema>;
