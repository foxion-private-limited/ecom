"use client";

import React, { useState, useEffect } from "react";
import { Modal, Button, Input, Select } from "@/lib/ui";
import { AccountType } from "@/lib/models/Transaction";
import { toast } from "sonner";

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultAccountType?: AccountType;
  initialData?: any;
}

export function TransactionFormModal({
  isOpen,
  onClose,
  onSuccess,
  defaultAccountType = "MAIN",
  initialData,
}: TransactionModalProps) {
  const [accountType, setAccountType] = useState<AccountType>(defaultAccountType);
  const [entryType, setEntryType] = useState<"DEBIT" | "CREDIT">("DEBIT");
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [paymentMode, setPaymentMode] = useState("Bank Transfer");
  const [bankOrCash, setBankOrCash] = useState<"Bank" | "Cash" | "N/A">("Bank");
  const [partyName, setPartyName] = useState("");
  const [invoiceOrderId, setInvoiceOrderId] = useState("");
  const [gstApplicable, setGstApplicable] = useState(false);
  const [gstAmount, setGstAmount] = useState<string>("0");
  const [tdsTcsAmount, setTdsTcsAmount] = useState<string>("0");
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      setAccountType(initialData?.accountType || defaultAccountType);
      if (initialData) {
        setEntryType(initialData.debit > 0 ? "DEBIT" : "CREDIT");
        setAmount(String(initialData.debit > 0 ? initialData.debit : initialData.credit));
        setDate(new Date(initialData.date).toISOString().slice(0, 10));
        setDescription(initialData.description || "");
        setCategory(initialData.category || "");
        setPaymentMode(initialData.paymentMode || "Bank Transfer");
        setBankOrCash(initialData.bankOrCash || "Bank");
        setPartyName(initialData.partyName || "");
        setInvoiceOrderId(initialData.invoiceOrderId || "");
        setGstApplicable(!!initialData.gstApplicable);
        setGstAmount(String(initialData.gstAmount || 0));
        setTdsTcsAmount(String(initialData.tdsTcsAmount || 0));
        setRemarks(initialData.remarks || "");
      } else {
        // Reset defaults
        setEntryType("DEBIT");
        setAmount("");
        setDate(new Date().toISOString().slice(0, 10));
        setDescription("");
        setCategory("");
        setPaymentMode("Bank Transfer");
        setBankOrCash("Bank");
        setPartyName("");
        setInvoiceOrderId("");
        setGstApplicable(false);
        setGstAmount("0");
        setTdsTcsAmount("0");
        setRemarks("");
      }

      // Fetch dynamic categories
      fetch("/api/categories")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setCategories(data);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, initialData, defaultAccountType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast.error("Please enter a valid amount greater than 0");
      return;
    }

    if (!description.trim()) {
      toast.error("Please enter a description");
      return;
    }

    if (!category.trim()) {
      toast.error("Please select or enter a category");
      return;
    }

    setLoading(true);

    const debit = entryType === "DEBIT" ? numericAmount : 0;
    const credit = entryType === "CREDIT" ? numericAmount : 0;

    const payload = {
      accountType,
      date: new Date(date),
      description: description.trim(),
      category: category.trim(),
      debit,
      credit,
      paymentMode,
      bankOrCash,
      partyName: partyName.trim(),
      invoiceOrderId: invoiceOrderId.trim(),
      gstApplicable,
      gstAmount: parseFloat(gstAmount) || 0,
      tdsTcsAmount: parseFloat(tdsTcsAmount) || 0,
      remarks: remarks.trim(),
      billAvailable: false,
    };

    try {
      const url = initialData ? `/api/transactions/${initialData._id}` : "/api/transactions";
      const method = initialData ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || (data.error && !data.success)) {
        throw new Error(data.error || "Failed to save transaction");
      }

      toast.success(initialData ? "Transaction updated" : "Transaction added successfully");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save transaction");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "Edit Transaction" : "New Transaction Entry"}
      description={`Record an entry in ${accountType === "MAIN" ? "Main Company Accounts" : "Ecommerce Accounts"}`}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Account and Entry type toggle */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Account Book
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAccountType("MAIN")}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  accountType === "MAIN"
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                }`}
              >
                Main Accounts
              </button>
              <button
                type="button"
                onClick={() => setAccountType("ECOMMERCE")}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  accountType === "ECOMMERCE"
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                }`}
              >
                Ecommerce Accounts
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Transaction Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEntryType("DEBIT")}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  entryType === "DEBIT"
                    ? "bg-rose-600 border-rose-500 text-white"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                }`}
              >
                Debit (Expense / Outflow)
              </button>
              <button
                type="button"
                onClick={() => setEntryType("CREDIT")}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  entryType === "CREDIT"
                    ? "bg-emerald-600 border-emerald-500 text-white"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                }`}
              >
                Credit (Income / Inflow)
              </button>
            </div>
          </div>
        </div>

        {/* Date and Amount */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Date *"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          <Input
            label={`Amount (₹) * [${entryType === "DEBIT" ? "Debit" : "Credit"}]`}
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        {/* Description */}
        <Input
          label="Description / Narration *"
          required
          placeholder="Transaction description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {/* Category & Party */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Category *
            </label>
            <input
              list="categories-list"
              className="flex h-9 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Select or type category..."
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            <datalist id="categories-list">
              {categories.map((c) => (
                <option key={c._id} value={c.name} />
              ))}
              <option value="Office Expenses" />
              <option value="Salaries & Wages" />
              <option value="Electricity" />
              <option value="Internet" />
              <option value="Logistics & Packaging" />
              <option value="Advertising & Marketing" />
              <option value="Amazon Sales" />
              <option value="Meesho Sales" />
              <option value="Flipkart Sales" />
              <option value="Purchases / Inventory Inward" />
            </datalist>
          </div>

          <Input
            label="Party Name / Vendor / Customer"
            placeholder="Party / Vendor / Customer name"
            value={partyName}
            onChange={(e) => setPartyName(e.target.value)}
          />
        </div>

        {/* Payment mode, Bank/Cash, Invoice/Order ID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            label="Payment Mode"
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value)}
            options={[
              { value: "Bank Transfer", label: "Bank Transfer / NEFT / IMPS" },
              { value: "UPI", label: "UPI (GPay / PhonePe / Paytm)" },
              { value: "Cash", label: "Cash" },
              { value: "Card", label: "Debit / Credit Card" },
              { value: "Cheque", label: "Cheque" },
              { value: "Marketplace", label: "Marketplace Payout / Settlement" },
            ]}
          />

          <Select
            label="Account (Bank / Cash)"
            value={bankOrCash}
            onChange={(e) => setBankOrCash(e.target.value as any)}
            options={[
              { value: "Bank", label: "Bank Account" },
              { value: "Cash", label: "Cash in Hand" },
              { value: "N/A", label: "Not Applicable" },
            ]}
          />

          <Input
            label="Invoice / Order ID"
            placeholder="Invoice or Reference ID"
            value={invoiceOrderId}
            onChange={(e) => setInvoiceOrderId(e.target.value)}
          />
        </div>

        {/* GST & TDS */}
        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2">
            <input
              id="gstApplicable"
              type="checkbox"
              checked={gstApplicable}
              onChange={(e) => setGstApplicable(e.target.checked)}
              className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="gstApplicable" className="text-xs font-medium text-slate-300 cursor-pointer">
              GST Applicable on this transaction
            </label>
          </div>

          {gstApplicable && (
            <div className="grid grid-cols-2 gap-4 pt-1">
              <Input
                label="GST Amount (₹)"
                type="number"
                step="0.01"
                min="0"
                value={gstAmount}
                onChange={(e) => setGstAmount(e.target.value)}
              />
              <Input
                label="TDS / TCS Amount (₹)"
                type="number"
                step="0.01"
                min="0"
                value={tdsTcsAmount}
                onChange={(e) => setTdsTcsAmount(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Remarks */}
        <Input
          label="Remarks / Notes"
          placeholder="Optional notes or references"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            {initialData ? "Update Transaction" : "Save Transaction"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
