"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, Button, Badge, Modal, Input, Select } from "@/lib/ui";
import { FileText, UploadCloud, Download, Eye, RefreshCw, Paperclip } from "lucide-react";
import { formatIndianDate } from "@/lib/utils";
import { toast } from "sonner";

export default function BillsPage() {
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState("Purchase Invoices");
  const [relatedType, setRelatedType] = useState<"TRANSACTION" | "PURCHASE" | "EXPENSE">("PURCHASE");
  const [uploading, setUploading] = useState(false);

  const fetchBills = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bills");
      const data = await res.json();
      if (Array.isArray(data)) setBills(data);
    } catch {
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("Please select a file to upload");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("category", category);
      formData.append("relatedType", relatedType);

      const res = await fetch("/api/bills/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || (data.error && !data.success)) {
        throw new Error(data.error || "Failed to upload document");
      }

      toast.success("Bill / Document uploaded successfully");
      setIsUploadModalOpen(false);
      setSelectedFile(null);
      fetchBills();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Bills & Document Repository
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Store, view, and link purchase tax invoices, rent agreements, electricity receipts, and logistics bills
            </p>
          </div>

          <Button variant="primary" onClick={() => setIsUploadModalOpen(true)}>
            <UploadCloud className="w-4 h-4 mr-1.5" />
            Upload Document
          </Button>
        </div>

        <Card className="overflow-hidden border-slate-800 bg-slate-900/70">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Document / File</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Size</th>
                  <th className="py-3 px-3">Upload Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
                      Loading document repository...
                    </td>
                  </tr>
                ) : bills.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                      <p className="text-sm font-medium">No documents uploaded yet.</p>
                      <Button
                        size="sm"
                        variant="primary"
                        className="mt-3"
                        onClick={() => setIsUploadModalOpen(true)}
                      >
                        <UploadCloud className="w-3.5 h-3.5 mr-1" />
                        Upload First Document
                      </Button>
                    </td>
                  </tr>
                ) : (
                  bills.map((b) => (
                    <tr key={b._id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-medium text-white">
                        <div className="flex items-center gap-2">
                          <Paperclip className="w-4 h-4 text-blue-400 shrink-0" />
                          <span className="truncate max-w-sm">{b.originalName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="secondary" className="text-[10px]">
                          {b.category || "General"}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400 uppercase text-[10px]">
                        {b.mimeType.split("/")[1] || b.mimeType}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400">
                        {(b.size / 1024).toFixed(1)} KB
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-slate-400">
                        {formatIndianDate(b.createdAt, { withTime: true })}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <a
                          href={b.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View / Download</span>
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Upload Modal */}
        <Modal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          title="Upload Bill or Receipt"
          description="Upload tax invoice PDF or receipts (Max 15MB, PDF, JPG, PNG)"
        >
          <form onSubmit={handleUpload} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="block text-slate-300 font-medium">Select File *</label>
              <input
                type="file"
                accept=".pdf, .jpg, .jpeg, .png, .webp"
                required
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSelectedFile(e.target.files[0]);
                  }
                }}
                className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
              />
            </div>

            <Select
              label="Document Classification"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={[
                { label: "Purchase Tax Invoice", value: "Purchase Invoices" },
                { label: "Office Rent Agreement / Receipt", value: "Rent Receipts" },
                { label: "Utility Bill (Electricity/Internet)", value: "Utility Bills" },
                { label: "Logistics & Freight Invoice", value: "Logistics Invoices" },
                { label: "Other Business Document", value: "Other" },
              ]}
            />

            <Select
              label="Associated Module"
              value={relatedType}
              onChange={(e) => setRelatedType(e.target.value as any)}
              options={[
                { label: "Purchases Inward", value: "PURCHASE" },
                { label: "General Operational Transaction", value: "TRANSACTION" },
                { label: "Expense Receipt", value: "EXPENSE" },
              ]}
            />

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <Button type="button" variant="secondary" onClick={() => setIsUploadModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={uploading}>
                Upload Document
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
}
