import { connectDB } from "@/lib/db/connection";
import { Transaction, ITransaction, AccountType } from "@/lib/models/Transaction";
import { Category } from "@/lib/models/Category";

export interface TransactionFilterOptions {
  accountType?: AccountType | string;
  startDate?: Date | string;
  endDate?: Date | string;
  category?: string;
  paymentMode?: string;
  bankOrCash?: "Bank" | "Cash" | "ALL";
  partyName?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface LiquidBalances {
  bankBalance: number;
  cashBalance: number;
  totalLiquidCapital: number;
}

export interface TransactionSummary {
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
  bankBalance: number;
  cashBalance: number;
  totalTransactions: number;
  liquidBalances?: LiquidBalances;
}

export interface TransactionWithBalance extends ITransaction {
  calculatedBalance: number;
}

export interface PaginatedTransactionsResult {
  transactions: TransactionWithBalance[];
  summary: TransactionSummary;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export async function getLiquidBalances(
  asOfDate?: Date | string
): Promise<LiquidBalances> {
  await connectDB();
  const match: any = { isArchived: { $ne: true } };
  if (asOfDate) {
    const end = new Date(asOfDate);
    end.setHours(23, 59, 59, 999);
    match.date = { $lte: end };
  }

  const agg = await Transaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$bankOrCash",
        totalDebit: { $sum: "$debit" },
        totalCredit: { $sum: "$credit" },
      },
    },
  ]);

  let bankBalance = 0;
  let cashBalance = 0;

  for (const row of agg) {
    const bal = (row.totalCredit || 0) - (row.totalDebit || 0);
    if (row._id === "Bank") bankBalance = bal;
    else if (row._id === "Cash") cashBalance = bal;
  }

  return {
    bankBalance,
    cashBalance,
    totalLiquidCapital: bankBalance + cashBalance,
  };
}

export async function getTransactions(
  options: TransactionFilterOptions = {}
): Promise<PaginatedTransactionsResult> {
  await connectDB();

  const {
    startDate,
    endDate,
    category,
    paymentMode,
    bankOrCash,
    partyName,
    search,
    page = 1,
    limit = 50,
  } = options;

  const query: any = { isArchived: { $ne: true }, accountType: "MAIN" };

  if (startDate || endDate) {
    query.date = {};
    if (startDate) {
      query.date.$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.date.$lte = end;
    }
  }

  if (category && category !== "ALL") {
    query.category = category;
  }

  if (paymentMode && paymentMode !== "ALL") {
    query.paymentMode = paymentMode;
  }

  if (bankOrCash && bankOrCash !== "ALL") {
    query.bankOrCash = bankOrCash;
  }

  if (partyName) {
    query.partyName = { $regex: partyName, $options: "i" };
  }

  if (search) {
    query.$or = [
      { description: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
      { partyName: { $regex: search, $options: "i" } },
      { invoiceOrderId: { $regex: search, $options: "i" } },
      { remarks: { $regex: search, $options: "i" } },
    ];
  }

  // Calculate overall summary using aggregation (for the whole filtered set)
  const summaryPipeline: any[] = [{ $match: query }];
  summaryPipeline.push({
    $group: {
      _id: null,
      totalDebit: { $sum: "$debit" },
      totalCredit: { $sum: "$credit" },
      bankDebit: {
        $sum: { $cond: [{ $eq: ["$bankOrCash", "Bank"] }, "$debit", 0] },
      },
      bankCredit: {
        $sum: { $cond: [{ $eq: ["$bankOrCash", "Bank"] }, "$credit", 0] },
      },
      cashDebit: {
        $sum: { $cond: [{ $eq: ["$bankOrCash", "Cash"] }, "$debit", 0] },
      },
      cashCredit: {
        $sum: { $cond: [{ $eq: ["$bankOrCash", "Cash"] }, "$credit", 0] },
      },
      count: { $sum: 1 },
    },
  });

  const summaryRes = await Transaction.aggregate(summaryPipeline);
  const rawSummary = summaryRes[0] || {
    totalDebit: 0,
    totalCredit: 0,
    bankDebit: 0,
    bankCredit: 0,
    cashDebit: 0,
    cashCredit: 0,
    count: 0,
  };

  const summary: TransactionSummary = {
    totalDebit: rawSummary.totalDebit,
    totalCredit: rawSummary.totalCredit,
    netBalance: rawSummary.totalCredit - rawSummary.totalDebit,
    bankBalance: rawSummary.bankCredit - rawSummary.bankDebit,
    cashBalance: rawSummary.cashCredit - rawSummary.cashDebit,
    totalTransactions: rawSummary.count,
    liquidBalances: {
      bankBalance: rawSummary.bankCredit - rawSummary.bankDebit,
      cashBalance: rawSummary.cashCredit - rawSummary.cashDebit,
      totalLiquidCapital:
        rawSummary.bankCredit -
        rawSummary.bankDebit +
        (rawSummary.cashCredit - rawSummary.cashDebit),
    },
  };

  // Get total count
  const total = rawSummary.count;
  const skip = (page - 1) * limit;

  // Retrieve transactions sorted chronologically
  const allFilteredTransactions = await Transaction.find(query)
    .sort({ date: 1, createdAt: 1, _id: 1 })
    .lean();

  let runningBalance = 0;
  const transactionsWithBalance = allFilteredTransactions.map((tx) => {
    const debit = tx.debit || 0;
    const credit = tx.credit || 0;
    runningBalance += credit - debit;
    return {
      ...tx,
      calculatedBalance: runningBalance,
    } as unknown as TransactionWithBalance;
  });

  // For display, most recent first (descending), sliced by page
  const reversed = [...transactionsWithBalance].reverse();
  const paginated = reversed.slice(skip, skip + limit);

  return {
    transactions: paginated,
    summary,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function createTransaction(
  data: Partial<ITransaction>,
  userEmail: string = "System"
): Promise<ITransaction> {
  await connectDB();

  // Ensure category exists
  if (data.category) {
    const existing = await Category.findOne({
      name: { $regex: new RegExp(`^${data.category.trim()}$`, "i") },
    });
    if (!existing) {
      await Category.create({
        name: data.category.trim(),
        slug: data.category.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        type: data.credit && data.credit > 0 ? "INCOME" : "EXPENSE",
        isActive: true,
      });
    }
  }

  const tx = await Transaction.create({
    ...data,
    accountType: "MAIN",
    createdBy: userEmail,
  });

  return tx;
}

export async function updateTransaction(
  id: string,
  data: Partial<ITransaction>
): Promise<ITransaction | null> {
  await connectDB();
  return Transaction.findByIdAndUpdate(id, { ...data, accountType: "MAIN" }, { new: true });
}

export async function archiveTransaction(id: string): Promise<boolean> {
  await connectDB();
  const res = await Transaction.findByIdAndUpdate(id, { isArchived: true });
  return !!res;
}
