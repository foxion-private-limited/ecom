import { connectDB } from "@/lib/db/connection";
import { Transaction, AccountType } from "@/lib/models/Transaction";
import { Product } from "@/lib/models/Product";
import { Order } from "@/lib/models/Order";
import { Category } from "@/lib/models/Category";
import { subDays, subMonths, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";

export type DateRangePreset =
  | "TODAY"
  | "THIS_WEEK"
  | "THIS_MONTH"
  | "LAST_MONTH"
  | "THIS_YEAR"
  | "CUSTOM";

export interface DashboardFilterOptions {
  preset?: DateRangePreset;
  startDate?: string | Date;
  endDate?: string | Date;
  accountType?: AccountType | "ALL";
}

export function getDateRange(
  preset: DateRangePreset = "THIS_MONTH",
  customStart?: string | Date,
  customEnd?: string | Date
): { start: Date; end: Date; prevStart: Date; prevEnd: Date } {
  const now = new Date();
  let start: Date;
  let end: Date;

  switch (preset) {
    case "TODAY":
      start = startOfDay(now);
      end = endOfDay(now);
      break;
    case "THIS_WEEK":
      start = startOfWeek(now, { weekStartsOn: 1 });
      end = endOfWeek(now, { weekStartsOn: 1 });
      break;
    case "LAST_MONTH": {
      const lastMonthDate = subMonths(now, 1);
      start = startOfMonth(lastMonthDate);
      end = endOfMonth(lastMonthDate);
      break;
    }
    case "THIS_YEAR":
      start = startOfYear(now);
      end = endOfYear(now);
      break;
    case "CUSTOM":
      start = customStart ? new Date(customStart) : startOfMonth(now);
      end = customEnd ? new Date(customEnd) : endOfDay(now);
      break;
    case "THIS_MONTH":
    default:
      start = startOfMonth(now);
      end = endOfMonth(now);
      break;
  }

  // Calculate duration to get equivalent previous period
  const durationMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);

  return { start, end, prevStart, prevEnd };
}

export async function getDashboardData(options: DashboardFilterOptions = {}) {
  await connectDB();

  const { preset = "THIS_MONTH", startDate, endDate, accountType = "ALL" } = options;
  const { start, end, prevStart, prevEnd } = getDateRange(preset, startDate, endDate);
  const now = new Date();

  // 1. Transactions match for current period
  const currentTxMatch: any = {
    isArchived: { $ne: true },
    date: { $gte: start, $lte: end },
  };
  if (accountType !== "ALL") {
    currentTxMatch.accountType = accountType;
  }

  // 2. Transactions match for previous period
  const prevTxMatch: any = {
    isArchived: { $ne: true },
    date: { $gte: prevStart, $lte: prevEnd },
  };
  if (accountType !== "ALL") {
    prevTxMatch.accountType = accountType;
  }

  // Execute aggregations
  const [
    currentTxAgg,
    prevTxAgg,
    allTimeBankCashAgg,
    ordersAgg,
    prevOrdersAgg,
    products,
    recentTransactions,
    recentOrders,
    categorySalesAgg,
    platformSalesAgg,
    expenseBreakdownAgg,
    monthlyTrendAgg,
  ] = await Promise.all([
    // Current Period Transactions
    Transaction.aggregate([
      { $match: currentTxMatch },
      {
        $group: {
          _id: null,
          totalDebit: { $sum: "$debit" },
          totalCredit: { $sum: "$credit" },
        },
      },
    ]),

    // Previous Period Transactions
    Transaction.aggregate([
      { $match: prevTxMatch },
      {
        $group: {
          _id: null,
          totalDebit: { $sum: "$debit" },
          totalCredit: { $sum: "$credit" },
        },
      },
    ]),

    // All-time Bank & Cash balances
    Transaction.aggregate([
      { $match: { isArchived: { $ne: true } } },
      {
        $group: {
          _id: "$bankOrCash",
          debit: { $sum: "$debit" },
          credit: { $sum: "$credit" },
        },
      },
    ]),

    // Orders in period (for COGS & platform details)
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
          totalRevenue: { $sum: "$netAmount" },
          totalCogs: { $sum: "$estimatedCogs" },
          totalMarketplaceFees: { $sum: "$marketplaceFee" },
          totalShippingFees: { $sum: "$shippingFee" },
          totalPackagingFees: { $sum: "$packagingFee" },
          totalGrossProfit: { $sum: "$grossProfit" },
          orderCount: { $sum: 1 },
        },
      },
    ]),

    // Prev period Orders
    Order.aggregate([
      {
        $match: {
          date: { $gte: prevStart, $lte: prevEnd },
          orderStatus: { $ne: "CANCELLED" },
        },
      },
      {
        $group: {
          _id: null,
          totalGrossProfit: { $sum: "$grossProfit" },
          totalRevenue: { $sum: "$netAmount" },
        },
      },
    ]),

    // Products (active)
    Product.find({ isActive: true }).populate("category", "name").lean(),

    // Recent 5 Transactions
    Transaction.find({ isArchived: { $ne: true } })
      .sort({ date: -1, createdAt: -1 })
      .limit(6)
      .lean(),

    // Recent 5 Orders
    Order.find().sort({ date: -1, createdAt: -1 }).limit(6).lean(),

    // Sales by Category (unwind order items)
    Order.aggregate([
      {
        $match: {
          date: { $gte: start, $lte: end },
          orderStatus: { $ne: "CANCELLED" },
        },
      },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "prod",
        },
      },
      { $unwind: { path: "$prod", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "categories",
          localField: "prod.category",
          foreignField: "_id",
          as: "cat",
        },
      },
      { $unwind: { path: "$cat", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ["$cat.name", "General"] },
          value: { $sum: "$items.total" },
          units: { $sum: "$items.quantity" },
        },
      },
      { $sort: { value: -1 } },
    ]),

    // Sales by Platform
    Order.aggregate([
      {
        $match: {
          date: { $gte: start, $lte: end },
          orderStatus: { $ne: "CANCELLED" },
        },
      },
      {
        $group: {
          _id: "$platform",
          revenue: { $sum: "$netAmount" },
          orders: { $sum: 1 },
          profit: { $sum: "$grossProfit" },
        },
      },
      { $sort: { revenue: -1 } },
    ]),

    // Expense Breakdown
    Transaction.aggregate([
      {
        $match: {
          ...currentTxMatch,
          debit: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: "$category",
          amount: { $sum: "$debit" },
        },
      },
      { $sort: { amount: -1 } },
      { $limit: 8 },
    ]),

    // Monthly Trend (Past 6-12 months)
    Transaction.aggregate([
      {
        $match: {
          isArchived: { $ne: true },
          date: { $gte: subMonths(now, 11) },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
          },
          revenue: { $sum: "$credit" },
          expenses: { $sum: "$debit" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),
  ]);

  // Process KPI numbers
  const currentTx = currentTxAgg[0] || { totalDebit: 0, totalCredit: 0 };
  const prevTx = prevTxAgg[0] || { totalDebit: 0, totalCredit: 0 };
  const currentOrders = ordersAgg[0] || {
    totalRevenue: 0,
    totalCogs: 0,
    totalMarketplaceFees: 0,
    totalShippingFees: 0,
    totalPackagingFees: 0,
    totalGrossProfit: 0,
    orderCount: 0,
  };
  const prevOrders = prevOrdersAgg[0] || { totalGrossProfit: 0, totalRevenue: 0 };

  // Bank & Cash Balances
  let bankBalance = 0;
  let cashBalance = 0;
  for (const item of allTimeBankCashAgg) {
    if (item._id === "Bank") {
      bankBalance = (item.credit || 0) - (item.debit || 0);
    } else if (item._id === "Cash") {
      cashBalance = (item.credit || 0) - (item.debit || 0);
    }
  }

  // Inventory value & stock units
  let totalStockUnits = 0;
  let totalInventoryValue = 0;
  const lowStockList: Array<{
    _id: any;
    name: string;
    sku: string;
    stock: number;
    threshold: number;
    status: "CRITICAL" | "LOW";
  }> = [];

  const categoryInventoryMap: Record<string, { value: number; stock: number }> = {};

  for (const p of products) {
    const stock = p.currentStock || 0;
    const price = p.purchasePrice || 0;
    const val = stock * price;
    totalStockUnits += stock;
    totalInventoryValue += val;

    const catName = (p.category as any)?.name || "General";
    if (!categoryInventoryMap[catName]) {
      categoryInventoryMap[catName] = { value: 0, stock: 0 };
    }
    categoryInventoryMap[catName].value += val;
    categoryInventoryMap[catName].stock += stock;

    if (stock <= 5) {
      lowStockList.push({
        _id: p._id,
        name: p.name,
        sku: p.sku,
        stock,
        threshold: p.lowStockThreshold || 10,
        status: "CRITICAL",
      });
    } else if (stock <= (p.lowStockThreshold || 10)) {
      lowStockList.push({
        _id: p._id,
        name: p.name,
        sku: p.sku,
        stock,
        threshold: p.lowStockThreshold || 10,
        status: "LOW",
      });
    }
  }

  // Calculate Revenue, Expenses, Gross Profit, Net Profit
  // If ecommerce accounts are active, revenue includes both transaction credits and order revenue
  const totalRevenue = currentTx.totalCredit;
  const prevRevenue = prevTx.totalCredit;

  const totalExpenses = currentTx.totalDebit;
  const prevExpenses = prevTx.totalDebit;

  // Gross profit: Order gross profit or total revenue minus COGS
  const grossProfit =
    currentOrders.totalGrossProfit > 0
      ? currentOrders.totalGrossProfit
      : Math.max(0, totalRevenue - currentOrders.totalCogs);
  const prevGrossProfit = prevOrders.totalGrossProfit;

  // Net Profit: Gross Profit - Operating Expenses (Main account debits)
  const netProfit = totalRevenue - totalExpenses;
  const prevNetProfit = prevRevenue - prevExpenses;

  // Percentage changes
  const calcChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / Math.abs(prev)) * 100);
  };

  const revenueChange = calcChange(totalRevenue, prevRevenue);
  const expenseChange = calcChange(totalExpenses, prevExpenses);
  const grossProfitChange = calcChange(grossProfit, prevGrossProfit);
  const netProfitChange = calcChange(netProfit, prevNetProfit);

  // Formulate 8 Recharts charts datasets
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlyData = monthlyTrendAgg.map((m) => {
    const rev = m.revenue || 0;
    const exp = m.expenses || 0;
    return {
      month: `${monthNames[m._id.month - 1]} ${String(m._id.year).slice(2)}`,
      revenue: rev,
      expenses: exp,
      profit: rev - exp,
    };
  });

  const categoryInventoryData = Object.entries(categoryInventoryMap).map(
    ([category, data]) => ({
      category,
      value: data.value,
      stock: data.stock,
    })
  );

  return {
    kpis: {
      totalRevenue,
      revenueChange,
      totalExpenses,
      expenseChange,
      grossProfit,
      grossProfitChange,
      netProfit,
      netProfitChange,
      bankBalance,
      cashBalance,
      inventoryValue: totalInventoryValue,
      totalStockUnits,
    },
    charts: {
      monthlyTrend: monthlyData,
      salesByCategory: categorySalesAgg.map((c) => ({
        name: c._id,
        value: c.value,
        units: c.units,
      })),
      salesByPlatform: platformSalesAgg.map((p) => ({
        platform: p._id,
        revenue: p.revenue,
        orders: p.orders,
        profit: p.profit,
      })),
      expenseBreakdown: expenseBreakdownAgg.map((e) => ({
        category: e._id,
        amount: e.amount,
      })),
      inventoryByCategory: categoryInventoryData,
    },
    lowStockAlerts: lowStockList.slice(0, 8),
    recentTransactions,
    recentOrders,
    dateRange: { start, end, preset },
  };
}
