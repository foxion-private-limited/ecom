"use client";

import React, { useState } from "react";
import { Modal, Button, Input } from "@/lib/ui";
import { formatINR } from "@/lib/utils";
import { toast } from "sonner";

export function OrderReturnModal({
  isOpen,
  onClose,
  onSuccess,
  order,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  order: any;
}) {
  const [remarks, setRemarks] = useState("Customer return via marketplace");
  const [loading, setLoading] = useState(false);

  if (!order) return null;

  const handleProcessReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`/api/orders/${order._id}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnedProductIds: order.items.map((i: any) => i.productId),
          remarks,
        }),
      });

      const data = await res.json();
      if (!res.ok || (data.error && !data.success)) {
        throw new Error(data.error || "Failed to process return");
      }

      toast.success(
        `Return processed for Order #${order.orderId}. Stock replenished & refund transaction logged.`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to process return");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Process Return: Order #${order.orderId}`}
      description={`Platform: ${order.platform} | Customer: ${order.customerName}`}
    >
      <form onSubmit={handleProcessReturn} className="space-y-4 text-xs">
        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
          <span className="text-slate-400 block font-semibold uppercase text-[10px]">
            Items Being Returned & Restocked:
          </span>
          <div className="space-y-1">
            {order.items?.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between py-1 border-b border-slate-900">
                <span className="text-white">
                  {item.productName} (Qty: {item.quantity})
                </span>
                <span className="font-mono text-emerald-400">
                  {formatINR(item.total)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-between pt-1 font-bold text-slate-200">
            <span>Total Refund Amount:</span>
            <span className="font-mono text-rose-400">{formatINR(order.netAmount)}</span>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-800/40 text-blue-300">
          This operation will:
          <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[11px] text-blue-200">
            <li>Increase inventory stock by the returned quantities</li>
            <li>Record audit StockMovement with type RETURN</li>
            <li>Create an adjustment Debit transaction in Ecommerce Accounts</li>
            <li>Mark Order #{order.orderId} as RETURNED</li>
          </ul>
        </div>

        <Input
          label="Return Reason / Remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Reason for return (e.g. damaged in transit, customer cancelled, wrong item)"
        />

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" loading={loading}>
            Confirm Return & Restock
          </Button>
        </div>
      </form>
    </Modal>
  );
}
