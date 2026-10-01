"use client";

import React, { useState, useEffect } from "react";
import { Modal, Button, Input, Select } from "@/lib/ui";
import { toast } from "sonner";

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultAccountType?: string;
  defaultOrigin?: "COMPANY" | "PRE_COMPANY";
  initialData?: any;
}

export function TransactionFormModal({
  isOpen,
  onClose,
  onSuccess,
  defaultOrigin = "COMPANY",
  initialData,
}: TransactionModalProps) {
  const accountType = "MAIN";
  const [origin, setOrigin] = useState<"COMPANY" | "PRE_COMPANY">(defaultOrigin);
  const [entryType, setEntryType] = useState<"DEBIT" | "CREDIT">("DEBIT");
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [paymentMode, setPaymentMode] = useState("Bank Transfer");
  const [bankOrCash, setBankOrCash] = useState<"Bank" | "Cash" | "Personal Bank" | "Personal Cash" | "N/A">("Bank");
  const [paidBy, setPaidBy] = useState("");
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
      if (initialData) {
        setOrigin(initialData.transactionOrigin || defaultOrigin);
        setEntryType(initialData.debit > 0 ? "DEBIT" : "CREDIT");
        setAmount(String(initialData.debit > 0 ? initialData.debit : initialData.credit));
        setDate(new Date(initialData.date).toISOString().slice(0, 10));
        setDescription(initialData.description || "");
        setCategory(initialData.category || "");
        setPaymentMode(initialData.paymentMode || (initialData.transactionOrigin === "PRE_COMPANY" ? "UPI" : "Bank Transfer"));
        setBankOrCash(initialData.bankOrCash || (initialData.transactionOrigin === "PRE_COMPANY" ? "Personal Bank" : "Bank"));
        setPaidBy(initialData.paidBy || "");
        setPartyName(initialData.partyName || "");
        setInvoiceOrderId(initialData.invoiceOrderId || "");
        setGstApplicable(!!initialData.gstApplicable);
        setGstAmount(String(initialData.gstAmount || 0));
        setTdsTcsAmount(String(initialData.tdsTcsAmount || 0));
        setRemarks(initialData.remarks || "");
      } else {
        // Reset defaults
        const currentOrigin = defaultOrigin;
        setOrigin(currentOrigin);
        setEntryType("DEBIT");
        setAmount("");
        setDate(new Date().toISOString().slice(0, 10));
        setDescription("");
        setCategory(currentOrigin === "PRE_COMPANY" ? "Registration Expense" : "");
        setPaymentMode(currentOrigin === "PRE_COMPANY" ? "UPI" : "Bank Transfer");
        setBankOrCash(currentOrigin === "PRE_COMPANY" ? "Personal Bank" : "Bank");
        setPaidBy("");
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
  }, [isOpen, initialData, defaultOrigin]);

  const isPersonalPayment =
    bankOrCash === "Personal Bank" || bankOrCash === "Personal Cash";

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

    if (origin === "PRE_COMPANY" && isPersonalPayment && !paidBy.trim()) {
      toast.error("Please specify 'Paid By' for personal payments (e.g. Alan Nixon)");
      return;
    }

    setLoading(true);

    const debit = entryType === "DEBIT" ? numericAmount : 0;
    const credit = entryType === "CREDIT" ? numericAmount : 0;

    let paymentSource = "Company Bank";
    if (bankOrCash === "Personal Bank") paymentSource = "Personal Bank";
    else if (bankOrCash === "Personal Cash") paymentSource = "Personal Cash";
    else if (bankOrCash === "Cash") paymentSource = "Company Cash";
    else if (bankOrCash === "N/A") paymentSource = "Other";

    const payload = {
      accountType,
      transactionOrigin: origin,
      paidBy: paidBy.trim() || undefined,
      paymentSource,
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

      toast.success(
        initialData
          ? "Transaction updated"
          : origin === "PRE_COMPANY"
          ? "Pre-Company transaction recorded successfully"
          : "Transaction added successfully"
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save transaction");
    } finally {
      setLoading(false);
    }
  };

  const isPreCompany = origin === "PRE_COMPANY";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        initialData
          ? isPreCompany
            ? "Edit Pre-Company Transaction"
            : "Edit Transaction"
          : isPreCompany
          ? "New Pre-Company Transaction"
          : "New Transaction Entry"
      }
      description={
        isPreCompany
          ? "Record a historical business transaction prior to official company bank setup"
          : "Record an entry in Foxion Accounts ledger"
      }
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Origin indicator banner */}
        {isPreCompany && (
          <div className="flex items-center justify-between px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300">
            <span className="font-semibold uppercase tracking-wider">
              Pre-Company Record
            </span>
            <span className="text-[11px] text-amber-200/80">
              Personal payments will not debit company bank balances
            </span>
          </div>
        )}

        {/* Entry type toggle */}
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
          placeholder="e.g. Advance for company registration"
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
              <option value="Registration Expense" />
              <option value="Government Fees" />
              <option value="Professional Fees" />
              <option value="Legal Fees" />
              <option value="Business Setup" />
              <option value="Domain / Hosting" />
              <option value="Software" />
              <option value="Office Setup" />
              <option value="Equipment" />
              <option value="Salaries & Wages" />
              <option value="Advertising & Marketing" />
              <option value="Other Pre-Company Expense" />
            </datalist>
          </div>

          <Input
            label="Party Name / Vendor / Recipient"
            placeholder="e.g. Bizpole, MCA, Registrar"
            value={partyName}
            onChange={(e) => setPartyName(e.target.value)}
          />
        </div>

        {/* Payment mode, Payment Source (Bank/Cash), Paid By */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            label="Payment Mode"
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value)}
            options={[
              { value: "UPI", label: "UPI (GPay / PhonePe / Paytm)" },
              { value: "Bank Transfer", label: "Bank Transfer / NEFT / IMPS" },
              { value: "Cash", label: "Cash" },
              { value: "Card", label: "Debit / Credit Card" },
              { value: "Cheque", label: "Cheque" },
              { value: "Marketplace", label: "Marketplace Payout" },
              { value: "Other", label: "Other" },
            ]}
          />

          <Select
            label="Payment Source / Account"
            value={bankOrCash}
            onChange={(e) => setBankOrCash(e.target.value as any)}
            options={
              isPreCompany
                ? [
                    { value: "Personal Bank", label: "Personal Bank (Owner/Alan Nixon)" },
                    { value: "Personal Cash", label: "Personal Cash" },
                    { value: "Bank", label: "Company Bank" },
                    { value: "Cash", label: "Company Cash" },
                    { value: "N/A", label: "Not Applicable" },
                  ]
                : [
                    { value: "Bank", label: "Company Bank" },
                    { value: "Cash", label: "Company Cash in Hand" },
                    { value: "Personal Bank", label: "Personal Bank" },
                    { value: "Personal Cash", label: "Personal Cash" },
                    { value: "N/A", label: "Not Applicable" },
                  ]
            }
          />

          <Input
            label={isPersonalPayment ? "Paid By (Payer) *" : "Paid By (Optional)"}
            required={isPreCompany && isPersonalPayment}
            placeholder="e.g. Alan Nixon"
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
          />
        </div>

        {/* Invoice / Reference ID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Invoice / Order / Reference ID"
            placeholder="Optional invoice or challan ID"
            value={invoiceOrderId}
            onChange={(e) => setInvoiceOrderId(e.target.value)}
          />

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
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
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Input
                  label="GST (₹)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={gstAmount}
                  onChange={(e) => setGstAmount(e.target.value)}
                />
                <Input
                  label="TDS/TCS (₹)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={tdsTcsAmount}
                  onChange={(e) => setTdsTcsAmount(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Remarks */}
        <Input
          label="Remarks / Notes"
          placeholder="e.g. Advance for company registration debited to Bizpole."
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            {initialData
              ? "Update Transaction"
              : isPreCompany
              ? "Save Pre-Company Transaction"
              : "Save Transaction"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
