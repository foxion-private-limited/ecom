"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button, Card, Badge, Modal, Input, Select } from "@/lib/ui";
import {
  Tag,
  Plus,
  RefreshCw,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  Receipt,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface AccountCategory {
  _id: string;
  name: string;
  slug: string;
  type: "PRODUCT" | "EXPENSE" | "INCOME";
  description?: string;
  isActive: boolean;
  transactionCount: number;
}

export default function AccountCategoriesPage() {
  const [categories, setCategories] = useState<AccountCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  // Create modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createType, setCreateType] = useState<"PRODUCT" | "EXPENSE" | "INCOME">("EXPENSE");
  const [createDescription, setCreateDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit modal state
  const [editingCategory, setEditingCategory] = useState<AccountCategory | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<"PRODUCT" | "EXPENSE" | "INCOME">("EXPENSE");
  const [editDescription, setEditDescription] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Delete modal state
  const [deletingCategory, setDeletingCategory] = useState<AccountCategory | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "ALL") params.set("type", typeFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/categories?${params.toString()}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setCategories(data);
      } else {
        toast.error(data.error || "Failed to load account categories");
      }
    } catch {
      toast.error("Failed to load account categories");
    } finally {
      setLoading(false);
    }
  }, [typeFilter, search]);

  useEffect(() => {
    let ignore = false;
    const loadCategories = async () => {
      try {
        const params = new URLSearchParams();
        if (typeFilter !== "ALL") params.set("type", typeFilter);
        if (search.trim()) params.set("search", search.trim());

        const res = await fetch(`/api/categories?${params.toString()}`);
        const data = await res.json();
        if (!ignore) {
          if (Array.isArray(data)) {
            setCategories(data);
          } else {
            toast.error(data.error || "Failed to load account categories");
          }
        }
      } catch {
        if (!ignore) toast.error("Failed to load account categories");
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    loadCategories();
    return () => {
      ignore = true;
    };
  }, [typeFilter, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) {
      toast.error("Category name is required");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          type: createType,
          description: createDescription.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to create category");
      }
      toast.success(`Account category "${createName.trim()}" created successfully`);
      setCreateName("");
      setCreateDescription("");
      setCreateType("EXPENSE");
      setIsCreateOpen(false);
      fetchCategories();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create category";
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (cat: AccountCategory) => {
    setEditingCategory(cat);
    setEditName(cat.name);
    setEditType(cat.type);
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
      const res = await fetch(`/api/categories/${editingCategory._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          type: editType,
          description: editDescription.trim(),
          isActive: editIsActive,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to update category");
      }
      toast.success(`Category "${editName.trim()}" updated successfully`);
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

    if (deletingCategory.transactionCount > 0) {
      toast.error(
        `Cannot delete "${deletingCategory.name}": currently referenced by ${deletingCategory.transactionCount} transaction(s).`
      );
      setDeletingCategory(null);
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/categories/${deletingCategory._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to delete category");
      }
      toast.success(data.message || `Category "${deletingCategory.name}" deleted`);
      setDeletingCategory(null);
      fetchCategories();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete category";
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
                Account Categories
              </h1>
              <Badge variant="info" className="text-[10px]">
                Accounts
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Classify accounting transactions, operational expenses, card payments, and revenue streams
            </p>
          </div>

          <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Account Category
          </Button>
        </div>

        {/* Filter Bar */}
        <Card className="p-4 border-slate-800 bg-slate-900/60">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search account categories by name or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-700 bg-slate-800/80 text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                aria-label="Filter by Type"
                className="w-full sm:w-44 px-3 py-2 text-xs rounded-lg border border-slate-700 bg-slate-800/80 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All Types</option>
                <option value="EXPENSE">Expense Heads</option>
                <option value="INCOME">Income / Revenue</option>
                <option value="PRODUCT">Product Heads</option>
              </select>

              <Button
                variant="secondary"
                size="sm"
                onClick={fetchCategories}
                disabled={loading}
                title="Refresh categories"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </Card>

        {/* Categories Table */}
        <Card className="overflow-hidden border-slate-800 bg-slate-900/70">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Category Name</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-3 text-center">Transactions</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
                      Loading account categories...
                    </td>
                  </tr>
                ) : categories.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <p className="text-sm font-medium text-slate-300">No account categories found</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Try adjusting your search filter or click &quot;Add Account Category&quot;.
                      </p>
                    </td>
                  </tr>
                ) : (
                  categories.map((c) => {
                    const isCred = c.name.toUpperCase() === "CRED";
                    return (
                      <tr key={c._id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-semibold text-white">
                          <div className="flex items-center gap-2">
                            <Tag className={`w-3.5 h-3.5 ${isCred ? "text-amber-400" : "text-blue-400"}`} />
                            <span className="text-slate-100">{c.name}</span>
                            {isCred && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <Sparkles className="w-2.5 h-2.5" />
                                CRED Feature
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <Badge
                            variant={
                              c.type === "PRODUCT"
                                ? "info"
                                : c.type === "INCOME"
                                ? "success"
                                : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {c.type}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-400 max-w-xs truncate">
                          {c.description || "—"}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {c.transactionCount > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              <Receipt className="w-3 h-3" />
                              {c.transactionCount}
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
                              title="Edit category"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeletingCategory(c)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title={
                                c.transactionCount > 0
                                  ? `In use by ${c.transactionCount} transactions (cannot delete)`
                                  : "Delete category"
                              }
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

        {/* Create Modal */}
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Add Account Category"
          description="Create a category to classify accounting ledger entries, transactions, or operational heads"
        >
          <form onSubmit={handleCreate} className="space-y-4">
            <Input
              label="Category Name *"
              required
              placeholder="e.g. CRED, Office Expenses, Vendor Settlement"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
            />

            <Select
              label="Category Type"
              value={createType}
              onChange={(e) =>
                setCreateType(e.target.value as "PRODUCT" | "EXPENSE" | "INCOME")
              }
              options={[
                { label: "Operating Expense Head", value: "EXPENSE" },
                { label: "Income / Revenue Stream", value: "INCOME" },
                { label: "Product / Purchase Cost Head", value: "PRODUCT" },
              ]}
            />

            <Input
              label="Description (Optional)"
              placeholder="Brief description of transactions under this account category"
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
                Create Category
              </Button>
            </div>
          </form>
        </Modal>

        {/* Edit Modal */}
        <Modal
          isOpen={!!editingCategory}
          onClose={() => setEditingCategory(null)}
          title={`Edit Category: ${editingCategory?.name}`}
          description="Update details or active status for this accounting category"
        >
          <form onSubmit={handleUpdate} className="space-y-4">
            <Input
              label="Category Name *"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />

            <Select
              label="Category Type"
              value={editType}
              onChange={(e) =>
                setEditType(e.target.value as "PRODUCT" | "EXPENSE" | "INCOME")
              }
              options={[
                { label: "Operating Expense Head", value: "EXPENSE" },
                { label: "Income / Revenue Stream", value: "INCOME" },
                { label: "Product / Purchase Cost Head", value: "PRODUCT" },
              ]}
            />

            <Input
              label="Description (Optional)"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="editCategoryActive"
                checked={editIsActive}
                onChange={(e) => setEditIsActive(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="editCategoryActive" className="text-xs text-slate-300">
                Active (category available for new transaction entries)
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
          description="Safety checks will prevent deletion if accounting transactions reference this category"
        >
          <div className="space-y-4">
            {deletingCategory && deletingCategory.transactionCount > 0 ? (
              <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Cannot Delete This Category</p>
                  <p className="mt-1 text-slate-300">
                    This category is currently referenced by{" "}
                    <strong>{deletingCategory.transactionCount} transaction(s)</strong>.
                    To preserve accounting integrity, categories in active use cannot be deleted.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-300">
                Are you sure you want to delete the category{" "}
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
              {deletingCategory && deletingCategory.transactionCount === 0 && (
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
