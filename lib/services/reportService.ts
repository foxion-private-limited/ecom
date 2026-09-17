import { connectDB } from "@/lib/db/connection";
import { Transaction, AccountType } from "@/lib/models/Transaction";
import { Order } from "@/lib/models/Order";
import { Purchase } from "@/lib/models/Purchase";
import { Product } from "@/lib/models/Product";
import { StockMovement } from "@/lib/models/StockMovement";
import { getDateRange, DateRangePreset } from "./dashboardService";

export interface ReportFilterOptions {
  preset?: DateRangePreset;
  startDate?: string | Date;
  endDate?: string | Date;
  accountType?: AccountType | "ALL";
  category?: string;
  platform?: string;
  partyName?: string;
}

export async function getProfitAndLossReport(options: ReportFilterOptions = {}) {
  await connectDB();
  const { start, end } = getDateRange(options.preset, options.startDate, options.endDate);

  // Revenue from Ecommerce transactions + Orders
  const [ecommerceRevenueAgg, mainDebitsAgg, ordersAgg] = await Promise.all([
    Transaction.aggregate([
      {
        $match: {
          accountType: "ECOMMERCE",
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

    // Operating expenses from Main account
    Transaction.aggregate([
      {
        $match: {
          accountType: "MAIN",
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
      : ecommerceRevenueAgg.reduce((acc, curr) => acc + curr.total, 0);

  const directCosts = orderStats.cogs + orderStats.marketplaceFees + orderStats.shippingFees + orderStats.packagingFees;
  const grossProfit = totalSalesRevenue - directCosts;

  const operatingExpenses = mainDebitsAgg.map((item) => ({
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
      breakdown: ecommerceRevenueAgg,
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
