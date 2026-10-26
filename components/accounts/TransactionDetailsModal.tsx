"use client";

import React from "react";
import { Modal, Button, Badge } from "@/lib/ui";
import {
  Calendar,
  CreditCard,
  Building,
  User,
  FileText,
  Tag,
  Paperclip,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Hash,
  Layers,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { formatINR, formatIndianDate } from "@/lib/utils";

interface TransactionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: any | null;
}

export function TransactionDetailsModal({
  isOpen,
  onClose,
  transaction,
}: TransactionDetailsModalProps) {
  if (!transaction) return null;

  const isDebit = transaction.debit > 0;
  const isCredit = transaction.credit > 0;
  const isPreCompany = transaction.transactionOrigin === "PRE_COMPANY";
  const amount = isDebit ? transaction.debit : transaction.credit;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transaction Details"
      description={`Reference: #${transaction._id ? String(transaction._id).slice(-8).toUpperCase() : "N/A"}`}
      maxWidth="2xl"
    >
      <div className="space-y-5 text-xs text-slate-200">
        {/* Main Hero Banner: Amount & Flow */}
        <div
          className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            isDebit
              ? "bg-rose-950/30 border-rose-800/60 text-rose-300"
              : "bg-emerald-950/30 border-emerald-800/60 text-emerald-300"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-xl ${
                isDebit
                  ? "bg-rose-900/50 text-rose-300 border border-rose-700/60"
                  : "bg-emerald-900/50 text-emerald-300 border border-emerald-700/60"
              }`}
            >
              {isDebit ? (
                <ArrowUpRight className="w-6 h-6" />
              ) : (
                <ArrowDownLeft className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  {isDebit ? "Debit (Expense / Outflow)" : "Credit (Inflow / Income)"}
                </span>
                <Badge
                  variant={isPreCompany ? "warning" : "info"}
                  className="text-[10px] py-0 px-2"
                >
                  {isPreCompany ? "Pre-Company" : "Accounts Ledger"}
                </Badge>
              </div>
              <p className="text-2xl font-bold font-mono tracking-tight text-white mt-0.5">
                {formatINR(amount)}
              </p>
            </div>
          </div>

          {transaction.calculatedBalance !== undefined && (
            <div className="sm:text-right border-t sm:border-t-0 sm:border-l border-slate-800 pt-2 sm:pt-0 sm:pl-4">
              <span className="text-[11px] text-slate-400 block uppercase tracking-wider">
                Running Balance
              </span>
              <span className="text-base font-bold font-mono text-slate-200 mt-0.5 block">
                {formatINR(transaction.calculatedBalance)}
              </span>
            </div>
          )}
        </div>

        {/* Section 1: Transaction Information */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            General Narration & Accounting Classification
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <span className="text-[11px] text-slate-400 block mb-0.5">Description / Narration</span>
              <p className="font-semibold text-white text-sm leading-relaxed">
                {transaction.description || "—"}
              </p>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block mb-0.5">Transaction Date</span>
              <p className="font-medium text-slate-200 flex items-center gap-1.5 font-mono">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {formatIndianDate(transaction.date)}
              </p>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block mb-0.5">Category</span>
              <Badge variant="secondary" className="text-xs py-0.5 px-2.5">
                <Tag className="w-3 h-3 mr-1 text-slate-400" />
                {transaction.category || "General"}
              </Badge>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block mb-0.5">Party / Counterparty</span>
              <p className="font-medium text-slate-200">
                {transaction.partyName || "—"}
              </p>
            </div>

            {transaction.invoiceOrderId && (
              <div>
                <span className="text-[11px] text-slate-400 block mb-0.5">Invoice / Order ID</span>
                <p className="font-mono text-slate-200 font-semibold flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5 text-slate-400" />
                  #{transaction.invoiceOrderId}
                </p>
              </div>
            )}

            {transaction.remarks && (
              <div className="sm:col-span-2">
                <span className="text-[11px] text-slate-400 block mb-0.5">Remarks / Internal Notes</span>
                <p className="text-slate-300 italic bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  {transaction.remarks}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Payment & Banking Details */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-cyan-400" />
            Payment Channel & Account Source
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
            <div>
              <span className="text-[11px] text-slate-400 block mb-0.5">Payment Mode</span>
              <Badge variant="outline" className="text-xs py-0.5 px-2">
                {transaction.paymentMode || "Bank Transfer"}
              </Badge>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block mb-0.5">Payment Source</span>
              <Badge
                variant={
                  transaction.bankOrCash === "Personal Bank" ||
                  transaction.bankOrCash === "Personal Cash"
                    ? "warning"
                    : "info"
                }
                className="text-xs py-0.5 px-2 font-medium"
              >
                <Building className="w-3 h-3 mr-1" />
                {transaction.paymentSource || transaction.bankOrCash || "Company Bank"}
              </Badge>
            </div>

            {transaction.paidBy && (
              <div className="col-span-2 sm:col-span-1">
                <span className="text-[11px] text-slate-400 block mb-0.5">Paid By (Founder/Director)</span>
                <p className="font-semibold text-cyan-300 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                  {transaction.paidBy}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Tax & Compliance (GST, TDS, Bill) */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Taxation, Withholding & Supporting Bill
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-[11px] text-slate-400 block mb-0.5">GST Applicable</span>
              <Badge variant={transaction.gstApplicable ? "success" : "secondary"}>
                {transaction.gstApplicable ? "Yes" : "No"}
              </Badge>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block mb-0.5">GST Amount</span>
              <p className="font-mono font-medium text-slate-200">
                {transaction.gstAmount > 0 ? formatINR(transaction.gstAmount) : "₹0.00"}
              </p>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block mb-0.5">TDS / TCS</span>
              <p className="font-mono font-medium text-slate-200">
                {transaction.tdsTcsAmount > 0 ? formatINR(transaction.tdsTcsAmount) : "₹0.00"}
              </p>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block mb-0.5">Bill Document</span>
              <div className="flex items-center gap-1.5 text-slate-300">
                <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                {transaction.attachment?.url ? (
                  <a
                    href={transaction.attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 font-medium hover:underline inline-flex items-center gap-1"
                  >
                    Attached (View)
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span>{transaction.billAvailable ? "Marked as Available" : "Not Provided"}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Supporting Bill Document Attachment (Debit Transactions with a bill) */}
        {isDebit && transaction.attachment?.url && (
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-blue-400" />
                Supporting Bill / Receipt Attachment
              </h4>
              <a
                href={transaction.attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 hover:underline"
              >
                Open in new tab
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-lg bg-slate-900/80 border border-slate-800">
              <div className="flex items-center gap-3 min-w-0">
                {transaction.attachment.mimeType === "application/pdf" ||
                transaction.attachment.originalName?.toLowerCase().endsWith(".pdf") ? (
                  <div className="w-12 h-12 rounded-lg bg-rose-950/60 border border-rose-800/80 flex flex-col items-center justify-center shrink-0 text-rose-400">
                    <FileText className="w-6 h-6" />
                    <span className="text-[9px] font-bold uppercase">PDF</span>
                  </div>
                ) : (
                  <a
                    href={transaction.attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block shrink-0 group relative cursor-pointer"
                    title="Click to view full image"
                  >
                    <img
                      src={transaction.attachment.url}
                      alt={transaction.attachment.originalName || "Bill attachment"}
                      className="w-12 h-12 rounded-lg object-cover border border-slate-700 group-hover:opacity-80 transition-opacity"
                    />
                  </a>
                )}

                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate max-w-xs sm:max-w-md">
                    {transaction.attachment.originalName || "Bill Document"}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                    <span>
                      {transaction.attachment.size
                        ? `${(transaction.attachment.size / 1024).toFixed(1)} KB`
                        : "Attachment"}
                    </span>
                    <span>&bull;</span>
                    <span className="uppercase text-[10px] tracking-wide">
                      {transaction.attachment.mimeType === "application/pdf"
                        ? "PDF Document"
                        : "Image"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <a
                  href={transaction.attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                >
                  {transaction.attachment.mimeType === "application/pdf" ? (
                    <>
                      <FileText className="w-3.5 h-3.5" />
                      View / Open PDF
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-3.5 h-3.5" />
                      View Image
                    </>
                  )}
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Section 4: System Audit Trail */}
        <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/60 text-[11px] text-slate-400 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              <strong>Record ID:</strong> <span className="font-mono">{String(transaction._id || "")}</span>
            </span>
            <span>
              <strong>Source:</strong> {transaction.source || "MANUAL"}
            </span>
          </div>
          {transaction.importBatchId && (
            <div>
              <strong>Import Batch ID:</strong>{" "}
              <span className="font-mono text-slate-300">{transaction.importBatchId}</span>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
            <span>
              <strong>Created By:</strong> {transaction.createdBy || "System"}
            </span>
            {transaction.createdAt && (
              <span className="flex items-center gap-1 font-mono">
                <Clock className="w-3 h-3 text-slate-500" />
                Created: {formatIndianDate(transaction.createdAt, { withTime: true })}
              </span>
            )}
          </div>
        </div>

        {/* Close Button */}
        <div className="flex items-center justify-end pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
