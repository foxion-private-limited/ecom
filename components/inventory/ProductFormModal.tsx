"use client";

import React, { useState, useEffect } from "react";
import { Modal, Button, Input, Select } from "@/lib/ui";
import { toast } from "sonner";

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any;
}

export function ProductFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: ProductFormModalProps) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("Foxion");
  const [imageUrl, setImageUrl] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [gstPercentage, setGstPercentage] = useState("18");
  const [currentStock, setCurrentStock] = useState("0");
  const [lowStockThreshold, setLowStockThreshold] = useState("10");
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/categories?type=PRODUCT")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setCategories(data);
            if (!category && data.length > 0) {
              setCategory(data[0]._id);
            }
          }
        })
        .catch(() => {});

      if (initialData) {
        setName(initialData.name || "");
        setSku(initialData.sku || "");
        setCategory(initialData.category?._id || initialData.category || "");
        setBrand(initialData.brand || "Foxion");
        setImageUrl(initialData.imageUrl || "");
        setPurchasePrice(String(initialData.purchasePrice || 0));
        setSellingPrice(String(initialData.sellingPrice || 0));
        setGstPercentage(String(initialData.gstPercentage || 18));
        setCurrentStock(String(initialData.currentStock || 0));
        setLowStockThreshold(String(initialData.lowStockThreshold || 10));
        setDescription(initialData.description || "");
      } else {
        setName("");
        setSku("");
        setBrand("Foxion");
        setImageUrl("");
        setPurchasePrice("");
        setSellingPrice("");
        setGstPercentage("18");
        setCurrentStock("0");
        setLowStockThreshold("10");
        setDescription("");
      }
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !sku.trim() || !category) {
      toast.error("Please fill in Product Name, SKU, and Category");
      return;
    }

    setLoading(true);

    const payload = {
      name: name.trim(),
      sku: sku.trim().toUpperCase(),
      category,
      brand: brand.trim() || "Foxion",
      imageUrl: imageUrl.trim(),
      purchasePrice: parseFloat(purchasePrice) || 0,
      sellingPrice: parseFloat(sellingPrice) || 0,
      gstPercentage: parseFloat(gstPercentage) || 18,
      currentStock: parseInt(currentStock, 10) || 0,
      lowStockThreshold: parseInt(lowStockThreshold, 10) || 10,
      description: description.trim(),
      isActive: true,
    };

    try {
      const url = initialData ? `/api/products/${initialData._id}` : "/api/products";
      const method = initialData ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || (data.error && !data.success)) {
        throw new Error(data.error || "Failed to save product");
      }

      toast.success(initialData ? "Product updated" : "Product created successfully");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "Edit Product" : "Add New Product"}
      description="Create a dynamic product in Foxion inventory"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Product Name *"
            required
            placeholder="Product name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Input
            label="SKU (Stock Keeping Unit) *"
            required
            placeholder="e.g. SKU-001"
            value={sku}
            onChange={(e) => setSku(e.target.value.toUpperCase())}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Category *
            </label>
            <select
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select Category...</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Brand"
            placeholder="Brand name"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Purchase Price (₹) *"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="120.00"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
          />

          <Input
            label="Selling Price (₹) *"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="199.00"
            value={sellingPrice}
            onChange={(e) => setSellingPrice(e.target.value)}
          />

          <Input
            label="GST Percentage (%)"
            type="number"
            min="0"
            max="100"
            placeholder="18"
            value={gstPercentage}
            onChange={(e) => setGstPercentage(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={initialData ? "Current Stock Units" : "Initial Stock Units"}
            type="number"
            min="0"
            required
            value={currentStock}
            onChange={(e) => setCurrentStock(e.target.value)}
          />

          <Input
            label="Low Stock Alert Threshold"
            type="number"
            min="0"
            value={lowStockThreshold}
            onChange={(e) => setLowStockThreshold(e.target.value)}
            helperText="Alerts when stock drops to or below this quantity"
          />
        </div>

        <Input
          label="Product Image URL"
          placeholder="https://... or /uploads/..."
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
        />

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-300">
            Description
          </label>
          <textarea
            rows={3}
            className="flex w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Product specifications, dimensions, features..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            {initialData ? "Update Product" : "Create Product"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
