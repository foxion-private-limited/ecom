"use client";

import React, { useState, useEffect } from "react";
import { Modal, Button, Input, Select } from "@/lib/ui";
import { Plus, Trash2 } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { toast } from "sonner";

interface PurchaseItemRow {
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  purchasePrice: number;
  gstRate: number;
  gstAmount: number;
  total: number;
}

export function PurchaseFormModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [supplierName, setSupplierName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMode, setPaymentMode] = useState("Bank Transfer");
  const [paymentStatus, setPaymentStatus] = useState<"PAID" | "PENDING">("PAID");
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);

  const [products, setProducts] = useState<any[]>([]);
  const [items, setItems] = useState<PurchaseItemRow[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Reset form
      setSupplierName("");
      setInvoiceNumber(`INV-${Date.now().toString().slice(-6)}`);
      setDate(new Date().toISOString().slice(0, 10));
      setPaymentMode("Bank Transfer");
      setPaymentStatus("PAID");
      setRemarks("");

      // Fetch products
      fetch("/api/products?limit=200")
        .then((res) => res.json())
        .then((data) => {
          if (data.products && data.products.length > 0) {
            setProducts(data.products);
            // Default first item row
            const first = data.products[0];
            const price = first.purchasePrice || 0;
            const gstRate = first.gstPercentage || 18;
            const gstAmount = (price * 10 * gstRate) / 100;
            setItems([
              {
                productId: first._id,
                sku: first.sku,
                productName: first.name,
                quantity: 10,
                purchasePrice: price,
                gstRate,
                gstAmount,
                total: price * 10 + gstAmount,
              },
            ]);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const handleProductSelect = (index: number, prodId: string) => {
    const prod = products.find((p) => p._id === prodId);
    if (!prod) return;

    setItems((prev) => {
      const updated = [...prev];
      const qty = updated[index].quantity || 1;
      const price = prod.purchasePrice || 0;
      const gstRate = prod.gstPercentage || 18;
      const sub = price * qty;
      const gstAmt = (sub * gstRate) / 100;

      updated[index] = {
        ...updated[index],
        productId: prod._id,
        sku: prod.sku,
        productName: prod.name,
        purchasePrice: price,
        gstRate,
        gstAmount: gstAmt,
        total: sub + gstAmt,
      };
      return updated;
    });
  };

  const handleQuantityChange = (index: number, qtyStr: string) => {
    const qty = parseInt(qtyStr, 10) || 1;
    setItems((prev) => {
      const updated = [...prev];
      const item = updated[index];
      const sub = item.purchasePrice * qty;
      const gstAmt = (sub * item.gstRate) / 100;

      updated[index] = {
        ...item,
        quantity: qty,
        gstAmount: gstAmt,
        total: sub + gstAmt,
      };
      return updated;
    });
  };

  const handlePriceChange = (index: number, priceStr: string) => {
    const price = parseFloat(priceStr) || 0;
    setItems((prev) => {
      const updated = [...prev];
      const item = updated[index];
      const sub = price * item.quantity;
      const gstAmt = (sub * item.gstRate) / 100;

      updated[index] = {
        ...item,
        purchasePrice: price,
        gstAmount: gstAmt,
        total: sub + gstAmt,
      };
      return updated;
    });
  };

  const addItemRow = () => {
    if (products.length === 0) return;
    const prod = products[0];
    const price = prod.purchasePrice || 0;
    const gstRate = prod.gstPercentage || 18;
    const gstAmt = (price * 10 * gstRate) / 100;

    setItems((prev) => [
      ...prev,
      {
        productId: prod._id,
        sku: prod.sku,
        productName: prod.name,
        quantity: 10,
        purchasePrice: price,
        gstRate,
        gstAmount: gstAmt,
        total: price * 10 + gstAmt,
      },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((acc, curr) => acc + curr.purchasePrice * curr.quantity, 0);
  const totalGst = items.reduce((acc, curr) => acc + curr.gstAmount, 0);
  const totalAmount = subtotal + totalGst;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim() || !invoiceNumber.trim() || items.length === 0) {
      toast.error("Please fill in supplier name, invoice number, and at least one item");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierName: supplierName.trim(),
          invoiceNumber: invoiceNumber.trim(),
          date: new Date(date),
          paymentMode,
          paymentStatus,
          items,
          remarks: remarks.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || (data.error && !data.success)) {
        throw new Error(data.error || "Failed to record purchase");
      }

      toast.success("Purchase recorded! Stock incremented & Main accounts transaction logged.");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to record purchase");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Purchase (Inward Stock)"
      description="Increases inventory stock, creates stock movement records, and creates a Main Accounts debit transaction"
      maxWidth="4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Supplier / Vendor Name *"
            required
            placeholder="Supplier / Vendor name"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
          />

          <Input
            label="Invoice Number *"
            required
            placeholder="Invoice number"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
          />

          <Input
            label="Purchase Date *"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Payment Mode"
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value)}
            options={[
              { label: "Bank Transfer", value: "Bank Transfer" },
              { label: "UPI", value: "UPI" },
              { label: "Cash", value: "Cash" },
              { label: "Card", value: "Card" },
            ]}
          />

          <Select
            label="Payment Status"
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value as any)}
            options={[
              { label: "Paid (Debits Main Account)", value: "PAID" },
              { label: "Pending (Credit Purchase)", value: "PENDING" },
            ]}
          />
        </div>

        {/* Dynamic Items Table */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white uppercase tracking-wider">
              Purchase Items
            </span>
            <Button type="button" size="sm" variant="outline" onClick={addItemRow}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Product Row
            </Button>
          </div>

          <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/40">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase">
                <tr>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3 text-right">Quantity</th>
                  <th className="py-2.5 px-3 text-right">Unit Cost (₹)</th>
                  <th className="py-2.5 px-3 text-right">GST %</th>
                  <th className="py-2.5 px-3 text-right">Total (₹)</th>
                  <th className="py-2.5 px-2 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2 px-3">
                      <select
                        value={item.productId}
                        onChange={(e) => handleProductSelect(idx, e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-xs"
                      >
                        {products.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-300">
                      {item.sku}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(idx, e.target.value)}
                        className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-right text-white font-mono text-xs"
                      />
                    </td>
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.purchasePrice}
                        onChange={(e) => handlePriceChange(idx, e.target.value)}
                        className="w-24 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-right text-white font-mono text-xs"
                      />
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-300">
                      {item.gstRate}%
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">
                      {formatINR(item.total)}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        disabled={items.length <= 1}
                        className="p-1 text-slate-500 hover:text-rose-400 disabled:opacity-30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Summary */}
        <div className="flex flex-col items-end gap-1.5 p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs">
          <div className="flex justify-between w-64 text-slate-400">
            <span>Subtotal (Net):</span>
            <span className="font-mono text-white">{formatINR(subtotal)}</span>
          </div>
          <div className="flex justify-between w-64 text-slate-400">
            <span>Total GST:</span>
            <span className="font-mono text-white">{formatINR(totalGst)}</span>
          </div>
          <div className="flex justify-between w-64 pt-1.5 border-t border-slate-800 font-bold text-sm">
            <span className="text-slate-200">Total Inward Cost:</span>
            <span className="font-mono text-emerald-400">{formatINR(totalAmount)}</span>
          </div>
        </div>

        <Input
          label="Remarks"
          placeholder="e.g. Batch #2026-B or PO reference"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            Save Purchase & Update Stock
          </Button>
        </div>
      </form>
    </Modal>
  );
}
