"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button, Card, Badge } from "@/lib/ui";
import {
  Plus,
  Search,
  RefreshCw,
  Package,
  Edit2,
  Trash2,
  ExternalLink,
  Tag,
  AlertTriangle,
  ArrowUpDown,
} from "lucide-react";
import { formatINR } from "@/lib/utils";
import { ProductFormModal } from "@/components/inventory/ProductFormModal";
import { toast } from "sonner";

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [stockStatus, setStockStatus] = useState("ALL");
  const [sortBy, setSortBy] = useState<"name" | "price" | "stock" | "createdAt">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [categories, setCategories] = useState<any[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (category !== "ALL") params.set("category", category);
      if (stockStatus !== "ALL") params.set("stockStatus", stockStatus);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      const res = await fetch(`/api/products?${params.toString()}`);
      const data = await res.json();
      if (data.products) {
        setProducts(data.products);
      }
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [search, category, stockStatus, sortBy, sortOrder]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetch("/api/categories?type=PRODUCT")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setCategories(data);
      })
      .catch(() => {});
  }, []);

  const handleArchive = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to deactivate/archive "${name}"?`)) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Product archived");
        fetchProducts();
      }
    } catch {
      toast.error("Failed to archive product");
    }
  };

  const getStockStatusBadge = (stock: number, threshold: number = 10) => {
    if (stock <= 0) {
      return (
        <Badge variant="danger" className="text-[10px]">
          Out of Stock (0)
        </Badge>
      );
    }
    if (stock <= 5) {
      return (
        <Badge variant="danger" className="text-[10px]">
          Critical ({stock})
        </Badge>
      );
    }
    if (stock <= threshold) {
      return (
        <Badge variant="warning" className="text-[10px]">
          Low Stock ({stock})
        </Badge>
      );
    }
    return (
      <Badge variant="success" className="text-[10px]">
        In Stock ({stock})
      </Badge>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Products & Inventory
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Dynamic multi-category product catalog, real-time stock levels, and COGS pricing
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/inventory/categories">
              <Button variant="secondary" size="md">
                <Tag className="w-4 h-4 mr-1.5 text-blue-400" />
                Categories
              </Button>
            </Link>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setEditingProduct(null);
                setIsModalOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Product
            </Button>
          </div>
        </div>

        {/* Filter bar */}
        <Card className="p-4 bg-slate-900/60 border-slate-800 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search name, SKU, brand..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={stockStatus}
                onChange={(e) => setStockStatus(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Stock Levels</option>
                <option value="GOOD">Good Stock</option>
                <option value="LOW">Low Stock</option>
                <option value="OUT">Out of Stock</option>
              </select>
            </div>

            <div>
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [sb, so] = e.target.value.split("-") as [any, any];
                  setSortBy(sb);
                  setSortOrder(so);
                }}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              >
                <option value="createdAt-desc">Newest First</option>
                <option value="name-asc">Name (A - Z)</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="stock-asc">Stock: Low to High</option>
                <option value="stock-desc">Stock: High to Low</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Products Table */}
        <Card className="overflow-hidden border-slate-800 bg-slate-900/70">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-3">SKU</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3 text-right">Purchase Price (COGS)</th>
                  <th className="py-3 px-3 text-right">Selling Price</th>
                  <th className="py-3 px-3 text-right">Gross Margin</th>
                  <th className="py-3 px-3 text-center">Stock Level</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
                      Loading products...
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <Package className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                      <p className="text-sm font-medium">No products found.</p>
                      <Button
                        size="sm"
                        variant="primary"
                        className="mt-3"
                        onClick={() => setIsModalOpen(true)}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Create First Product
                      </Button>
                    </td>
                  </tr>
                ) : (
                  products.map((prod) => {
                    const margin =
                      prod.sellingPrice > 0
                        ? Math.round(
                            ((prod.sellingPrice - prod.purchasePrice) /
                              prod.sellingPrice) *
                              100
                          )
                        : 0;

                    return (
                      <tr
                        key={prod._id}
                        className="hover:bg-slate-800/40 transition-colors group"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden text-slate-400">
                              {prod.imageUrl ? (
                                <img
                                  src={prod.imageUrl}
                                  alt={prod.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <Link
                                href={`/inventory/products/${prod._id}`}
                                className="font-semibold text-white hover:text-blue-400 transition-colors block"
                              >
                                {prod.name}
                              </Link>
                              <span className="text-[10px] text-slate-400">
                                Brand: {prod.brand || "Foxion"}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-slate-300">
                          {prod.sku}
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <Badge variant="secondary" className="text-[10px]">
                            {prod.category?.name || "General"}
                          </Badge>
                        </td>

                        <td className="py-3 px-3 text-right whitespace-nowrap font-mono text-slate-300">
                          {formatINR(prod.purchasePrice)}
                        </td>

                        <td className="py-3 px-3 text-right whitespace-nowrap font-mono font-medium text-emerald-400">
                          {formatINR(prod.sellingPrice)}
                        </td>

                        <td className="py-3 px-3 text-right whitespace-nowrap font-mono text-xs">
                          <span
                            className={
                              margin >= 30 ? "text-emerald-400" : "text-amber-400"
                            }
                          >
                            {margin}%
                          </span>
                        </td>

                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {getStockStatusBadge(
                            prod.currentStock,
                            prod.lowStockThreshold
                          )}
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100">
                            <Link
                              href={`/inventory/products/${prod._id}`}
                              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                              title="View Details"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>

                            <button
                              onClick={() => {
                                setEditingProduct(prod);
                                setIsModalOpen(true);
                              }}
                              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-blue-400 transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleArchive(prod._id, prod.name)}
                              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400 transition-colors"
                              title="Archive"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Add / Edit Product Modal */}
        <ProductFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={fetchProducts}
          initialData={editingProduct}
        />
      </div>
    </AppLayout>
  );
}
