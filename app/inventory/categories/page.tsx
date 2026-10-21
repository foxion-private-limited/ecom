"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button, Card, Badge, Modal, Input } from "@/lib/ui";
import {
  FolderTree,
  Plus,
  RefreshCw,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  Package,
} from "lucide-react";
import { toast } from "sonner";

interface ProductCategoryItem {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  productCount: number;
  createdAt: string;
}

export default function ProductCategoriesPage() {
  const [categories, setCategories] = useState<ProductCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Create modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit modal state
  const [editingCategory, setEditingCategory] = useState<ProductCategoryItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Delete modal state
  const [deletingCategory, setDeletingCategory] = useState<ProductCategoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/inventory/categories?${params.toString()}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setCategories(data);
      } else {
        toast.error(data.error || "Failed to load product categories");
      }
    } catch {
      toast.error("Failed to load product categories");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    let ignore = false;
    const loadCategories = async () => {
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());

        const res = await fetch(`/api/inventory/categories?${params.toString()}`);
        const data = await res.json();
        if (!ignore) {
          if (Array.isArray(data)) {
            setCategories(data);
          } else {
            toast.error(data.error || "Failed to load product categories");
          }
        }
      } catch {
        if (!ignore) toast.error("Failed to load product categories");
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    loadCategories();
    return () => {
      ignore = true;
    };
  }, [search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) {
      toast.error("Category name is required");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/inventory/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          description: createDescription.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to create product category");
      }
      toast.success(`Product category "${createName.trim()}" created successfully`);
      setCreateName("");
      setCreateDescription("");
      setIsCreateOpen(false);
      fetchCategories();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create category";
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (cat: ProductCategoryItem) => {
    setEditingCategory(cat);
    setEditName(cat.name);
    setEditDescription(cat.description || "");
    setEditIsActive(cat.isActive);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    if (!editName.trim()) {
      toast.error("Category name is required");
      return;
    }

    setUpdating(true);
    try {
      const res = await fetch(`/api/inventory/categories/${editingCategory._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim(),
          isActive: editIsActive,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to update product category");
      }
      toast.success(`Product category "${editName.trim()}" updated successfully`);
      setEditingCategory(null);
      fetchCategories();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update category";
      toast.error(message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCategory) return;

    if (deletingCategory.productCount > 0) {
      toast.error(
        `Cannot delete "${deletingCategory.name}": currently assigned to ${deletingCategory.productCount} product(s).`
      );
      setDeletingCategory(null);
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/inventory/categories/${deletingCategory._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to delete product category");
      }
      toast.success(data.message || `Product category "${deletingCategory.name}" deleted`);
      setDeletingCategory(null);
      fetchCategories();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete product category";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Product Categories
              </h1>
              <Badge variant="info" className="text-[10px]">
                Inventory
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Organize catalog products, SKUs, and inventory items into product classifications
            </p>
          </div>

          <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Product Category
          </Button>
        </div>

        {/* Filter Bar (only when categories exist or search is active) */}
        {(categories.length > 0 || search.trim().length > 0) && (
          <Card className="p-4 border-slate-800 bg-slate-900/60">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search product categories by name or description..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-700 bg-slate-800/80 text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={fetchCategories}
                disabled={loading}
                title="Refresh product categories"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </Card>
        )}

        {/* Categories Table or Empty State */}
        <Card className="overflow-hidden border-slate-800 bg-slate-900/70">
          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-blue-400" />
              <p className="text-sm">Loading product categories...</p>
            </div>
          ) : categories.length === 0 ? (
            /* Explicit Empty State Required by Spec */
            <div className="py-16 px-4 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-slate-800/90 flex items-center justify-center mb-3">
                <FolderTree className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="text-base font-semibold text-white">
                No product categories yet
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 max-w-sm mx-auto">
                Get started by creating your first product category to organize your inventory items and catalog SKUs.
              </p>
              <div className="mt-5">
                <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Product Category
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Category Name</th>
                    <th className="py-3 px-3">Slug</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-3 text-center">Assigned Products</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {categories.map((c) => (
                    <tr key={c._id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <FolderTree className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="text-slate-100">{c.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">
                        {c.slug}
                      </td>
                      <td className="py-3 px-4 text-slate-400 max-w-xs truncate">
                        {c.description || "—"}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {c.productCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            <Package className="w-3 h-3" />
                            {c.productCount}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">0</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {c.isActive ? (
                          <Badge variant="success" className="text-[10px]">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            Inactive
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(c)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title="Edit product category"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingCategory(c)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title={
                              c.productCount > 0
                                ? `In use by ${c.productCount} product(s) (cannot delete)`
                                : "Delete product category"
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Create Modal */}
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Add Product Category"
          description="Create a product category to classify items in your inventory catalog"
        >
          <form onSubmit={handleCreate} className="space-y-4">
            <Input
              label="Product Category Name *"
              required
              placeholder="e.g. Kitchen Appliances, Electronics, Accessories"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
            />

            <Input
              label="Description (Optional)"
              placeholder="Brief description of products categorized under this category"
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
            />

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={creating}>
                Create Product Category
              </Button>
            </div>
          </form>
        </Modal>

        {/* Edit Modal */}
        <Modal
          isOpen={!!editingCategory}
          onClose={() => setEditingCategory(null)}
          title={`Edit Product Category: ${editingCategory?.name}`}
          description="Update details or active status for this product category"
        >
          <form onSubmit={handleUpdate} className="space-y-4">
            <Input
              label="Category Name *"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />

            <Input
              label="Description (Optional)"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="editProductCategoryActive"
                checked={editIsActive}
                onChange={(e) => setEditIsActive(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="editProductCategoryActive" className="text-xs text-slate-300">
                Active (category selectable when adding or editing products)
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditingCategory(null)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={updating}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={!!deletingCategory}
          onClose={() => setDeletingCategory(null)}
          title={`Delete Category "${deletingCategory?.name}"?`}
          description="Safety checks will prevent deletion if products in inventory are assigned to this category"
        >
          <div className="space-y-4">
            {deletingCategory && deletingCategory.productCount > 0 ? (
              <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Cannot Delete This Product Category</p>
                  <p className="mt-1 text-slate-300">
                    This category is currently assigned to{" "}
                    <strong>{deletingCategory.productCount} product(s)</strong> in inventory.
                    Reassign or remove those products before deleting this category.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-300">
                Are you sure you want to delete the product category{" "}
                <span className="font-semibold text-white">{deletingCategory?.name}</span>?
                This action cannot be undone.
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDeletingCategory(null)}
              >
                Close
              </Button>
              {deletingCategory && deletingCategory.productCount === 0 && (
                <Button
                  type="button"
                  variant="danger"
                  loading={deleting}
                  onClick={handleDelete}
                >
                  Delete Category
                </Button>
              )}
            </div>
          </div>
        </Modal>
      </div>
    </AppLayout>
  );
}
