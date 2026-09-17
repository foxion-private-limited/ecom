"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button, Card, Badge, Modal, Input, Select } from "@/lib/ui";
import { Tag, Plus, RefreshCw, FolderTree } from "lucide-react";
import { toast } from "sonner";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"PRODUCT" | "EXPENSE" | "INCOME">("PRODUCT");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      if (Array.isArray(data)) setCategories(data);
    } catch {
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), type, description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok || (data.error && !data.success)) {
        throw new Error(data.error || "Failed to create category");
      }
      toast.success("Category created successfully");
      setName("");
      setDescription("");
      setIsModalOpen(false);
      fetchCategories();
    } catch (err: any) {
      toast.error(err.message || "Failed to create category");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Dynamic Categories
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Organize products, operational expenses, and ecommerce revenue streams
            </p>
          </div>

          <Button variant="primary" onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Category
          </Button>
        </div>

        <Card className="overflow-hidden border-slate-800 bg-slate-900/70">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Category Name</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Description</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
                      Loading categories...
                    </td>
                  </tr>
                ) : categories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      No categories found. Click "Add Category" to create one.
                    </td>
                  </tr>
                ) : (
                  categories.map((c) => (
                    <tr key={c._id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <Tag className="w-3.5 h-3.5 text-blue-400" />
                          <span>{c.name}</span>
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
                      <td className="py-3 px-3 text-slate-400">
                        {c.description || "—"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="success" className="text-[10px]">
                          Active
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Add New Category"
          description="Categories are dynamically available in products and accounting books"
        >
          <form onSubmit={handleCreate} className="space-y-4">
            <Input
              label="Category Name *"
              required
              placeholder="e.g. Kitchen, Home Appliances, Electronics"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <Select
              label="Category Type"
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              options={[
                { label: "Product Category", value: "PRODUCT" },
                { label: "Operating Expense Category", value: "EXPENSE" },
                { label: "Income / Sales Stream", value: "INCOME" },
              ]}
            />

            <Input
              label="Description (Optional)"
              placeholder="Brief description of products or expenses in this category"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={saving}>
                Create Category
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
}
