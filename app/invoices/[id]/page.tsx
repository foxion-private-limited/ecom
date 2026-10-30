"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Modal,
} from "@/lib/ui";
import {
  FileText,
  Download,
  ArrowLeft,
  RefreshCw,
  Send,
  Ban,
  Trash2,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Copy,
  ExternalLink,
  CheckCircle2,
  Image as ImageIcon,
  Clock,
  User,
  Hash,
} from "lucide-react";
import { toast } from "sonner";
import { formatINR, formatIndianDate } from "@/lib/utils";

interface InvoiceData {
  _id: string;
  mode: "TEST" | "PRODUCTION";
  status: "DRAFT" | "ISSUED" | "CANCELLED";
  serialNumber?: string;
  financialYear?: string;
  invoiceDate: string;
  sellerSnapshot?: {
    legalName: string;
    tradeName?: string;
    gstin?: string;
    phone?: string;
    email?: string;
    address: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      stateCode: string;
      pincode?: string;
    };
  };
  buyer: {
    name: string;
    type: string;
    gstin?: string;
    billingAddress: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      stateCode: string;
      pincode?: string;
    };
    phone?: string;
    email?: string;
    placeOfSupply: string;
    placeOfSupplyCode: string;
  };
  platform?: string;
  marketplaceOrderId?: string;
  taxTreatment: string;
  lineItems: {
    description: string;
    hsnSac: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    taxableValue: number;
    gstRate: number;
    gstAmount: number;
    lineTotal: number;
  }[];
  taxSummary?: {
    taxableSubtotal: number;
    totalDiscount: number;
    cgstTotal: number;
    sgstTotal: number;
    igstTotal: number;
    totalGst: number;
    grossTotal: number;
    roundOff: number;
    amountPayable: number;
    amountInWords: string;
  };
  pdfGridFsId?: string;
  pdfChecksum?: string;
  pdfFilename?: string;
  pngGridFsIds?: string[];
  issuedAt?: string;
  issuedBy?: string;
  cancellation?: {
    cancelledAt: string;
    cancelledBy: string;
    reason: string;
  };
  templateVersion?: string;
  createdAt: string;
}

export default function InvoiceDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);

  // Cancellation modal
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const fetchInvoice = async () => {
    try {
      const res = await fetch(`/api/invoices/${id}`);
      const data = await res.json();
      if (data.success && data.invoice) {
        setInvoice(data.invoice);
      } else {
        toast.error(data.error || "Invoice not found");
      }
    } catch {
      toast.error("Network error loading invoice");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  const handleIssue = async () => {
    setIssuing(true);
    try {
      const res = await fetch(`/api/invoices/${id}/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exportPng: true }),
      });
      let data: { success?: boolean; message?: string; error?: string } = {};
      try {
        const text = await res.text();
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Server returned error (${res.status})`);
      }
      if (data.success) {
        toast.success(data.message || "Invoice issued successfully");
        fetchInvoice();
      } else {
        toast.error(data.error || "Failed to issue invoice");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error while issuing invoice";
      toast.error(msg);
    } finally {
      setIssuing(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error("Cancellation reason is required");
      return;
    }
    setCancelling(true);
    try {
      const res = await fetch(`/api/invoices/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Invoice cancelled");
        setCancelModalOpen(false);
        fetchInvoice();
      } else {
        toast.error(data.error || "Failed to cancel invoice");
      }
    } catch {
      toast.error("Network error while cancelling");
    } finally {
      setCancelling(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!confirm("Are you sure you want to delete this draft invoice?")) return;
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Draft invoice deleted");
        router.push("/invoices");
      } else {
        toast.error(data.error || "Failed to delete draft");
      }
    } catch {
      toast.error("Network error while deleting draft");
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mb-3 text-indigo-400" />
          <p>Loading invoice details...</p>
        </div>
      </AppLayout>
    );
  }

  if (!invoice) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <h2 className="text-xl font-bold text-white mb-2">Invoice Not Found</h2>
          <p className="text-slate-400 text-sm mb-4">The requested invoice ID does not exist.</p>
          <Link href="/invoices">
            <Button variant="outline" size="sm">
              Back to Invoices
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const isTest = invoice.mode === "TEST";
  const isDraft = invoice.status === "DRAFT";
  const isIssued = invoice.status === "ISSUED";
  const isCancelled = invoice.status === "CANCELLED";

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <Link href="/invoices">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 text-slate-400 hover:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-white font-mono">
                  {invoice.serialNumber || "Draft Invoice"}
                </h1>
                {isTest ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    TEST INVOICE
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    PRODUCTION
                  </span>
                )}
                {isIssued && <Badge variant="success">Issued</Badge>}
                {isDraft && <Badge variant="warning">Draft</Badge>}
                {isCancelled && <Badge variant="danger">Cancelled</Badge>}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Created on {formatIndianDate(invoice.createdAt)} &bull; FY{" "}
                {invoice.financialYear || "—"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Draft actions */}
            {isDraft && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDeleteDraft}
                  className="border-slate-800 text-rose-400 hover:bg-rose-500/10 gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Draft
                </Button>

                <Button
                  size="sm"
                  disabled={issuing}
                  onClick={handleIssue}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 font-medium"
                >
                  <Send className="w-4 h-4" />
                  {issuing
                    ? "Issuing..."
                    : isTest
                    ? "Issue Test Document"
                    : "Issue Official Invoice"}
                </Button>
              </>
            )}

            {/* Issued actions */}
            {isIssued && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCancelModalOpen(true)}
                className="border-rose-500/30 text-rose-300 hover:bg-rose-500/10 gap-1.5"
              >
                <Ban className="w-4 h-4" />
                Cancel Invoice
              </Button>
            )}

            {/* Canonical PDF Download */}
            <a
              href={`/api/invoices/${invoice._id}/pdf?download=true`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-colors"
            >
              <Download className="w-4 h-4 text-indigo-400" />
              Download PDF
            </a>

            {/* PNG export */}
            <a
              href={`/api/invoices/${invoice._id}/png?download=true`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            >
              <ImageIcon className="w-4 h-4 text-sky-400" />
              Export PNG
            </a>
          </div>
        </div>

        {/* Status Alert Banners */}
        {isCancelled && invoice.cancellation && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-xs text-rose-300">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-rose-200">This Invoice Has Been Cancelled</p>
              <p className="mt-1 text-slate-300">
                Cancelled on {formatIndianDate(invoice.cancellation.cancelledAt)} by{" "}
                <span className="font-medium text-white">{invoice.cancellation.cancelledBy}</span>.
              </p>
              <p className="mt-1 text-slate-400">
                Reason: &ldquo;{invoice.cancellation.reason}&rdquo;
              </p>
              <p className="mt-1 text-[11px] text-rose-400 font-mono">
                The original invoice data and archived PDF remain permanently preserved for GST audit trails.
              </p>
            </div>
          </div>
        )}

        {isTest && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-300">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-200">Test Invoice Notice</p>
              <p className="mt-0.5 text-slate-300">
                This is a test invoice created under Foxion&apos;s testing workflow. All generated PDFs and PNGs carry an immutable test watermark:
                <strong className="block text-amber-400 font-mono mt-0.5">
                  &ldquo;TEST INVOICE — NOT VALID FOR GST CLAIM OR FILING&rdquo;
                </strong>
              </p>
            </div>
          </div>
        )}

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Embedded HTML Preview */}
          <div className="lg:col-span-8 space-y-4">
            <Card className="bg-slate-900 border-slate-800 overflow-hidden shadow-2xl">
              <div className="p-3 bg-slate-950 border-b border-slate-800 flex justify-between items-center text-xs text-slate-400">
                <span className="flex items-center gap-2 font-medium">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  Canonical Rendered Document
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/invoices/${invoice._id}?html=true`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white flex items-center gap-1 text-[11px]"
                  >
                    Open Full View <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="bg-slate-950/60 p-2 sm:p-4 flex justify-center">
                <iframe
                  src={`/api/invoices/${invoice._id}?html=true`}
                  title="Invoice Document"
                  className="w-full bg-white rounded shadow-lg border border-slate-700"
                  style={{ minHeight: "850px" }}
                />
              </div>
            </Card>
          </div>

          {/* Right Column: Metadata & Audit Trail */}
          <div className="lg:col-span-4 space-y-4">
            {/* Summary card */}
            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader className="py-3 px-4 border-b border-slate-800">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Invoice Financial Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Taxable Subtotal:</span>
                  <span className="font-mono font-medium">
                    {formatINR(invoice.taxSummary?.taxableSubtotal || 0)}
                  </span>
                </div>
                {invoice.taxSummary?.totalDiscount && invoice.taxSummary.totalDiscount > 0 ? (
                  <div className="flex justify-between text-slate-300">
                    <span>Discount:</span>
                    <span className="font-mono text-emerald-400">
                      -{formatINR(invoice.taxSummary.totalDiscount)}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between text-slate-300">
                  <span>Total GST:</span>
                  <span className="font-mono text-indigo-300 font-medium">
                    {formatINR(invoice.taxSummary?.totalGst || 0)}
                  </span>
                </div>
                {invoice.taxSummary?.roundOff && invoice.taxSummary.roundOff !== 0 ? (
                  <div className="flex justify-between text-slate-400">
                    <span>Round-off:</span>
                    <span className="font-mono">
                      {invoice.taxSummary.roundOff > 0 ? "+" : ""}
                      {formatINR(invoice.taxSummary.roundOff)}
                    </span>
                  </div>
                ) : null}
                <div className="border-t border-slate-800 pt-2 flex justify-between text-sm font-bold text-white">
                  <span>Amount Payable:</span>
                  <span className="font-mono text-emerald-300">
                    {formatINR(invoice.taxSummary?.amountPayable || 0)}
                  </span>
                </div>
                {invoice.taxSummary?.amountInWords && (
                  <div className="mt-2 p-2.5 rounded bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-300">
                    <span className="block text-slate-500 text-[10px] font-semibold uppercase">
                      In Words:
                    </span>
                    {invoice.taxSummary.amountInWords}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Buyer Snapshot */}
            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader className="py-3 px-4 border-b border-slate-800">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Buyer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2 text-xs text-slate-300">
                <div className="font-bold text-white text-sm">{invoice.buyer.name}</div>
                <div>{invoice.buyer.billingAddress.line1}</div>
                <div>
                  {invoice.buyer.billingAddress.city}, {invoice.buyer.billingAddress.state} —{" "}
                  {invoice.buyer.billingAddress.stateCode}
                </div>
                {invoice.buyer.gstin && (
                  <div className="font-mono text-indigo-300 font-semibold">
                    GSTIN: {invoice.buyer.gstin}
                  </div>
                )}
                {invoice.buyer.phone && <div>📞 {invoice.buyer.phone}</div>}
                {invoice.buyer.email && <div>✉ {invoice.buyer.email}</div>}
                <div className="pt-1 text-[11px] text-slate-400">
                  Place of Supply: <strong>{invoice.buyer.placeOfSupply}</strong> (
                  {invoice.buyer.placeOfSupplyCode})
                </div>
              </CardContent>
            </Card>

            {/* Archival & Storage Info */}
            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader className="py-3 px-4 border-b border-slate-800">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  GridFS Archival Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2.5 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>Storage:</span>
                  <span className="font-mono text-slate-200">MongoDB GridFS</span>
                </div>
                <div className="flex justify-between">
                  <span>PDF Bucket:</span>
                  <span className="font-mono text-slate-200">taxinvoicepdfs</span>
                </div>
                {invoice.pdfGridFsId && (
                  <div>
                    <span className="block text-slate-500 text-[10px]">GridFS File ID:</span>
                    <span className="font-mono text-slate-300 text-[11px] break-all select-all">
                      {invoice.pdfGridFsId.toString()}
                    </span>
                  </div>
                )}
                {invoice.pdfChecksum && (
                  <div>
                    <span className="block text-slate-500 text-[10px]">SHA-256 Checksum:</span>
                    <span className="font-mono text-slate-300 text-[11px] break-all select-all">
                      {invoice.pdfChecksum}
                    </span>
                  </div>
                )}
                {invoice.issuedAt && (
                  <div className="flex justify-between pt-1">
                    <span>Issued At:</span>
                    <span className="text-slate-300 font-mono text-[11px]">
                      {new Date(invoice.issuedAt).toLocaleString("en-IN")}
                    </span>
                  </div>
                )}
                {invoice.issuedBy && (
                  <div className="flex justify-between">
                    <span>Issued By:</span>
                    <span className="text-slate-300">{invoice.issuedBy}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Template Version:</span>
                  <span className="font-mono text-slate-300">
                    {invoice.templateVersion || "1.0"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Cancellation Modal */}
        <Modal
          isOpen={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
          title={`Cancel Invoice ${invoice.serialNumber}`}
        >
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              <strong>Permanent Record:</strong> Once cancelled, this invoice number cannot be
              reused, and the cancellation reason is permanently logged.
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Cancellation Reason <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="State the reason for cancelling this issued tax invoice..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancelModalOpen(false)}
                className="border-slate-700"
              >
                Close
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={cancelling || !cancelReason.trim()}
                onClick={handleCancel}
                className="bg-rose-600 hover:bg-rose-700 text-white font-medium"
              >
                {cancelling ? "Cancelling..." : "Confirm Cancellation"}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AppLayout>
  );
}
