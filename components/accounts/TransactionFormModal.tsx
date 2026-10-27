"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Modal, Button, Input, Select } from "@/lib/ui";
import {
  AlertTriangle,
  Paperclip,
  FileText,
  X,
  Upload,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultAccountType?: string;
  defaultOrigin?: "COMPANY" | "PRE_COMPANY";
  initialData?: TransactionFormInitialData | null;
}

export interface TransactionFormInitialData {
  _id?: string;
  transactionOrigin?: "COMPANY" | "PRE_COMPANY";
  debit?: number;
  credit?: number;
  date?: string | Date;
  description?: string;
  category?: string;
  paymentMode?: string;
  bankOrCash?: "Bank" | "Cash" | "Personal Bank" | "Personal Cash" | "N/A";
  paidBy?: string;
  partyName?: string;
  invoiceOrderId?: string;
  gstApplicable?: boolean;
  gstAmount?: number;
  tdsTcsAmount?: number;
  remarks?: string;
  billAvailable?: boolean;
  attachment?: {
    fileId?: string;
    url: string;
    originalName: string;
    mimeType: string;
    size: number;
  } | null;
  [key: string]: unknown;
}

interface FormSnapshot {
  origin: "COMPANY" | "PRE_COMPANY";
  entryType: "DEBIT" | "CREDIT";
  amount: string;
  date: string;
  description: string;
  category: string;
  paymentMode: string;
  bankOrCash: "Bank" | "Cash" | "Personal Bank" | "Personal Cash" | "N/A";
  paidBy: string;
  partyName: string;
  invoiceOrderId: string;
  gstApplicable: boolean;
  gstAmount: string;
  tdsTcsAmount: string;
  remarks: string;
}

interface CategoryOption {
  _id: string;
  name: string;
}

function parseDateForInput(d?: string | Date): string {
  if (!d) return new Date().toISOString().slice(0, 10);
  try {
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) {
      return new Date().toISOString().slice(0, 10);
    }
    return parsed.toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
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
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  // Supporting Bill / Receipt Attachment state (strictly for Debit)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [existingAttachment, setExistingAttachment] = useState<{
    fileId?: string;
    url: string;
    originalName: string;
    mimeType: string;
    size: number;
  } | null>(null);
  const [isAttachmentRemoved, setIsAttachmentRemoved] = useState(false);

  // Dirty-state & Discard confirmation state
  const [initialSnapshot, setInitialSnapshot] = useState<FormSnapshot | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Initialize form state and snapshot whenever modal opens or switching transactions
  useEffect(() => {
    if (isOpen) {
      const snap: FormSnapshot = initialData
        ? {
            origin: initialData.transactionOrigin || defaultOrigin,
            entryType: (initialData.debit ?? 0) > 0 ? "DEBIT" : "CREDIT",
            amount: String(
              (initialData.debit ?? 0) > 0
                ? initialData.debit
                : initialData.credit !== undefined && initialData.credit !== null && initialData.credit > 0
                ? initialData.credit
                : ""
            ),
            date: parseDateForInput(initialData.date),
            description: initialData.description || "",
            category: initialData.category || "",
            paymentMode:
              initialData.paymentMode ||
              (initialData.transactionOrigin === "PRE_COMPANY" ? "UPI" : "Bank Transfer"),
            bankOrCash:
              initialData.bankOrCash ||
              (initialData.transactionOrigin === "PRE_COMPANY" ? "Personal Bank" : "Bank"),
            paidBy: initialData.paidBy || "",
            partyName: initialData.partyName || "",
            invoiceOrderId: initialData.invoiceOrderId || "",
            gstApplicable: !!initialData.gstApplicable,
            gstAmount: String(initialData.gstAmount || 0),
            tdsTcsAmount: String(initialData.tdsTcsAmount || 0),
            remarks: initialData.remarks || "",
          }
        : {
            origin: defaultOrigin,
            entryType: "DEBIT",
            amount: "",
            date: new Date().toISOString().slice(0, 10),
            description: "",
            category: defaultOrigin === "PRE_COMPANY" ? "Registration Expense" : "",
            paymentMode: defaultOrigin === "PRE_COMPANY" ? "UPI" : "Bank Transfer",
            bankOrCash: defaultOrigin === "PRE_COMPANY" ? "Personal Bank" : "Bank",
            paidBy: "",
            partyName: "",
            invoiceOrderId: "",
            gstApplicable: false,
            gstAmount: "0",
            tdsTcsAmount: "0",
            remarks: "",
          };

      setInitialSnapshot(snap);
      setShowDiscardConfirm(false);

      setOrigin(snap.origin);
      setEntryType(snap.entryType);
      setAmount(snap.amount);
      setDate(snap.date);
      setDescription(snap.description);
      setCategory(snap.category);
      setPaymentMode(snap.paymentMode);
      setBankOrCash(snap.bankOrCash);
      setPaidBy(snap.paidBy);
      setPartyName(snap.partyName);
      setInvoiceOrderId(snap.invoiceOrderId);
      setGstApplicable(snap.gstApplicable);
      setGstAmount(snap.gstAmount);
      setTdsTcsAmount(snap.tdsTcsAmount);
      setRemarks(snap.remarks);

      // Reset attachment state
      if (initialData?.attachment) {
        setExistingAttachment(initialData.attachment);
      } else {
        setExistingAttachment(null);
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setSelectedFile(null);
      setPreviewUrl(null);
      setFileError(null);
      setIsAttachmentRemoved(false);

      // Fetch dynamic categories
      fetch("/api/categories")
        .then((res) => res.json())
        .then((data: unknown) => {
          if (Array.isArray(data)) {
            setCategories(data as CategoryOption[]);
          }
        })
        .catch(() => {});
    } else {
      setShowDiscardConfirm(false);
    }
  }, [isOpen, initialData, defaultOrigin]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validMimes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    const validExts = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();

    if (!validMimes.includes(file.type.toLowerCase()) && !validExts.includes(ext)) {
      setFileError("Invalid format. Only JPG, JPEG, PNG, WEBP, and PDF files are accepted.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFileError(
        `File size exceeds 5 MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB). Please select a smaller file.`
      );
      return;
    }

    setFileError(null);
    setSelectedFile(file);
    setIsAttachmentRemoved(false);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    if (file.type.startsWith("image/") || [".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  };

  const handleRemoveSelectedFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setFileError(null);
  };

  const handleRemoveExistingAttachment = () => {
    setIsAttachmentRemoved(true);
  };

  const handleRestoreExistingAttachment = () => {
    setIsAttachmentRemoved(false);
  };

  // Compute accurate dirty state
  const isDirty = useMemo(() => {
    if (!initialSnapshot) return false;

    // Amount comparison
    const isAmountDirty = () => {
      const curTrim = amount.trim();
      const initTrim = initialSnapshot.amount.trim();
      if (curTrim === initTrim) return false;
      if (!curTrim || !initTrim) return true;
      const curNum = parseFloat(curTrim);
      const initNum = parseFloat(initTrim);
      if (isNaN(curNum) || isNaN(initNum)) return curTrim !== initTrim;
      return Math.abs(curNum - initNum) > 0.0001;
    };

    // GST amount comparison
    const isGstDirty = () => {
      if (gstApplicable !== initialSnapshot.gstApplicable) return true;
      if (!gstApplicable) return false;
      const curTrim = gstAmount.trim();
      const initTrim = initialSnapshot.gstAmount.trim();
      if (curTrim === initTrim) return false;
      const curNum = parseFloat(curTrim) || 0;
      const initNum = parseFloat(initTrim) || 0;
      return Math.abs(curNum - initNum) > 0.0001;
    };

    // TDS/TCS amount comparison
    const isTdsDirty = () => {
      if (gstApplicable !== initialSnapshot.gstApplicable) return true;
      if (!gstApplicable) return false;
      const curTrim = tdsTcsAmount.trim();
      const initTrim = initialSnapshot.tdsTcsAmount.trim();
      if (curTrim === initTrim) return false;
      const curNum = parseFloat(curTrim) || 0;
      const initNum = parseFloat(initTrim) || 0;
      return Math.abs(curNum - initNum) > 0.0001;
    };

    return (
      origin !== initialSnapshot.origin ||
      entryType !== initialSnapshot.entryType ||
      isAmountDirty() ||
      date !== initialSnapshot.date ||
      description.trim() !== initialSnapshot.description.trim() ||
      category.trim() !== initialSnapshot.category.trim() ||
      paymentMode !== initialSnapshot.paymentMode ||
      bankOrCash !== initialSnapshot.bankOrCash ||
      paidBy.trim() !== initialSnapshot.paidBy.trim() ||
      partyName.trim() !== initialSnapshot.partyName.trim() ||
      invoiceOrderId.trim() !== initialSnapshot.invoiceOrderId.trim() ||
      isGstDirty() ||
      isTdsDirty() ||
      remarks.trim() !== initialSnapshot.remarks.trim() ||
      Boolean(selectedFile) ||
      isAttachmentRemoved
    );
  }, [
    initialSnapshot,
    origin,
    entryType,
    amount,
    date,
    description,
    category,
    paymentMode,
    bankOrCash,
    paidBy,
    partyName,
    invoiceOrderId,
    gstApplicable,
    gstAmount,
    tdsTcsAmount,
    remarks,
    selectedFile,
    isAttachmentRemoved,
  ]);

  // Handle close attempts safely
  const handleAttemptClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  const handleConfirmDiscard = () => {
    setShowDiscardConfirm(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setFileError(null);
    setIsAttachmentRemoved(false);
    if (initialData?.attachment) {
      setExistingAttachment(initialData.attachment);
    } else {
      setExistingAttachment(null);
    }
    if (initialSnapshot) {
      setOrigin(initialSnapshot.origin);
      setEntryType(initialSnapshot.entryType);
      setAmount(initialSnapshot.amount);
      setDate(initialSnapshot.date);
      setDescription(initialSnapshot.description);
      setCategory(initialSnapshot.category);
      setPaymentMode(initialSnapshot.paymentMode);
      setBankOrCash(initialSnapshot.bankOrCash);
      setPaidBy(initialSnapshot.paidBy);
      setPartyName(initialSnapshot.partyName);
      setInvoiceOrderId(initialSnapshot.invoiceOrderId);
      setGstApplicable(initialSnapshot.gstApplicable);
      setGstAmount(initialSnapshot.gstAmount);
      setTdsTcsAmount(initialSnapshot.tdsTcsAmount);
      setRemarks(initialSnapshot.remarks);
    }
    onClose();
  };

  // Intercept Escape key when discard confirmation dialog is open
  useEffect(() => {
    if (!showDiscardConfirm) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        setShowDiscardConfirm(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [showDiscardConfirm]);

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

    const isDebit = entryType === "DEBIT";
    const debit = isDebit ? numericAmount : 0;
    const credit = !isDebit ? numericAmount : 0;

    let paymentSource = "Company Bank";
    if (bankOrCash === "Personal Bank") paymentSource = "Personal Bank";
    else if (bankOrCash === "Personal Cash") paymentSource = "Personal Cash";
    else if (bankOrCash === "Cash") paymentSource = "Company Cash";
    else if (bankOrCash === "N/A") paymentSource = "Other";

    const hasAttachment =
      isDebit &&
      (Boolean(selectedFile) || (Boolean(existingAttachment) && !isAttachmentRemoved));

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
      billAvailable: hasAttachment,
    };

    try {
      const url = initialData ? `/api/transactions/${initialData._id}` : "/api/transactions";
      const method = initialData ? "PATCH" : "POST";

      let res: Response;

      if (isDebit && selectedFile) {
        const formData = new FormData();
        formData.append("payload", JSON.stringify(payload));
        formData.append("billFile", selectedFile);
        if (isAttachmentRemoved) {
          formData.append("removeAttachment", "true");
        }
        res = await fetch(url, {
          method,
          body: formData,
        });
      } else {
        const finalPayload = {
          ...payload,
          attachment: isAttachmentRemoved ? null : undefined,
        };
        res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(finalPayload),
        });
      }

      const data = await res.json();
      if (!res.ok || (data.error && !data.success)) {
        throw new Error(data.error || "Failed to save transaction");
      }

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setSelectedFile(null);
      setPreviewUrl(null);
      setFileError(null);
      setIsAttachmentRemoved(false);

      toast.success(
        initialData
          ? "Transaction updated"
          : origin === "PRE_COMPANY"
          ? "Pre-Company transaction recorded successfully"
          : "Transaction added successfully"
      );
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save transaction";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const isPreCompany = origin === "PRE_COMPANY";

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleAttemptClose}
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
              onClick={() => {
                setEntryType("CREDIT");
                if (previewUrl) {
                  URL.revokeObjectURL(previewUrl);
                }
                setSelectedFile(null);
                setPreviewUrl(null);
                setFileError(null);
              }}
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
              <option value="CRED" />
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
            onChange={(e) =>
              setBankOrCash(e.target.value as "Bank" | "Cash" | "Personal Bank" | "Personal Cash" | "N/A")
            }
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

        {/* Supporting Bill / Receipt Upload - Display ONLY for Debit transactions */}
        {entryType === "DEBIT" && (
          <div className="space-y-2 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-blue-400" />
                Bill / Receipt (Optional)
              </label>
              <span className="text-[11px] text-slate-500">
                JPG, PNG, WEBP, PDF up to 5 MB
              </span>
            </div>

            {/* Case 1: A new file has been selected */}
            {selectedFile ? (
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/90 border border-blue-500/40">
                <div className="flex items-center gap-3 min-w-0">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Bill preview"
                      className="w-10 h-10 object-cover rounded-md border border-slate-700 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-md bg-rose-950/60 border border-rose-800/80 flex flex-col items-center justify-center shrink-0 text-rose-400">
                      <FileText className="w-5 h-5" />
                      <span className="text-[8px] font-bold uppercase tracking-tight">PDF</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate max-w-xs sm:max-w-md">
                      {selectedFile.name}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {(selectedFile.size / 1024).toFixed(1)} KB &bull;{" "}
                      {selectedFile.type || "Document"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveSelectedFile}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                  title="Remove selected file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : existingAttachment && !isAttachmentRemoved ? (
              /* Case 2: Editing a transaction with an existing attachment */
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/90 border border-slate-700">
                <div className="flex items-center gap-3 min-w-0">
                  {existingAttachment.mimeType === "application/pdf" ||
                  existingAttachment.originalName.endsWith(".pdf") ? (
                    <div className="w-10 h-10 rounded-md bg-rose-950/60 border border-rose-800/80 flex flex-col items-center justify-center shrink-0 text-rose-400">
                      <FileText className="w-5 h-5" />
                      <span className="text-[8px] font-bold uppercase tracking-tight">PDF</span>
                    </div>
                  ) : (
                    <img
                      src={existingAttachment.url}
                      alt="Current attachment"
                      className="w-10 h-10 object-cover rounded-md border border-slate-700 shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium text-white truncate max-w-xs">
                        {existingAttachment.originalName}
                      </p>
                      <a
                        href={existingAttachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 inline-flex items-center"
                        title="Open attachment in new tab"
                      >
                        <ExternalLink className="w-3 h-3 ml-0.5" />
                      </a>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {existingAttachment.size
                        ? `${(existingAttachment.size / 1024).toFixed(1)} KB`
                        : "Current Attachment"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer transition-colors border border-slate-700">
                    Replace
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleRemoveExistingAttachment}
                    className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Remove attachment"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : isAttachmentRemoved ? (
              /* Case 3: User marked existing attachment for removal */
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">
                <span className="text-xs">
                  Attachment will be removed upon saving.
                </span>
                <button
                  type="button"
                  onClick={handleRestoreExistingAttachment}
                  className="text-xs font-medium text-amber-200 hover:underline cursor-pointer"
                >
                  Undo
                </button>
              </div>
            ) : (
              /* Case 4: No file selected yet -> Show file picker button / drop target */
              <div>
                <label className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg border border-dashed border-slate-700 hover:border-slate-600 bg-slate-900/50 hover:bg-slate-900 text-slate-400 hover:text-slate-300 cursor-pointer transition-colors">
                  <Upload className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-medium">
                    Click to upload bill / receipt (JPG, PNG, WEBP, or PDF)
                  </span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              </div>
            )}

            {fileError && (
              <p className="text-xs text-rose-400 flex items-center gap-1 mt-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {fileError}
              </p>
            )}
          </div>
        )}

        {/* Remarks */}
        <Input
          label="Remarks / Notes"
          placeholder="e.g. Advance for company registration debited to Bizpole."
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Button type="button" variant="secondary" onClick={handleAttemptClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
          >
            {initialData
              ? "Update Transaction"
              : isPreCompany
              ? "Save Pre-Company Transaction"
              : "Save Transaction"}
          </Button>
        </div>
      </form>
    </Modal>

    {/* Confirmation Dialog before Discarding Unsaved Changes */}
    {showDiscardConfirm && (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dark Backdrop */}
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-xs transition-opacity animate-in fade-in"
          onClick={() => setShowDiscardConfirm(false)}
        />

        {/* Dialog Box */}
        <div
          className="relative w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl text-slate-100 z-10 animate-in zoom-in-95 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Discard Changes?</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Are you sure you want to discard the changes? Your unsaved changes will be lost.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowDiscardConfirm(false)}
            >
              Keep Editing
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleConfirmDiscard}
            >
              Discard Changes
            </Button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
