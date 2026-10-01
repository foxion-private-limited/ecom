import { connectDB } from "@/lib/db/connection";
import { Transaction } from "@/lib/models/Transaction";
import { Order } from "@/lib/models/Order";
import { Purchase } from "@/lib/models/Purchase";
import { Product } from "@/lib/models/Product";
import { getDateRange, DateRangePreset } from "./dashboardService";

export interface ReportFilterOptions {
  preset?: DateRangePreset;
  startDate?: string | Date;
  endDate?: string | Date;
  category?: string;
  platform?: string;
  partyName?: string;
}

export async function getProfitAndLossReport(options: ReportFilterOptions = {}) {
  await connectDB();
  const { start, end } = getDateRange(options.preset, options.startDate, options.endDate);

  // Revenue from transactions + Orders
  const [revenueAgg, operatingDebitsAgg, ordersAgg] = await Promise.all([
    Transaction.aggregate([
      {
        $match: {
          isArchived: { $ne: true },
          date: { $gte: start, $lte: end },
          credit: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$credit" },
        },
      },
    ]),

    // Operating expenses from accounts
    Transaction.aggregate([
      {
        $match: {
          isArchived: { $ne: true },
          date: { $gte: start, $lte: end },
          debit: { $gt: 0 },
          category: { $ne: "Purchases / Inventory Inward" }, // Exclude COGS/stock purchases from operating expenses
        },
      },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$debit" },
        },
      },
      { $sort: { total: -1 } },
    ]),

    // Orders for direct COGS, Marketplace Fees, Shipping
    Order.aggregate([
      {
        $match: {
          date: { $gte: start, $lte: end },
          orderStatus: { $ne: "CANCELLED" },
        },
      },
      {
        $group: {
          _id: null,
          grossSales: { $sum: "$netAmount" },
          cogs: { $sum: "$estimatedCogs" },
          marketplaceFees: { $sum: "$marketplaceFee" },
          shippingFees: { $sum: "$shippingFee" },
          packagingFees: { $sum: "$packagingFee" },
          orderGrossProfit: { $sum: "$grossProfit" },
        },
      },
    ]),
  ]);

  const orderStats = ordersAgg[0] || {
    grossSales: 0,
    cogs: 0,
    marketplaceFees: 0,
    shippingFees: 0,
    packagingFees: 0,
    orderGrossProfit: 0,
  };

  const totalSalesRevenue =
    orderStats.grossSales > 0
      ? orderStats.grossSales
      : revenueAgg.reduce((acc, curr) => acc + curr.total, 0);

  const directCosts = orderStats.cogs + orderStats.marketplaceFees + orderStats.shippingFees + orderStats.packagingFees;
  const grossProfit = totalSalesRevenue - directCosts;

  const operatingExpenses = operatingDebitsAgg.map((item) => ({
    category: item._id,
    amount: item.total,
  }));
  const totalOperatingExpenses = operatingExpenses.reduce((acc, curr) => acc + curr.amount, 0);

  const netProfit = grossProfit - totalOperatingExpenses;
  const netProfitMargin = totalSalesRevenue > 0 ? (netProfit / totalSalesRevenue) * 100 : 0;

  return {
    period: { start, end },
    revenue: {
      totalSalesRevenue,
      breakdown: revenueAgg,
    },
    cogs: {
      productCost: orderStats.cogs,
      marketplaceFees: orderStats.marketplaceFees,
      shippingFees: orderStats.shippingFees,
      packagingFees: orderStats.packagingFees,
      totalDirectCosts: directCosts,
    },
    grossProfit,
    grossMargin: totalSalesRevenue > 0 ? (grossProfit / totalSalesRevenue) * 100 : 0,
    operatingExpenses,
    totalOperatingExpenses,
    netProfit,
    netProfitMargin,
  };
}

export async function getGSTReport(options: ReportFilterOptions = {}) {
  await connectDB();
  const { start, end } = getDateRange(options.preset, options.startDate, options.endDate);

  const [salesGstAgg, purchasesGstAgg, otherExpensesGstAgg] = await Promise.all([
    // GST collected on sales (Output GST)
    Transaction.aggregate([
      {
        $match: {
          gstApplicable: true,
          credit: { $gt: 0 },
          date: { $gte: start, $lte: end },
          isArchived: { $ne: true },
        },
      },
      {
        $group: {
          _id: null,
          totalSalesAmount: { $sum: "$credit" },
          totalOutputGst: { $sum: "$gstAmount" },
          count: { $sum: 1 },
        },
      },
    ]),

    // GST paid on purchases (Input Tax Credit)
    Purchase.aggregate([
      {
        $match: {
          date: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          totalPurchaseAmount: { $sum: "$totalAmount" },
          totalInputGst: { $sum: "$totalGst" },
          count: { $sum: 1 },
        },
      },
    ]),

    // GST paid on other main expenses
    Transaction.aggregate([
      {
        $match: {
          accountType: "MAIN",
          gstApplicable: true,
          debit: { $gt: 0 },
          category: { $ne: "Purchases / Inventory Inward" },
          date: { $gte: start, $lte: end },
          isArchived: { $ne: true },
        },
      },
      {
        $group: {
          _id: null,
          totalExpenseAmount: { $sum: "$debit" },
          totalExpenseGst: { $sum: "$gstAmount" },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const outputGst = salesGstAgg[0]?.totalOutputGst || 0;
  const inputPurchaseGst = purchasesGstAgg[0]?.totalInputGst || 0;
  const inputExpenseGst = otherExpensesGstAgg[0]?.totalExpenseGst || 0;
  const totalInputGst = inputPurchaseGst + inputExpenseGst;
  const netGstPayable = outputGst - totalInputGst;

  return {
    period: { start, end },
    outputGst: {
      salesAmount: salesGstAgg[0]?.totalSalesAmount || 0,
      gstAmount: outputGst,
      txCount: salesGstAgg[0]?.count || 0,
    },
    inputGst: {
      purchasesAmount: purchasesGstAgg[0]?.totalPurchaseAmount || 0,
      purchasesGst: inputPurchaseGst,
      expensesAmount: otherExpensesGstAgg[0]?.totalExpenseAmount || 0,
      expensesGst: inputExpenseGst,
      totalInputGst,
    },
    netGstPayable,
  };
}

export async function getCashFlowReport(options: ReportFilterOptions = {}) {
  await connectDB();
  const { start, end } = getDateRange(options.preset, options.startDate, options.endDate);

  const txs = await Transaction.find({
    date: { $gte: start, $lte: end },
    isArchived: { $ne: true },
    bankOrCash: { $in: ["Bank", "Cash"] },
    $or: [
      { transactionOrigin: { $ne: "PRE_COMPANY" } },
      { paymentSource: { $in: ["Company Bank", "Company Cash"] } },
    ],
  })
    .sort({ date: 1 })
    .lean();

  let bankInflow = 0;
  let bankOutflow = 0;
  let cashInflow = 0;
  let cashOutflow = 0;

  for (const t of txs) {
    if (t.bankOrCash === "Bank") {
      bankInflow += t.credit || 0;
      bankOutflow += t.debit || 0;
    } else if (t.bankOrCash === "Cash") {
      cashInflow += t.credit || 0;
      cashOutflow += t.debit || 0;
    }
  }

  return {
    period: { start, end },
    bank: {
      inflow: bankInflow,
      outflow: bankOutflow,
      net: bankInflow - bankOutflow,
    },
    cash: {
      inflow: cashInflow,
      outflow: cashOutflow,
      net: cashInflow - cashOutflow,
    },
    totalInflow: bankInflow + cashInflow,
    totalOutflow: bankOutflow + cashOutflow,
    netCashFlow: (bankInflow + cashInflow) - (bankOutflow + cashOutflow),
  };
}

export async function getEcommerceAnalyticsReport(options: ReportFilterOptions = {}) {
  await connectDB();
  const { start, end } = getDateRange(options.preset, options.startDate, options.endDate);

  const platformAgg = await Order.aggregate([
    {
      $match: {
        date: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: "$platform",
        orders: { $sum: 1 },
        deliveredOrders: {
          $sum: { $cond: [{ $eq: ["$orderStatus", "DELIVERED"] }, 1, 0] },
        },
        returnedOrders: {
          $sum: { $cond: [{ $eq: ["$orderStatus", "RETURNED"] }, 1, 0] },
        },
        revenue: { $sum: "$netAmount" },
        cogs: { $sum: "$estimatedCogs" },
        marketplaceFees: { $sum: "$marketplaceFee" },
        shippingFees: { $sum: "$shippingFee" },
        grossProfit: { $sum: "$grossProfit" },
      },
    },
    { $sort: { revenue: -1 } },
  ]);

  return {
    period: { start, end },
    platforms: platformAgg.map((p) => ({
      platform: p._id,
      orders: p.orders,
      deliveredOrders: p.deliveredOrders,
      returnedOrders: p.returnedOrders,
      returnRate: p.orders > 0 ? (p.returnedOrders / p.orders) * 100 : 0,
      revenue: p.revenue,
      cogs: p.cogs,
      marketplaceFees: p.marketplaceFees,
      shippingFees: p.shippingFees,
      grossProfit: p.grossProfit,
      margin: p.revenue > 0 ? (p.grossProfit / p.revenue) * 100 : 0,
    })),
  };
}

export async function getSalesReport(options: ReportFilterOptions = {}) {
  await connectDB();
  const { start, end } = getDateRange(options.preset, options.startDate, options.endDate);

  const query: Record<string, unknown> = {
    date: { $gte: start, $lte: end },
    orderStatus: { $ne: "CANCELLED" },
  };

  if (options.platform && options.platform !== "ALL") {
    query.platform = options.platform;
  }

  const orders = await Order.find(query).sort({ date: -1 }).lean();

  let totalSales = 0;
  let totalUnits = 0;
  let totalCogs = 0;
  let totalGrossProfit = 0;

  const tableRows = [];

  for (const o of orders) {
    totalSales += o.netAmount || 0;
    totalCogs += o.estimatedCogs || 0;
    totalGrossProfit += o.grossProfit || 0;

    for (const it of o.items) {
      totalUnits += it.quantity;
      tableRows.push({
        orderId: o.orderId,
        date: o.date,
        platform: o.platform,
        customerName: o.customerName,
        productName: it.productName,
        sku: it.sku,
        quantity: it.quantity,
        sellingPrice: it.sellingPrice,
        total: it.total,
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
      });
    }
  }

  return {
    period: { start, end },
    kpis: {
      totalSales,
      totalUnits,
      totalCogs,
      totalOrders: orders.length,
      averageOrderValue: orders.length > 0 ? Math.round(totalSales / orders.length) : 0,
      grossProfit: totalGrossProfit,
      margin: totalSales > 0 ? Math.round((totalGrossProfit / totalSales) * 100) : 0,
    },
    rows: tableRows,
  };
}

export async function getPurchasesReport(options: ReportFilterOptions = {}) {
  await connectDB();
  const { start, end } = getDateRange(options.preset, options.startDate, options.endDate);

  const query: Record<string, unknown> = {
    date: { $gte: start, $lte: end },
  };

  const purchases = await Purchase.find(query).sort({ date: -1 }).lean();

  let totalPurchasesAmount = 0;
  let totalInputGst = 0;
  let totalInwardUnits = 0;
  const suppliers = new Set<string>();

  const tableRows = [];

  for (const p of purchases) {
    totalPurchasesAmount += p.totalAmount || 0;
    totalInputGst += p.totalGst || 0;
    if (p.supplierName) suppliers.add(p.supplierName);

    for (const it of p.items) {
      totalInwardUnits += it.quantity;
      tableRows.push({
        invoiceNumber: p.invoiceNumber,
        date: p.date,
        supplierName: p.supplierName,
        productName: it.productName,
        sku: it.sku,
        quantity: it.quantity,
        purchasePrice: it.purchasePrice,
        gstRate: it.gstRate,
        gstAmount: it.gstAmount,
        total: it.total,
        paymentMode: p.paymentMode,
        paymentStatus: p.paymentStatus,
      });
    }
  }

  return {
    period: { start, end },
    kpis: {
      totalPurchasesAmount,
      totalInputGst,
      totalInwardUnits,
      uniqueSuppliers: suppliers.size,
    },
    rows: tableRows,
  };
}

export async function getExpensesReport(options: ReportFilterOptions = {}) {
  await connectDB();
  const { start, end } = getDateRange(options.preset, options.startDate, options.endDate);

  const match: Record<string, unknown> = {
    accountType: "MAIN",
    isArchived: { $ne: true },
    date: { $gte: start, $lte: end },
    debit: { $gt: 0 },
    category: { $ne: "Purchases / Inventory Inward" },
  };

  if (options.category && options.category !== "ALL") {
    match.category = options.category;
  }

  const [expensesAgg, rows] = await Promise.all([
    Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$debit" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]),
    Transaction.find(match).sort({ date: -1 }).lean(),
  ]);

  const totalExpense = rows.reduce((acc, r) => acc + (r.debit || 0), 0);
  const bankPaid = rows
    .filter((r) => r.bankOrCash === "Bank" || r.paymentSource === "Company Bank")
    .reduce((acc, r) => acc + (r.debit || 0), 0);
  const cashPaid = rows
    .filter((r) => r.bankOrCash === "Cash" || r.paymentSource === "Company Cash")
    .reduce((acc, r) => acc + (r.debit || 0), 0);
  const personalPaid = rows
    .filter(
      (r) =>
        r.bankOrCash === "Personal Bank" ||
        r.bankOrCash === "Personal Cash" ||
        r.paymentSource === "Personal Bank" ||
        r.paymentSource === "Personal Cash"
    )
    .reduce((acc, r) => acc + (r.debit || 0), 0);
  const preCompanyExpensesTotal = rows
    .filter((r) => r.transactionOrigin === "PRE_COMPANY")
    .reduce((acc, r) => acc + (r.debit || 0), 0);

  return {
    period: { start, end },
    kpis: {
      totalExpense,
      bankPaid,
      cashPaid,
      personalPaid,
      preCompanyExpensesTotal,
      topCategory: expensesAgg[0]?._id || "N/A",
      topCategoryAmount: expensesAgg[0]?.total || 0,
    },
    byCategory: expensesAgg.map((c) => ({
      category: c._id,
      amount: c.total,
      count: c.count,
      percentage: totalExpense > 0 ? Math.round((c.total / totalExpense) * 100) : 0,
    })),
    rows: rows.map((r) => ({
      date: r.date,
      description: r.description,
      category: r.category,
      amount: r.debit,
      paymentMode: r.paymentMode,
      bankOrCash: r.bankOrCash,
      paymentSource: r.paymentSource,
      paidBy: r.paidBy,
      transactionOrigin: r.transactionOrigin || "COMPANY",
      partyName: r.partyName,
      billAvailable: r.billAvailable,
    })),
  };
}

export async function getInventoryReport() {
  await connectDB();
  const products = await Product.find({ isActive: true }).populate("category", "name").lean();

  let totalValuation = 0;
  let totalStockUnits = 0;
  let lowStockCount = 0;
  let criticalCount = 0;

  const rows = products.map((p) => {
    const stock = p.currentStock || 0;
    const price = p.purchasePrice || 0;
    const val = stock * price;
    totalValuation += val;
    totalStockUnits += stock;

    let status: "GOOD" | "LOW" | "CRITICAL" | "OUT" = "GOOD";
    if (stock <= 0) {
      status = "OUT";
    } else if (stock <= 5) {
      status = "CRITICAL";
      criticalCount++;
    } else if (stock <= (p.lowStockThreshold || 10)) {
      status = "LOW";
      lowStockCount++;
    }

    return {
      id: p._id,
      name: p.name,
      sku: p.sku,
      category: (p.category as unknown as { name?: string })?.name || "General",
      purchasePrice: p.purchasePrice,
      sellingPrice: p.sellingPrice,
      currentStock: stock,
      threshold: p.lowStockThreshold || 10,
      valuation: val,
      status,
    };
  });

  return {
    kpis: {
      totalProducts: products.length,
      totalValuation,
      totalStockUnits,
      lowStockCount,
      criticalCount,
    },
    rows,
  };
}
