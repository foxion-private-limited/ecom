"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Input,
  Select,
} from "@/lib/ui";
import {
  Plus,
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Trash2,
  Edit2,
  Paperclip,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { formatINR, formatIndianDate } from "@/lib/utils";
import { TransactionFormModal } from "./TransactionFormModal";
import { AccountType } from "@/lib/models/Transaction";
import { toast } from "sonner";

export function AccountsLedgerView({
  accountType,
  title,
  subtitle,
}: {
  accountType: AccountType;
  title: string;
  subtitle: string;
}) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalDebit: 0,
    totalCredit: 0,
    netBalance: 0,
    bankBalance: 0,
    cashBalance: 0,
    totalTransactions: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 1,
  });

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [category, setCategory] = useState("ALL");
  const [paymentMode, setPaymentMode] = useState("ALL");
  const [bankOrCash, setBankOrCash] = useState("ALL");
  const [categories, setCategories] = useState<any[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("accountType", accountType);
      if (search) params.set("search", search);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (category !== "ALL") params.set("category", category);
      if (paymentMode !== "ALL") params.set("paymentMode", paymentMode);
      if (bankOrCash !== "ALL") params.set("bankOrCash", bankOrCash);
      params.set("page", String(pagination.page));
      params.set("limit", String(pagination.limit));

      const res = await fetch(`/api/transactions?${params.toString()}`);
      const data = await res.json();
      if (data.transactions) {
        setTransactions(data.transactions);
        setSummary(data.summary);
        setPagination(data.pagination);
      }
    } catch {
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [
    accountType,
    search,
    startDate,
    endDate,
    category,
    paymentMode,
    bankOrCash,
    pagination.page,
    pagination.limit,
  ]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setCategories(data);
      })
      .catch(() => {});
  }, []);

  const handleArchive = async (id: string) => {
    if (!confirm("Are you sure you want to archive this transaction?")) return;
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Transaction archived");
        fetchTransactions();
      }
    } catch {
      toast.error("Failed to archive transaction");
    }
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    params.set("accountType", accountType);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (category !== "ALL") params.set("category", category);
    window.open(`/api/excel/export?${params.toString()}`, "_blank");
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
          <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="primary"
            onClick={() => {
              setEditingTransaction(null);
              setIsModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Transaction
          </Button>

          <Link href={`/accounts/import?type=${accountType}`}>
            <Button variant="secondary">
              <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-400" />
              Import Excel
            </Button>
          </Link>

          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1.5 text-blue-400" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="p-4 bg-slate-900/60 border-slate-800/80">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Total Debit (Outflow)
          </span>
          <p className="text-lg font-bold text-rose-400 mt-1">
            {formatINR(summary.totalDebit)}
          </p>
        </Card>

        <Card className="p-4 bg-slate-900/60 border-slate-800/80">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Total Credit (Inflow)
          </span>
          <p className="text-lg font-bold text-emerald-400 mt-1">
            {formatINR(summary.totalCredit)}
          </p>
        </Card>

        <Card className="p-4 bg-slate-900/60 border-slate-800/80">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Net Book Balance
          </span>
          <p
            className={`text-lg font-bold mt-1 ${
              summary.netBalance >= 0 ? "text-blue-400" : "text-rose-400"
            }`}
          >
            {formatINR(summary.netBalance)}
          </p>
        </Card>

        <Card className="p-4 bg-slate-900/60 border-slate-800/80">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Bank Account Balance
          </span>
          <p className="text-lg font-bold text-cyan-400 mt-1">
            {formatINR(summary.bankBalance)}
          </p>
        </Card>

        <Card className="p-4 bg-slate-900/60 border-slate-800/80">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Cash in Hand
          </span>
          <p className="text-lg font-bold text-amber-400 mt-1">
            {formatINR(summary.cashBalance)}
          </p>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 bg-slate-900/60 border-slate-800/80 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search description, invoice, party..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <input
              type="date"
              placeholder="From Date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <input
              type="date"
              placeholder="To Date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={bankOrCash}
              onChange={(e) => setBankOrCash(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">Bank & Cash</option>
              <option value="Bank">Bank Only</option>
              <option value="Cash">Cash Only</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Transactions Table */}
      <Card className="overflow-hidden border-slate-800/80 bg-slate-900/70">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold tracking-wider uppercase text-[10px]">
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Description</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-right">Debit (₹)</th>
                <th className="py-3 px-3 text-right">Credit (₹)</th>
                <th className="py-3 px-3 text-right">Running Balance</th>
                <th className="py-3 px-3">Payment Mode</th>
                <th className="py-3 px-3">Bank/Cash</th>
                <th className="py-3 px-3">Party / Invoice</th>
                <th className="py-3 px-3 text-center">Bill</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
                    Loading transactions...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <div className="max-w-xs mx-auto space-y-3">
                      <p className="text-sm">No transactions found in this view.</p>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => setIsModalOpen(true)}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Add First Transaction
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr
                    key={tx._id}
                    className="hover:bg-slate-800/40 transition-colors group"
                  >
                    <td className="py-3 px-3 whitespace-nowrap text-slate-300 font-mono text-[11px]">
                      {formatIndianDate(tx.date)}
                    </td>
                    <td className="py-3 px-3 font-medium text-white max-w-xs truncate">
                      {tx.description}
                      {tx.remarks && (
                        <span className="block text-[10px] text-slate-400 truncate">
                          {tx.remarks}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <Badge variant="secondary" className="text-[10px] py-0 px-2">
                        {tx.category}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap font-medium text-rose-400">
                      {tx.debit > 0 ? formatINR(tx.debit) : "—"}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap font-medium text-emerald-400">
                      {tx.credit > 0 ? formatINR(tx.credit) : "—"}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap font-semibold font-mono text-slate-200">
                      {formatINR(tx.calculatedBalance)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-slate-300">
                      {tx.paymentMode}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <Badge
                        variant={tx.bankOrCash === "Bank" ? "info" : "warning"}
                        className="text-[10px] py-0 px-2"
                      >
                        {tx.bankOrCash}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-slate-300">
                      <div>{tx.partyName || "—"}</div>
                      {tx.invoiceOrderId && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          #{tx.invoiceOrderId}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {tx.billAvailable ? (
                        <span className="inline-flex items-center text-emerald-400 text-xs">
                          <Paperclip className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100">
                        <button
                          onClick={() => {
                            setEditingTransaction(tx);
                            setIsModalOpen(true);
                          }}
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-blue-400 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleArchive(tx._id)}
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400 transition-colors"
                          title="Archive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-950/40 text-xs text-slate-400">
            <div>
              Showing page {pagination.page} of {pagination.pages} (
              {pagination.total} transactions)
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={pagination.page <= 1}
                onClick={() =>
                  setPagination((p) => ({ ...p, page: p.page - 1 }))
                }
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pagination.page >= pagination.pages}
                onClick={() =>
                  setPagination((p) => ({ ...p, page: p.page + 1 }))
                }
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Add / Edit Transaction Modal */}
      <TransactionFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchTransactions}
        defaultAccountType={accountType}
        initialData={editingTransaction}
      />
    </div>
  );
}
