"use client";

import React, { useState, useEffect, useRef } from "react";
import { Modal, Button, Input } from "@/lib/ui";
import {
  UploadCloud,
  X,
  AlertCircle,
  FileCheck,
} from "lucide-react";
import { toast } from "sonner";

interface InitialProductData {
  _id?: string;
  name?: string;
  sku?: string;
  category?: { _id: string; name?: string } | string;
  brand?: string;
  imageUrl?: string;
  imageId?: string;
  imageType?: "UPLOAD" | "URL";
  purchasePrice?: number;
  sellingPrice?: number;
  gstPercentage?: number;
  currentStock?: number;
  lowStockThreshold?: number;
  description?: string;
}

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: InitialProductData | null;
}

interface CategoryOption {
  _id: string;
  name: string;
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
  const [purchasePrice, setPurchasePrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [gstPercentage, setGstPercentage] = useState("18");
  const [currentStock, setCurrentStock] = useState("0");
  const [lowStockThreshold, setLowStockThreshold] = useState("10");
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Image handling states
  const [imageUrl, setImageUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [existingImage, setExistingImage] = useState<string | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let ignore = false;
    if (!isOpen) return;

    fetch("/api/inventory/categories")
      .then((res) => res.json())
      .then((data: unknown) => {
        if (!ignore && Array.isArray(data)) {
          const catList = data as CategoryOption[];
          setCategories(catList);
          if (!initialData && catList.length > 0) {
            setCategory((prev) => prev || catList[0]._id);
          }
        }
      })
      .catch(() => {});

    // Asynchronously initialize form state to avoid cascading renders
    const timer = setTimeout(() => {
      if (ignore) return;
      if (initialData) {
        setName(initialData.name || "");
        setSku(initialData.sku || "");
        setCategory(
          typeof initialData.category === "object" && initialData.category !== null
            ? initialData.category._id
            : initialData.category || ""
        );
        setBrand(initialData.brand || "Foxion");
        setPurchasePrice(String(initialData.purchasePrice ?? 0));
        setSellingPrice(String(initialData.sellingPrice ?? 0));
        setGstPercentage(String(initialData.gstPercentage ?? 18));
        setCurrentStock(String(initialData.currentStock ?? 0));
        setLowStockThreshold(String(initialData.lowStockThreshold ?? 10));
        setDescription(initialData.description || "");

        // If existing product has an image
        if (initialData.imageUrl) {
          setExistingImage(initialData.imageUrl);
          if (
            initialData.imageType === "URL" ||
            !initialData.imageUrl.startsWith("/api/products/images/")
          ) {
            setImageUrl(initialData.imageUrl);
          } else {
            setImageUrl("");
          }
        } else {
          setExistingImage(null);
          setImageUrl("");
        }
      } else {
        setName("");
        setSku("");
        setBrand("Foxion");
        setPurchasePrice("");
        setSellingPrice("");
        setGstPercentage("18");
        setCurrentStock("0");
        setLowStockThreshold("10");
        setDescription("");
        setExistingImage(null);
        setImageUrl("");
      }

      setSelectedFile(null);
      setFilePreview(null);
      setRemoveExisting(false);
      setImageError(null);
    }, 0);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [isOpen, initialData]);

  // Handle URL change
  const handleUrlChange = (val: string) => {
    setImageUrl(val);
    setRemoveExisting(false);
    // Validation check: if both URL and file are present
    if (val.trim() && selectedFile) {
      setImageError("Please choose either an Image URL or an Uploaded Image, not both.");
    } else {
      setImageError(null);
    }
  };

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: 5 MB
    if (file.size > 5 * 1024 * 1024) {
      setImageError("File size exceeds 5 MB limit. Please choose a smaller image.");
      setSelectedFile(null);
      setFilePreview(null);
      return;
    }

    // Check format
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setImageError("Invalid file type. Only JPEG, PNG, and WebP are allowed.");
      setSelectedFile(null);
      setFilePreview(null);
      return;
    }

    setSelectedFile(file);
    setFilePreview(URL.createObjectURL(file));
    setRemoveExisting(false);

    if (imageUrl.trim()) {
      setImageError("Please choose either an Image URL or an Uploaded Image, not both.");
    } else {
      setImageError(null);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
      setFilePreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setImageError(null);
  };

  const handleRemoveExistingImage = () => {
    setExistingImage(null);
    setImageUrl("");
    handleRemoveFile();
    setRemoveExisting(true);
    setImageError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !sku.trim() || !category) {
      toast.error("Please fill in Product Name, SKU, and Category");
      return;
    }

    // Mutual exclusivity check
    const hasUrl = imageUrl.trim().length > 0;
    const hasFile = selectedFile !== null;

    if (hasUrl && hasFile) {
      setImageError("Please provide either an Image URL or an Uploaded Image, not both.");
      toast.error("Please provide either an Image URL or an Uploaded Image, not both");
      return;
    }

    setLoading(true);

    let uploadedImageId: string | undefined = undefined;
    let finalImageUrl = "";
    let finalImageType: "UPLOAD" | "URL" | undefined = undefined;

    try {
      // 1. If a new file is uploaded, upload it to MongoDB GridFS first
      if (hasFile && selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);

        const uploadRes = await fetch("/api/products/upload-image", {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.success) {
          throw new Error(uploadData.error || "Failed to upload image to database");
        }

        uploadedImageId = uploadData.imageId;
        finalImageUrl = uploadData.imageUrl;
        finalImageType = "UPLOAD";
      } else if (hasUrl) {
        finalImageUrl = imageUrl.trim();
        finalImageType = "URL";
        uploadedImageId = undefined;
      } else if (removeExisting) {
        finalImageUrl = "";
        uploadedImageId = undefined;
        finalImageType = undefined;
      } else if (initialData?.imageUrl) {
        finalImageUrl = initialData.imageUrl;
        uploadedImageId = initialData.imageId;
        finalImageType = initialData.imageType || (initialData.imageUrl.startsWith("/api/products/images/") ? "UPLOAD" : "URL");
      }

      // 2. Prepare product payload
      const payload: Record<string, unknown> = {
        name: name.trim(),
        sku: sku.trim().toUpperCase(),
        category,
        brand: brand.trim() || "Foxion",
        imageUrl: finalImageUrl,
        imageId: uploadedImageId,
        imageType: finalImageType,
        purchasePrice: parseFloat(purchasePrice) || 0,
        sellingPrice: parseFloat(sellingPrice) || 0,
        gstPercentage: parseFloat(gstPercentage) || 18,
        currentStock: parseInt(currentStock, 10) || 0,
        lowStockThreshold: parseInt(lowStockThreshold, 10) || 10,
        description: description.trim(),
        isActive: true,
      };

      const url = initialData?._id ? `/api/products/${initialData._id}` : "/api/products";
      const method = initialData?._id ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || (data.error && !data.success)) {
        // If save failed and we just uploaded a GridFS image, clean up to prevent orphans
        if (uploadedImageId) {
          try {
            await fetch(`/api/products/images/${uploadedImageId}`, { method: "DELETE" });
          } catch {
            // Ignore rollback errors
          }
        }
        throw new Error(data.error || "Failed to save product");
      }

      toast.success(initialData?._id ? "Product updated successfully" : "Product created successfully");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save product";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData?._id ? "Edit Product" : "Add New Product"}
      description="Create or edit a product with image URL or direct MongoDB image upload"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Row 1: Name and SKU */}
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

        {/* Row 2: Category and Brand */}
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

        {/* Row 3: Prices and GST */}
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

        {/* Row 4: Stock */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={initialData?._id ? "Current Stock Units" : "Initial Stock Units"}
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

        {/* ========================================================= */}
        {/* PRODUCT IMAGE SECTION: Option A (URL) OR Option B (Upload) */}
        {/* ========================================================= */}
        <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="block text-xs font-semibold text-slate-200">
                Product Image
              </span>
              <span className="text-[11px] text-slate-400">
                Provide an external image URL or upload an image directly into the database.
              </span>
            </div>

            {/* Existing image indicator when editing */}
            {existingImage && !removeExisting && !selectedFile && !imageUrl && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  Current Image Active
                </span>
                <button
                  type="button"
                  onClick={handleRemoveExistingImage}
                  className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Validation Alert */}
          {imageError && (
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{imageError}</span>
            </div>
          )}

          {/* Option A: Image URL */}
          <div className="space-y-1.5">
            <Input
              label="Option A: Image URL"
              placeholder="https://example.com/images/product.jpg"
              value={imageUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              helperText="Paste a web image link (JPEG, PNG, WebP)"
            />
          </div>

          {/* OR Divider */}
          <div className="relative my-2 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <span className="relative bg-slate-900/90 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-slate-400 border border-slate-800">
              OR
            </span>
          </div>

          {/* Option B: Upload Image */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Option B: Upload Product Image
            </label>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
              id="product-image-file-input"
            />

            {!selectedFile ? (
              <label
                htmlFor="product-image-file-input"
                className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700/80 hover:border-blue-500/60 rounded-lg p-4 cursor-pointer bg-slate-950/40 hover:bg-slate-800/40 transition-colors group"
              >
                <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-blue-400 transition-colors mb-1.5" />
                <span className="text-xs font-medium text-slate-200 group-hover:text-white">
                  Click to browse and upload image file
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  Supported formats: JPEG, PNG, WebP (Max 5 MB)
                </span>
              </label>
            ) : (
              /* Selected File Preview Box */
              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-700 bg-slate-950/70">
                <div className="flex items-center gap-3 overflow-hidden">
                  {filePreview ? (
                    <img
                      src={filePreview}
                      alt="Preview"
                      className="w-12 h-12 object-cover rounded-md border border-slate-700 shrink-0 bg-slate-900"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-md bg-slate-800 flex items-center justify-center shrink-0">
                      <FileCheck className="w-5 h-5 text-emerald-400" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate max-w-xs">
                      {selectedFile.name}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type || "Image"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <label
                    htmlFor="product-image-file-input"
                    className="text-[11px] font-medium text-blue-400 hover:text-blue-300 cursor-pointer px-2 py-1 rounded hover:bg-slate-800 transition-colors"
                  >
                    Replace
                  </label>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                    title="Remove selected file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Active / Current Image Preview */}
          {existingImage && !removeExisting && !selectedFile && (
            <div className="pt-2 border-t border-slate-800/80 flex items-center gap-3">
              <div className="w-10 h-10 rounded-md border border-slate-700 overflow-hidden bg-slate-800 shrink-0">
                <img
                  src={existingImage}
                  alt="Current product"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-[11px] text-slate-300 flex-1 truncate">
                <span className="text-slate-400 block text-[10px]">Saved Image:</span>
                <span className="font-mono text-slate-200 truncate block">
                  {existingImage.startsWith("/api/products/images/")
                    ? "Stored in MongoDB GridFS"
                    : existingImage}
                </span>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleRemoveExistingImage}
                className="text-[10px] h-7 px-2 text-red-400 hover:text-red-300"
              >
                Remove Image
              </Button>
            </div>
          )}
        </div>

        {/* Row 5: Description */}
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

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            {initialData?._id ? "Update Product" : "Create Product"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
