"use client";

import React, { useState, useEffect } from "react";
import { Modal, Button, Input, Select } from "@/lib/ui";
import { Plus, Trash2 } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { toast } from "sonner";

interface OrderItemRow {
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  sellingPrice: number;
  discount: number;
  gstRate: number;
  gstAmount: number;
  total: number;
}

export function OrderFormModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [orderId, setOrderId] = useState("");
  const [platform, setPlatform] = useState("Amazon");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [shippingFee, setShippingFee] = useState("0");
  const [marketplaceFee, setMarketplaceFee] = useState("0");
  const [packagingFee, setPackagingFee] = useState("0");
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);

  const [products, setProducts] = useState<any[]>([]);
  const [items, setItems] = useState<OrderItemRow[]>([]);

  useEffect(() => {
    if (isOpen) {
      setOrderId(`${platform.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`);
      setDate(new Date().toISOString().slice(0, 10));
      setCustomerName("");
      setCustomerPhone("");
      setShippingFee("0");
      setMarketplaceFee("0");
      setPackagingFee("0");
      setRemarks("");

      fetch("/api/products?limit=200")
        .then((res) => res.json())
        .then((data) => {
          if (data.products && data.products.length > 0) {
            setProducts(data.products);
            const first = data.products[0];
            const price = first.sellingPrice || 0;
            const gstRate = first.gstPercentage || 18;
            const gstAmount = (price * 1 * gstRate) / (100 + gstRate);

            setItems([
              {
                productId: first._id,
                sku: first.sku,
                productName: first.name,
                quantity: 1,
                sellingPrice: price,
                discount: 0,
                gstRate,
                gstAmount: Math.round(gstAmount),
                total: price,
              },
            ]);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, platform]);

  const handleProductSelect = (index: number, prodId: string) => {
    const prod = products.find((p) => p._id === prodId);
    if (!prod) return;

    setItems((prev) => {
      const updated = [...prev];
      const qty = updated[index].quantity || 1;
      const price = prod.sellingPrice || 0;
      const gstRate = prod.gstPercentage || 18;
      const sub = price * qty - (updated[index].discount || 0);
      const gstAmt = (sub * gstRate) / (100 + gstRate);

      updated[index] = {
        ...updated[index],
        productId: prod._id,
        sku: prod.sku,
        productName: prod.name,
        sellingPrice: price,
        gstRate,
        gstAmount: Math.round(gstAmt),
        total: sub,
      };
      return updated;
    });
  };

  const handleQuantityChange = (index: number, qtyStr: string) => {
    const qty = parseInt(qtyStr, 10) || 1;
    setItems((prev) => {
      const updated = [...prev];
      const item = updated[index];
      const sub = item.sellingPrice * qty - item.discount;
      const gstAmt = (sub * item.gstRate) / (100 + item.gstRate);

      updated[index] = {
        ...item,
        quantity: qty,
        gstAmount: Math.round(gstAmt),
        total: sub,
      };
      return updated;
    });
  };

  const handlePriceChange = (index: number, priceStr: string) => {
    const price = parseFloat(priceStr) || 0;
    setItems((prev) => {
      const updated = [...prev];
      const item = updated[index];
      const sub = price * item.quantity - item.discount;
      const gstAmt = (sub * item.gstRate) / (100 + item.gstRate);

      updated[index] = {
        ...item,
        sellingPrice: price,
        gstAmount: Math.round(gstAmt),
        total: sub,
      };
      return updated;
    });
  };

  const addItemRow = () => {
    if (products.length === 0) return;
    const prod = products[0];
    const price = prod.sellingPrice || 0;
    const gstRate = prod.gstPercentage || 18;
    const gstAmt = (price * 1 * gstRate) / (100 + gstRate);

    setItems((prev) => [
      ...prev,
      {
        productId: prod._id,
        sku: prod.sku,
        productName: prod.name,
        quantity: 1,
        sellingPrice: price,
        discount: 0,
        gstRate,
        gstAmount: Math.round(gstAmt),
        total: price,
      },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Computations
  const subtotal = items.reduce((acc, curr) => acc + curr.total, 0);
  const shipFee = parseFloat(shippingFee) || 0;
  const mktFee = parseFloat(marketplaceFee) || 0;
  const pkgFee = parseFloat(packagingFee) || 0;
  const netAmount = subtotal + shipFee;

  let estimatedCogs = 0;
  for (const it of items) {
    const p = products.find((prod) => prod._id === it.productId);
    estimatedCogs += (p?.purchasePrice || 0) * it.quantity;
  }
  const estimatedGrossProfit = netAmount - estimatedCogs - mktFee - shipFee - pkgFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId.trim() || !customerName.trim() || items.length === 0) {
      toast.error("Please fill in Order ID, customer name, and at least one item");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: orderId.trim(),
          platform,
          date: new Date(date),
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          items,
          shippingFee: shipFee,
          marketplaceFee: mktFee,
          packagingFee: pkgFee,
          remarks: remarks.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || (data.error && !data.success)) {
        throw new Error(data.error || "Failed to create order");
      }

      toast.success("Order created! Stock deducted & Ecommerce Accounts credit logged.");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to create order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Ecommerce Order"
      description="Deducts inventory stock, logs stock movement, and creates an Ecommerce Accounts credit transaction"
      maxWidth="4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            label="Platform *"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            options={[
              { label: "Amazon", value: "Amazon" },
              { label: "Meesho", value: "Meesho" },
              { label: "Flipkart", value: "Flipkart" },
              { label: "Direct (Website)", value: "Direct" },
              { label: "Instagram", value: "Instagram" },
              { label: "Other Marketplace", value: "Other" },
            ]}
          />

          <Input
            label="Order ID *"
            required
            placeholder="Order ID"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
          />

          <Input
            label="Order Date *"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Customer Name *"
            required
            placeholder="Customer name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />

          <Input
            label="Customer Phone (Optional)"
            placeholder="Phone number"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
          />
        </div>

        {/* Dynamic Items Table */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white uppercase tracking-wider">
              Ordered Items
            </span>
            <Button type="button" size="sm" variant="outline" onClick={addItemRow}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Product Item
            </Button>
          </div>

          <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/40">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase">
                <tr>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3 text-right">Qty</th>
                  <th className="py-2.5 px-3 text-right">Selling Price (₹)</th>
                  <th className="py-2.5 px-3 text-right">Item Total (₹)</th>
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
                            {p.name} (Stock: {p.currentStock})
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
                        className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-right text-white font-mono text-xs"
                      />
                    </td>
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.sellingPrice}
                        onChange={(e) => handlePriceChange(idx, e.target.value)}
                        className="w-24 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-right text-white font-mono text-xs"
                      />
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

        {/* Fees & Deductions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Shipping Charged to Customer (₹)"
            type="number"
            step="0.01"
            min="0"
            value={shippingFee}
            onChange={(e) => setShippingFee(e.target.value)}
          />
          <Input
            label="Marketplace Fee Deduction (₹)"
            type="number"
            step="0.01"
            min="0"
            value={marketplaceFee}
            onChange={(e) => setMarketplaceFee(e.target.value)}
          />
          <Input
            label="Packaging Cost (₹)"
            type="number"
            step="0.01"
            min="0"
            value={packagingFee}
            onChange={(e) => setPackagingFee(e.target.value)}
          />
        </div>

        {/* Live P&L Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 block">Gross Revenue</span>
            <span className="font-bold text-white font-mono">{formatINR(netAmount)}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Product COGS</span>
            <span className="font-bold text-rose-400 font-mono">-{formatINR(estimatedCogs)}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Marketplace + Fees</span>
            <span className="font-bold text-amber-400 font-mono">-{formatINR(mktFee + pkgFee)}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Estimated Profit</span>
            <span className="font-bold text-emerald-400 font-mono">{formatINR(estimatedGrossProfit)}</span>
          </div>
        </div>

        <Input
          label="Remarks / Tracking Number"
          placeholder="e.g. AWB #9812498721 or Express prime"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            Save Order & Deduct Stock
          </Button>
        </div>
      </form>
    </Modal>
  );
}
