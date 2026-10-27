import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connection";
import { Transaction, ITransaction, AccountType, TransactionOrigin } from "@/lib/models/Transaction";
import { Category } from "@/lib/models/Category";
import { Bill } from "@/lib/models/Bill";
import { cleanupBillIfUnreferenced } from "@/lib/services/billStorageService";
import { parseIndianDate, toInputDateString, getISTCalendarDate } from "@/lib/utils";

export interface TransactionFilterOptions {
  accountType?: AccountType | string;
  transactionOrigin?: "COMPANY" | "PRE_COMPANY" | "ALL";
  startDate?: Date | string;
  endDate?: Date | string;
  category?: string;
  paymentMode?: string;
  bankOrCash?: "Bank" | "Cash" | "Personal Bank" | "Personal Cash" | "ALL";
  paymentSource?: string;
  paidBy?: string;
  partyName?: string;
  search?: string;
  page?: number;
  limit?: number;
  unpaginated?: boolean;
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
  personalBankBalance?: number;
  personalCashBalance?: number;
  personalTotalPaid?: number;
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
  const match: Record<string, unknown> = {
    isArchived: { $ne: true },
    // Only physical company bank/cash funds!
    // Personal Bank and Personal Cash must NEVER affect company bank or company cash!
    bankOrCash: { $in: ["Bank", "Cash"] },
    $or: [
      { transactionOrigin: { $ne: "PRE_COMPANY" } },
      { paymentSource: { $in: ["Company Bank", "Company Cash"] } },
    ],
  };
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
    accountType = "MAIN",
    transactionOrigin = "COMPANY",
    startDate,
    endDate,
    category,
    paymentMode,
    bankOrCash,
    paymentSource,
    paidBy,
    partyName,
    search,
    page = 1,
    limit = 50,
  } = options;

  const resolvedAccountType = accountType && accountType !== "ALL" ? accountType : "MAIN";
  const baseAccountQuery: Record<string, unknown> = { isArchived: { $ne: true }, accountType: resolvedAccountType };

  if (transactionOrigin && transactionOrigin !== "ALL") {
    if (transactionOrigin === "PRE_COMPANY") {
      baseAccountQuery.transactionOrigin = "PRE_COMPANY";
    } else {
      baseAccountQuery.$or = [
        { transactionOrigin: "COMPANY" },
        { transactionOrigin: { $exists: false } },
      ];
    }
  }

  const query: Record<string, unknown> = { ...baseAccountQuery };

  if (startDate || endDate) {
    const dateQuery: { $gte?: Date; $lte?: Date } = {};
    if (startDate) {
      if (typeof startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        const [sYear, sMonth, sDay] = startDate.split("-").map(Number);
        dateQuery.$gte = new Date(Date.UTC(sYear, sMonth - 1, sDay, 0, 0, 0, 0));
      } else {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateQuery.$gte = start;
      }
    }
    if (endDate) {
      if (typeof endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        const [eYear, eMonth, eDay] = endDate.split("-").map(Number);
        dateQuery.$lte = new Date(Date.UTC(eYear, eMonth - 1, eDay, 23, 59, 59, 999));
      } else {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateQuery.$lte = end;
      }
    }
    query.date = dateQuery;
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

  if (paymentSource && paymentSource !== "ALL") {
    query.paymentSource = paymentSource;
  }

  if (paidBy) {
    query.paidBy = { $regex: paidBy, $options: "i" };
  }

  if (partyName) {
    query.partyName = { $regex: partyName, $options: "i" };
  }

  if (search) {
    const searchConditions = [
      { description: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
      { partyName: { $regex: search, $options: "i" } },
      { paidBy: { $regex: search, $options: "i" } },
      { invoiceOrderId: { $regex: search, $options: "i" } },
      { remarks: { $regex: search, $options: "i" } },
    ];
    if (query.$or) {
      query.$and = [{ $or: query.$or }, { $or: searchConditions }];
      delete query.$or;
    } else {
      query.$or = searchConditions;
    }
  }

  // Calculate overall summary using aggregation (for the whole filtered set)
  const summaryPipeline: mongoose.PipelineStage[] = [{ $match: query }];
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
      personalBankDebit: {
        $sum: {
          $cond: [
            {
              $or: [
                { $eq: ["$bankOrCash", "Personal Bank"] },
                { $eq: ["$paymentSource", "Personal Bank"] },
              ],
            },
            "$debit",
            0,
          ],
        },
      },
      personalBankCredit: {
        $sum: {
          $cond: [
            {
              $or: [
                { $eq: ["$bankOrCash", "Personal Bank"] },
                { $eq: ["$paymentSource", "Personal Bank"] },
              ],
            },
            "$credit",
            0,
          ],
        },
      },
      personalCashDebit: {
        $sum: {
          $cond: [
            {
              $or: [
                { $eq: ["$bankOrCash", "Personal Cash"] },
                { $eq: ["$paymentSource", "Personal Cash"] },
              ],
            },
            "$debit",
            0,
          ],
        },
      },
      personalCashCredit: {
        $sum: {
          $cond: [
            {
              $or: [
                { $eq: ["$bankOrCash", "Personal Cash"] },
                { $eq: ["$paymentSource", "Personal Cash"] },
              ],
            },
            "$credit",
            0,
          ],
        },
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
    personalBankDebit: 0,
    personalBankCredit: 0,
    personalCashDebit: 0,
    personalCashCredit: 0,
    count: 0,
  };

  const summary: TransactionSummary = {
    totalDebit: rawSummary.totalDebit,
    totalCredit: rawSummary.totalCredit,
    netBalance: rawSummary.totalCredit - rawSummary.totalDebit,
    bankBalance: rawSummary.bankCredit - rawSummary.bankDebit,
    cashBalance: rawSummary.cashCredit - rawSummary.cashDebit,
    personalBankBalance: (rawSummary.personalBankCredit || 0) - (rawSummary.personalBankDebit || 0),
    personalCashBalance: (rawSummary.personalCashCredit || 0) - (rawSummary.personalCashDebit || 0),
    personalTotalPaid: (rawSummary.personalBankDebit || 0) + (rawSummary.personalCashDebit || 0),
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

  const hasFilters = Boolean(
    startDate ||
    endDate ||
    (category && category !== "ALL") ||
    (paymentMode && paymentMode !== "ALL") ||
    (bankOrCash && bankOrCash !== "ALL") ||
    (paymentSource && paymentSource !== "ALL") ||
    paidBy ||
    partyName ||
    search
  );

  let transactionsWithBalance: TransactionWithBalance[];

  if (hasFilters) {
    // 1. Establish authoritative running balance for each transaction from the complete account ledger.
    // The frontend's displayed balance is authoritative; transactions preserve their true ledger balance.
    const ledgerTransactions = await Transaction.find(baseAccountQuery)
      .select("_id debit credit date createdAt")
      .sort({ date: 1, createdAt: 1, _id: 1 })
      .lean();

    const balanceMap = new Map<string, number>();
    let ledgerRunningBalance = 0;
    for (const ltx of ledgerTransactions) {
      const debit = ltx.debit || 0;
      const credit = ltx.credit || 0;
      ledgerRunningBalance += credit - debit;
      balanceMap.set(String(ltx._id), ledgerRunningBalance);
    }

    // 2. Retrieve filtered transactions in chronological order
    const filteredTransactions = await Transaction.find(query)
      .sort({ date: 1, createdAt: 1, _id: 1 })
      .lean();

    // 3. Map each filtered transaction to its exact ledger balance using its stable transaction ID
    transactionsWithBalance = filteredTransactions.map((tx) => {
      const calculatedBalance = balanceMap.has(String(tx._id))
        ? (balanceMap.get(String(tx._id)) as number)
        : 0;
      return {
        ...tx,
        calculatedBalance,
      } as unknown as TransactionWithBalance;
    });
  } else {
    // No filters applied: calculate running balance across the full ledger directly
    const allFilteredTransactions = await Transaction.find(query)
      .sort({ date: 1, createdAt: 1, _id: 1 })
      .lean();

    let runningBalance = 0;
    transactionsWithBalance = allFilteredTransactions.map((tx) => {
      const debit = tx.debit || 0;
      const credit = tx.credit || 0;
      runningBalance += credit - debit;
      return {
        ...tx,
        calculatedBalance: runningBalance,
      } as unknown as TransactionWithBalance;
    });
  }

  if (options.unpaginated) {
    return {
      transactions: transactionsWithBalance,
      summary,
      pagination: {
        page: 1,
        limit: transactionsWithBalance.length,
        total,
        pages: 1,
      },
    };
  }

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

/**
 * Check whether a transaction already exists on the same calendar date.
 * Duplicate dates are now allowed across Foxion accounts, so this always returns exists: false.
 */
export async function checkTransactionDateConflict(_options: {
  date: Date | string;
  accountType?: AccountType | string;
  origin?: TransactionOrigin | string;
  excludeId?: string;
}): Promise<{ exists: boolean; conflictingDate: string; existingTransaction?: ITransaction | null }> {
  return { exists: false, conflictingDate: "" };
}

export async function createTransaction(
  data: Partial<ITransaction>,
  userEmail: string = "System"
): Promise<ITransaction> {
  await connectDB();

  const transactionOrigin = data.transactionOrigin || "COMPANY";
  const cal = data.date ? getISTCalendarDate(data.date) : null;

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

  const bankOrCash = data.bankOrCash || (transactionOrigin === "PRE_COMPANY" ? "Personal Bank" : "Bank");
  let paymentSource = data.paymentSource;
  if (!paymentSource) {
    if (bankOrCash === "Personal Bank") paymentSource = "Personal Bank";
    else if (bankOrCash === "Personal Cash") paymentSource = "Personal Cash";
    else if (bankOrCash === "Cash") paymentSource = "Company Cash";
    else paymentSource = "Company Bank";
  }

  // Validate that attachments are strictly permitted for Debit transactions only
  if (data.credit && data.credit > 0 && (data.attachment || data.billId)) {
    throw new Error("Bill attachments are only permitted for Debit transactions.");
  }

  const billAvailable = !!data.attachment || !!data.billAvailable;
  let formattedAttachment = data.attachment;
  if (formattedAttachment && typeof formattedAttachment.fileId === "string") {
    formattedAttachment = {
      ...formattedAttachment,
      fileId: new mongoose.Types.ObjectId(formattedAttachment.fileId),
    };
  }

  try {
    const tx = await Transaction.create({
      ...data,
      attachment: formattedAttachment,
      billAvailable,
      billId: formattedAttachment?.fileId || data.billId,
      accountType: "MAIN",
      transactionOrigin,
      bankOrCash,
      paymentSource,
      paidBy: data.paidBy?.trim(),
      normalizedDate: cal?.dateStr,
      createdBy: userEmail,
    });

    if (formattedAttachment && formattedAttachment.fileId) {
      try {
        await Bill.create({
          filename: formattedAttachment.originalName,
          originalName: formattedAttachment.originalName,
          mimeType: formattedAttachment.mimeType,
          size: formattedAttachment.size,
          url: formattedAttachment.url,
          uploadedBy: userEmail,
          relatedType: "TRANSACTION",
          relatedId: tx._id,
        });
      } catch (billErr) {
        console.warn("[Transaction] Bill document synchronization notice:", billErr);
      }
    }

    return tx;
  } catch (err: unknown) {
    throw err;
  }
}

export async function updateTransaction(
  id: string,
  data: Partial<ITransaction>
): Promise<ITransaction | null> {
  await connectDB();

  // Validate that attachments are strictly permitted for Debit transactions only
  if (data.credit && data.credit > 0 && data.attachment) {
    throw new Error("Bill attachments are only permitted for Debit transactions.");
  }

  const updateData: Record<string, unknown> = { ...data, accountType: "MAIN" };

  if (data.date) {
    const cal = getISTCalendarDate(data.date);
    if (cal) {
      updateData.normalizedDate = cal.dateStr;
    }
  }

  const oldTx = await Transaction.findById(id);

  // If switching to Credit, remove any existing attachment from the transaction
  if (data.credit && data.credit > 0 && oldTx?.attachment?.fileId) {
    await cleanupBillIfUnreferenced(oldTx.attachment.fileId, id);
    delete updateData.attachment;
    updateData.$unset = { ...(updateData.$unset as Record<string, unknown> || {}), attachment: 1, billId: 1 };
    updateData.billAvailable = false;
  } else if (data.attachment === null) {
    // Explicit removal of attachment
    if (oldTx?.attachment?.fileId) {
      await cleanupBillIfUnreferenced(oldTx.attachment.fileId, id);
    }
    delete updateData.attachment;
    updateData.$unset = { ...(updateData.$unset as Record<string, unknown> || {}), attachment: 1, billId: 1 };
    updateData.billAvailable = false;
  } else if (data.attachment) {
    let formattedAttachment = data.attachment;
    if (typeof formattedAttachment.fileId === "string") {
      formattedAttachment = {
        ...formattedAttachment,
        fileId: new mongoose.Types.ObjectId(formattedAttachment.fileId),
      };
    }
    updateData.attachment = formattedAttachment;
    updateData.billAvailable = true;
    updateData.billId = formattedAttachment.fileId;

    // If replacement, clean up old file if different
    if (
      oldTx?.attachment?.fileId &&
      String(oldTx.attachment.fileId) !== String(formattedAttachment.fileId)
    ) {
      await cleanupBillIfUnreferenced(oldTx.attachment.fileId, id);
    }
  }

  return await Transaction.findByIdAndUpdate(id, updateData, { new: true });
}

export async function archiveTransaction(id: string): Promise<boolean> {
  await connectDB();
  const res = await Transaction.findByIdAndUpdate(id, { isArchived: true });
  return !!res;
}

export async function deleteTransactionPermanently(id: string): Promise<boolean> {
  await connectDB();
  const tx = await Transaction.findById(id);
  if (!tx) return false;

  const fileId = tx.attachment?.fileId || tx.billId;
  const res = await Transaction.findByIdAndDelete(id);

  if (fileId) {
    try {
      await cleanupBillIfUnreferenced(fileId, id);
    } catch (cleanupErr) {
      console.warn("[Transaction] Attachment cleanup notice:", cleanupErr);
    }
  }

  return !!res;
}

/**
 * Query existing account records to find the latest transaction that occurred
 * strictly before the earliest imported transaction's date and return its closing balance.
 * Strictly guarantees no future transactions or same-date transactions influence the starting balance.
 */
export async function getPreviousTransactionBalance(
  earliestDateInput: Date | string,
  accountType: AccountType | string = "MAIN",
  origin: TransactionOrigin | string = "COMPANY",
  options?: { initialBalance?: number }
): Promise<number> {
  await connectDB();

  const earliestDate = parseIndianDate(earliestDateInput) || new Date(earliestDateInput);
  if (isNaN(earliestDate.getTime())) {
    return options?.initialBalance ?? 0;
  }

  // Derive the exact start of earliestDate's calendar day in Asia/Kolkata (UTC+5:30)
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(earliestDate);
  const day = parseInt(parts.find((p) => p.type === "day")?.value || "1", 10);
  const month = parseInt(parts.find((p) => p.type === "month")?.value || "1", 10) - 1;
  const year = parseInt(parts.find((p) => p.type === "year")?.value || "2026", 10);

  // 00:00:00 IST is 18:30:00 UTC of previous day
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const startOfDayIST = new Date(Date.UTC(year, month, day, 0, 0, 0) - istOffsetMs);
  const earliestDateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const query: Record<string, unknown> = {
    accountType,
    isArchived: { $ne: true },
    date: { $lt: startOfDayIST },
  };

  if (origin === "PRE_COMPANY") {
    query.transactionOrigin = "PRE_COMPANY";
  } else {
    query.$or = [
      { transactionOrigin: "COMPANY" },
      { transactionOrigin: { $exists: false } },
    ];
  }

  const previousTransactions = await Transaction.find(query)
    .sort({ date: 1, createdAt: 1, _id: 1 })
    .lean();

  if (previousTransactions.length === 0) {
    return options?.initialBalance ?? 0;
  }

  let runningBalance = options?.initialBalance ?? 0;
  for (const tx of previousTransactions) {
    const txDateStr = toInputDateString(tx.date);
    if (txDateStr && txDateStr >= earliestDateStr) {
      continue; // Strictly guarantee no transactions on or after earliestDate are included
    }
    const credit = Number(tx.credit) || 0;
    const debit = Number(tx.debit) || 0;
    runningBalance += credit - debit;
  }

  return runningBalance;
}

/**
 * Sequentially calculate running balances for imported transactions from openingBalance.
 * Preserves deterministic ordering: primary sort by date ascending, secondary tiebreaker
 * using excelRowNumber or slNo or original array index.
 */
export function calculateImportBalances<
  T extends {
    date: string | Date;
    debit?: number;
    credit?: number;
    balance?: number;
    slNo?: number | string;
    excelRowNumber?: number;
  }
>(rows: T[], openingBalance: number = 0): T[] {
  const sorted = [...rows].sort((a, b) => {
    const da = a.date instanceof Date ? a.date.getTime() : (parseIndianDate(a.date)?.getTime() || 0);
    const db = b.date instanceof Date ? b.date.getTime() : (parseIndianDate(b.date)?.getTime() || 0);
    if (da !== db) return da - db;
    const rowA = Number(a.excelRowNumber ?? a.slNo ?? 0);
    const rowB = Number(b.excelRowNumber ?? b.slNo ?? 0);
    return rowA - rowB;
  });

  let running = openingBalance;
  return sorted.map((row, idx) => {
    const debit = Number(row.debit) || 0;
    const credit = Number(row.credit) || 0;
    running += credit - debit;
    return {
      ...row,
      slNo: idx + 1,
      balance: running,
    };
  });
}
