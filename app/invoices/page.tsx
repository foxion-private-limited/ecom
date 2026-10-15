"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Input,
  Select,
  Modal,
} from "@/lib/ui";
import {
  FileText,
  Plus,
  Search,
  Download,
  Eye,
  Settings,
  AlertTriangle,
  RefreshCw,
  Ban,
  Trash2,
  FileDown,
  ShieldAlert,
  Calendar,
  Layers,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { formatINR, formatIndianDate } from "@/lib/utils";

interface InvoiceListItem {
  _id: string;
  mode: "TEST" | "PRODUCTION";
  status: "DRAFT" | "ISSUED" | "CANCELLED";
  serialNumber?: string;
  financialYear?: string;
  invoiceDate: string;
  buyer: {
    name: string;
    type: string;
    placeOfSupply: string;
    placeOfSupplyCode: string;
  };
  platform?: string;
  marketplaceOrderId?: string;
  taxSummary?: {
    taxableSubtotal: number;
    totalGst: number;
    amountPayable: number;
  };
  pdfGridFsId?: string;
  pngGridFsIds?: string[];
  createdAt: string;
}

interface InvoiceStats {
  totalInvoices: number;
  productionIssuedCount: number;
  productionIssuedAmount: number;
  testCount: number;
  draftCount: number;
  cancelledCount: number;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [stats, setStats] = useState<InvoiceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Cancellation modal state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancellingInvoice, setCancellingInvoice] = useState<InvoiceListItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "25",
        mode: modeFilter,
        status: statusFilter,
      });
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/invoices?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setInvoices(data.invoices || []);
        setTotalPages(data.totalPages || 1);
      } else {
        toast.error(data.error || "Failed to load invoices");
      }
    } catch {
      toast.error("Network error while loading invoices");
    } finally {
      setLoading(false);
    }
  }, [page, modeFilter, statusFilter, search]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/invoices?stats=true");
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleCancelClick = (invoice: InvoiceListItem) => {
    setCancellingInvoice(invoice);
    setCancelReason("");
    setCancelModalOpen(true);
  };

  const submitCancellation = async () => {
    if (!cancellingInvoice) return;
    if (!cancelReason.trim()) {
      toast.error("Please enter a cancellation reason");
      return;
    }

    setCancelling(true);
    try {
      const res = await fetch(`/api/invoices/${cancellingInvoice._id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Invoice cancelled");
        setCancelModalOpen(false);
        fetchInvoices();
        fetchStats();
      } else {
        toast.error(data.error || "Failed to cancel invoice");
      }
    } catch {
      toast.error("Network error while cancelling invoice");
    } finally {
      setCancelling(false);
    }
  };

  const handleDeleteDraft = async (id: string) => {
    if (!confirm("Are you sure you want to delete this draft invoice?")) return;

    try {
      const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Draft invoice deleted");
        fetchInvoices();
        fetchStats();
      } else {
        toast.error(data.error || "Failed to delete draft");
      }
    } catch {
      toast.error("Network error while deleting draft");
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <FileText className="w-7 h-7 text-indigo-400" />
                Tax Invoices
              </h1>
              <Badge variant="outline" className="border-indigo-500/30 text-indigo-300">
                Independent Module
              </Badge>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Create, preview, and permanently archive GST-compliant tax invoices with Playwright rendering and GridFS storage.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/settings/invoices">
              <Button variant="outline" size="sm" className="gap-2 border-slate-700 hover:bg-slate-800">
                <Settings className="w-4 h-4 text-slate-400" />
                Invoice Settings
              </Button>
            </Link>
            <Link href="/invoices/new">
              <Button size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium">
                <Plus className="w-4 h-4" />
                Create Invoice
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="bg-slate-900/60 border-slate-800">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-slate-400">Total Invoices</p>
                    <p className="text-2xl font-bold text-white mt-1">{stats.totalInvoices}</p>
                  </div>
                  <Layers className="w-5 h-5 text-slate-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/60 border-slate-800">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-emerald-400">Production Issued</p>
                    <p className="text-2xl font-bold text-white mt-1">{stats.productionIssuedCount}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatINR(stats.productionIssuedAmount)}</p>
                  </div>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/60 border-slate-800">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-amber-400">Test Invoices</p>
                    <p className="text-2xl font-bold text-white mt-1">{stats.testCount}</p>
                    <p className="text-[11px] text-amber-500/80 mt-0.5">Watermarked test documents</p>
                  </div>
                  <ShieldAlert className="w-5 h-5 text-amber-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/60 border-slate-800">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-blue-400">Draft Invoices</p>
                    <p className="text-2xl font-bold text-white mt-1">{stats.draftCount}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Unallocated sequences</p>
                  </div>
                  <FileText className="w-5 h-5 text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/60 border-slate-800 col-span-2 lg:col-span-1">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-rose-400">Cancelled</p>
                    <p className="text-2xl font-bold text-white mt-1">{stats.cancelledCount}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Audited & preserved</p>
                  </div>
                  <Ban className="w-5 h-5 text-rose-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filter & Search Bar */}
        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by invoice number, customer name, marketplace order ID, AWB..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                {/* Mode Filter */}
                <div className="w-36">
                  <Select
                    value={modeFilter}
                    onChange={(e) => {
                      setModeFilter(e.target.value);
                      setPage(1);
                    }}
                    options={[
                      { value: "ALL", label: "All Modes" },
                      { value: "PRODUCTION", label: "Production" },
                      { value: "TEST", label: "Test Mode" },
                    ]}
                  />
                </div>

                {/* Status Filter */}
                <div className="w-36">
                  <Select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                    options={[
                      { value: "ALL", label: "All Statuses" },
                      { value: "ISSUED", label: "Issued" },
                      { value: "DRAFT", label: "Draft" },
                      { value: "CANCELLED", label: "Cancelled" },
                    ]}
                  />
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    fetchInvoices();
                    fetchStats();
                  }}
                  className="border-slate-800 hover:bg-slate-800 text-slate-300"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoice List Table */}
        <Card className="bg-slate-900/60 border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Invoice No.</th>
                  <th className="py-3.5 px-4 font-semibold">Date</th>
                  <th className="py-3.5 px-4 font-semibold">Mode</th>
                  <th className="py-3.5 px-4 font-semibold">Customer</th>
                  <th className="py-3.5 px-4 font-semibold">Platform &amp; Ref</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Taxable</th>
                  <th className="py-3.5 px-4 font-semibold text-right">GST</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Amount</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                      Loading tax invoices...
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                      No tax invoices found matching criteria.
                      <div className="mt-2">
                        <Link href="/invoices/new">
                          <Button size="sm" variant="outline" className="text-xs border-slate-700">
                            Create First Invoice
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => {
                    const isTest = inv.mode === "TEST";
                    return (
                      <tr key={inv._id} className="hover:bg-slate-800/40 transition-colors">
                        {/* Serial Number */}
                        <td className="py-3.5 px-4 font-medium text-white">
                          <Link
                            href={`/invoices/${inv._id}`}
                            className="hover:text-indigo-400 transition-colors font-mono"
                          >
                            {inv.serialNumber || (
                              <span className="text-slate-500 italic">Draft</span>
                            )}
                          </Link>
                          {inv.financialYear && (
                            <span className="text-[11px] text-slate-500 block">
                              FY {inv.financialYear}
                            </span>
                          )}
                        </td>

                        {/* Date */}
                        <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                          {formatIndianDate(inv.invoiceDate)}
                        </td>

                        {/* Mode */}
                        <td className="py-3.5 px-4">
                          {isTest ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                              TEST
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              PROD
                            </span>
                          )}
                        </td>

                        {/* Customer */}
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-white truncate max-w-[180px]">
                            {inv.buyer.name}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {inv.buyer.placeOfSupply} ({inv.buyer.placeOfSupplyCode})
                          </div>
                        </td>

                        {/* Platform */}
                        <td className="py-3.5 px-4 text-xs">
                          {inv.platform ? (
                            <span className="font-medium text-slate-300">{inv.platform}</span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                          {inv.marketplaceOrderId && (
                            <span className="text-[11px] text-slate-500 block truncate max-w-[140px] font-mono">
                              #{inv.marketplaceOrderId}
                            </span>
                          )}
                        </td>

                        {/* Taxable */}
                        <td className="py-3.5 px-4 text-right font-mono text-xs">
                          {formatINR(inv.taxSummary?.taxableSubtotal || 0)}
                        </td>

                        {/* GST */}
                        <td className="py-3.5 px-4 text-right font-mono text-xs text-indigo-300">
                          {formatINR(inv.taxSummary?.totalGst || 0)}
                        </td>

                        {/* Amount Payable */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                          {formatINR(inv.taxSummary?.amountPayable || 0)}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center">
                          {inv.status === "ISSUED" && (
                            <Badge variant="success" className="text-[11px]">
                              Issued
                            </Badge>
                          )}
                          {inv.status === "DRAFT" && (
                            <Badge variant="warning" className="text-[11px]">
                              Draft
                            </Badge>
                          )}
                          {inv.status === "CANCELLED" && (
                            <Badge variant="danger" className="text-[11px]">
                              Cancelled
                            </Badge>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link href={`/invoices/${inv._id}`} title="View Invoice">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </Link>

                            {/* Download PDF button */}
                            <a
                              href={`/api/invoices/${inv._id}/pdf?download=true`}
                              title="Download PDF"
                              className="inline-flex items-center justify-center h-8 w-8 rounded-md text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
                            >
                              <Download className="w-4 h-4" />
                            </a>

                            {/* PNG Export */}
                            {inv.status === "ISSUED" && (
                              <a
                                href={`/api/invoices/${inv._id}/png?download=true`}
                                title="Export PNG"
                                className="inline-flex items-center justify-center h-8 w-8 rounded-md text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition-colors"
                              >
                                <ImageIcon className="w-4 h-4" />
                              </a>
                            )}

                            {/* Draft deletion */}
                            {inv.status === "DRAFT" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Delete Draft"
                                onClick={() => handleDeleteDraft(inv._id)}
                                className="h-8 w-8 p-0 text-slate-500 hover:text-rose-400"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}

                            {/* Cancel Issued */}
                            {inv.status === "ISSUED" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Cancel Invoice"
                                onClick={() => handleCancelClick(inv)}
                                className="h-8 w-8 p-0 text-slate-500 hover:text-rose-400"
                              >
                                <Ban className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
              <div>
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="h-8 text-xs border-slate-800"
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-8 text-xs border-slate-800"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Cancellation Modal */}
        <Modal
          isOpen={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
          title={`Cancel Invoice ${cancellingInvoice?.serialNumber || ""}`}
        >
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <div>
                <strong>Audited Action:</strong> Cancelling an issued invoice preserves its
                permanent sequential number and canonical PDF archive for GST reporting. The
                number will not be reused.
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Reason for Cancellation <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Buyer requested cancellation before dispatch; duplicate entry; amendment required."
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
                onClick={submitCancellation}
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
