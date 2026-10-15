"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Input,
  Select,
} from "@/lib/ui";
import {
  FileText,
  Plus,
  Trash2,
  Save,
  Send,
  Eye,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Download,
  CheckCircle2,
  Layers,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { formatINR } from "@/lib/utils";
import { INDIAN_STATES, IndianState } from "@/lib/invoices/validation";

interface LineItemForm {
  description: string;
  hsnSac: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountType: "NONE" | "PERCENT" | "FIXED";
  discountValue: number;
  gstRate: number;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Settings & readiness
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [isProductionReady, setIsProductionReady] = useState(false);
  const [readinessBlockers, setReadinessBlockers] = useState<string[]>([]);

  // Mode
  const [mode, setMode] = useState<"TEST" | "PRODUCTION">("TEST");
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // Buyer
  const [buyerName, setBuyerName] = useState("");
  const [buyerType, setBuyerType] = useState<"B2C_UNREGISTERED" | "B2B_REGISTERED" | "OTHER">("B2C_UNREGISTERED");
  const [buyerGstin, setBuyerGstin] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("Gujarat");
  const [stateCode, setStateCode] = useState("24");
  const [pincode, setPincode] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [shipLine1, setShipLine1] = useState("");
  const [shipCity, setShipCity] = useState("");
  const [shipState, setShipState] = useState("Gujarat");
  const [shipStateCode, setShipStateCode] = useState("24");
  const [shipPincode, setShipPincode] = useState("");

  // Place of Supply & Tax Treatment
  const [placeOfSupply, setPlaceOfSupply] = useState("Gujarat");
  const [placeOfSupplyCode, setPlaceOfSupplyCode] = useState("24");
  const [taxTreatment, setTaxTreatment] = useState<"INTRA_STATE" | "INTER_STATE" | "EXEMPT" | "NIL">("INTRA_STATE");
  const [applyRoundOff, setApplyRoundOff] = useState(true);
  const [reverseCharge, setReverseCharge] = useState(false);

  // Marketplace & Logistics
  const [platform, setPlatform] = useState<string>("Meesho");
  const [marketplaceOrderId, setMarketplaceOrderId] = useState("");
  const [marketplaceRef, setMarketplaceRef] = useState("");
  const [courierCompany, setCourierCompany] = useState("");
  const [awbNumber, setAwbNumber] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");

  // Line items
  const [items, setItems] = useState<LineItemForm[]>([
    {
      description: "Sample Product Item",
      hsnSac: "61091000",
      quantity: 1,
      unit: "PCS",
      unitPrice: 999,
      discountType: "NONE",
      discountValue: 0,
      gstRate: 18,
    },
  ]);

  // Notes & declarations
  const [notes, setNotes] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("Payment due within 15 days");
  const [additionalDeclarations, setAdditionalDeclarations] = useState("");
  const [exportPng, setExportPng] = useState(false);

  // Live preview state
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewTotals, setPreviewTotals] = useState<{
    taxableSubtotal: number;
    totalDiscount: number;
    cgstTotal: number;
    sgstTotal: number;
    igstTotal: number;
    totalGst: number;
    grossTotal: number;
    roundOff: number;
    amountPayable: number;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<"form" | "preview">("form");
  const [savingDraft, setSavingDraft] = useState(false);
  const [issuing, setIssuing] = useState(false);

  // Load seller settings
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings/invoices");
        const data = await res.json();
        if (data.success && data.settings) {
          setIsProductionReady(data.productionReadiness?.isReady || false);
          setReadinessBlockers(data.productionReadiness?.blockers || []);
          if (data.settings.testMode) {
            setMode("TEST");
          }
          if (data.settings.defaultPaymentTerms) {
            setPaymentTerms(data.settings.defaultPaymentTerms);
          }
          if (data.settings.defaultDeclarations) {
            setAdditionalDeclarations("");
          }
        }
      } catch {
        // Fallback
      } finally {
        setSettingsLoaded(true);
      }
    }
    loadSettings();
  }, []);

  // Update state code when state changes
  const handleStateChange = (selectedStateName: string) => {
    setState(selectedStateName);
    setPlaceOfSupply(selectedStateName);
    const found = INDIAN_STATES.find((s) => s.name === selectedStateName);
    if (found) {
      setStateCode(found.code);
      setPlaceOfSupplyCode(found.code);
      // Auto-detect tax treatment if seller is Gujarat (24)
      if (found.code === "24") {
        setTaxTreatment("INTRA_STATE");
      } else {
        setTaxTreatment("INTER_STATE");
      }
    }
  };

  // Line item manipulation
  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        description: "",
        hsnSac: "",
        quantity: 1,
        unit: "PCS",
        unitPrice: 0,
        discountType: "NONE",
        discountValue: 0,
        gstRate: 18,
      },
    ]);
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) {
      toast.error("Invoice must have at least one line item");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateItem = <K extends keyof LineItemForm>(
    idx: number,
    field: K,
    value: LineItemForm[K]
  ) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  // Refresh preview debounced
  const refreshPreview = useCallback(async () => {
    try {
      const payload = {
        mode,
        invoiceDate: new Date(invoiceDate),
        buyerName: buyerName.trim() || "Customer Name",
        buyerType,
        buyerGstin: buyerGstin.trim() || undefined,
        buyerBillingAddress: {
          line1: line1.trim() || "Billing Address",
          line2: line2.trim() || "",
          city: city.trim() || "City",
          state,
          stateCode,
          pincode: pincode.trim() || "000000",
          country: "India",
        },
        buyerShippingAddress: sameAsBilling
          ? undefined
          : {
              line1: shipLine1.trim() || "Shipping Address",
              city: shipCity.trim() || "City",
              state: shipState,
              stateCode: shipStateCode,
              pincode: shipPincode.trim() || "000000",
              country: "India",
            },
        buyerPhone: buyerPhone.trim() || undefined,
        buyerEmail: buyerEmail.trim() || undefined,
        placeOfSupply,
        placeOfSupplyCode,
        taxTreatment,
        platform: platform ? (platform as "Meesho" | "Amazon" | "Flipkart" | "Direct Webstore" | "Instagram" | "Other") : undefined,
        marketplaceOrderId: marketplaceOrderId.trim() || undefined,
        marketplaceRef: marketplaceRef.trim() || undefined,
        courierCompany: courierCompany.trim() || undefined,
        awbNumber: awbNumber.trim() || undefined,
        trackingNumber: trackingNumber.trim() || undefined,
        items: items.map((it) => ({
          description: it.description.trim() || "Item",
          hsnSac: it.hsnSac.trim() || "",
          quantity: Number(it.quantity) || 1,
          unit: it.unit || "PCS",
          unitPrice: Number(it.unitPrice) || 0,
          discountType: it.discountType,
          discountValue: Number(it.discountValue) || 0,
          gstRate: Number(it.gstRate) || 0,
        })),
        applyRoundOff,
        reverseChargeApplicable: reverseCharge,
        notes: notes.trim() || undefined,
        paymentTerms: paymentTerms.trim() || undefined,
        additionalDeclarations: additionalDeclarations.trim() || undefined,
      };

      const res = await fetch("/api/invoices/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setPreviewHtml(data.html);
        setPreviewTotals(data.totals);
      }
    } catch {
      // Ignore preview errors
    }
  }, [
    mode,
    invoiceDate,
    buyerName,
    buyerType,
    buyerGstin,
    line1,
    line2,
    city,
    state,
    stateCode,
    pincode,
    buyerPhone,
    buyerEmail,
    sameAsBilling,
    shipLine1,
    shipCity,
    shipState,
    shipStateCode,
    shipPincode,
    placeOfSupply,
    placeOfSupplyCode,
    taxTreatment,
    platform,
    marketplaceOrderId,
    marketplaceRef,
    courierCompany,
    awbNumber,
    trackingNumber,
    items,
    applyRoundOff,
    reverseCharge,
    notes,
    paymentTerms,
    additionalDeclarations,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshPreview();
    }, 400);
    return () => clearTimeout(timer);
  }, [refreshPreview]);

  // Construct draft payload
  const buildPayload = () => {
    return {
      mode,
      invoiceDate: new Date(invoiceDate),
      buyerName: buyerName.trim(),
      buyerType,
      buyerGstin: buyerGstin.trim() || undefined,
      buyerBillingAddress: {
        line1: line1.trim(),
        line2: line2.trim(),
        city: city.trim(),
        state,
        stateCode,
        pincode: pincode.trim(),
        country: "India",
      },
      buyerShippingAddress: sameAsBilling
        ? undefined
        : {
            line1: shipLine1.trim(),
            city: shipCity.trim(),
            state: shipState,
            stateCode: shipStateCode,
            pincode: shipPincode.trim(),
            country: "India",
          },
      buyerPhone: buyerPhone.trim(),
      buyerEmail: buyerEmail.trim(),
      placeOfSupply,
      placeOfSupplyCode,
      taxTreatment,
      platform: platform as "Meesho" | "Amazon" | "Flipkart" | "Direct Webstore" | "Instagram" | "Other",
      marketplaceOrderId: marketplaceOrderId.trim(),
      marketplaceRef: marketplaceRef.trim(),
      courierCompany: courierCompany.trim(),
      awbNumber: awbNumber.trim(),
      trackingNumber: trackingNumber.trim(),
      items: items.map((it) => ({
        description: it.description.trim(),
        hsnSac: it.hsnSac.trim(),
        quantity: Number(it.quantity),
        unit: it.unit,
        unitPrice: Number(it.unitPrice),
        discountType: it.discountType,
        discountValue: Number(it.discountValue),
        gstRate: Number(it.gstRate),
      })),
      applyRoundOff,
      reverseChargeApplicable: reverseCharge,
      notes: notes.trim(),
      paymentTerms: paymentTerms.trim(),
      additionalDeclarations: additionalDeclarations.trim(),
      exportPng,
    };
  };

  const handleSaveDraft = async () => {
    if (!buyerName.trim()) {
      toast.error("Buyer / customer name is required");
      return;
    }
    if (!line1.trim() || !city.trim()) {
      toast.error("Billing address line 1 and city are required");
      return;
    }
    if (items.some((it) => !it.description.trim())) {
      toast.error("Every line item must have a description");
      return;
    }

    setSavingDraft(true);
    try {
      const payload = buildPayload();
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success && data.invoice) {
        toast.success("Draft invoice saved successfully");
        router.push(`/invoices/${data.invoice._id}`);
      } else {
        toast.error(data.error || "Failed to save draft invoice");
      }
    } catch {
      toast.error("Network error saving draft");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleIssueDirectly = async () => {
    if (mode === "PRODUCTION" && !isProductionReady) {
      toast.error(
        `Production issuance blocked: ${readinessBlockers.join("; ")}`
      );
      return;
    }

    if (!buyerName.trim() || !line1.trim() || !city.trim()) {
      toast.error("Please fill required customer name and address fields");
      return;
    }

    setIssuing(true);
    try {
      // 1. Create draft
      const payload = buildPayload();
      const resDraft = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const dataDraft = await resDraft.json();
      if (!dataDraft.success || !dataDraft.invoice) {
        throw new Error(dataDraft.error || "Failed to create draft");
      }

      // 2. Issue invoice
      const invoiceId = dataDraft.invoice._id;
      const resIssue = await fetch(`/api/invoices/${invoiceId}/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exportPng }),
      });
      const dataIssue = await resIssue.json();

      if (dataIssue.success && dataIssue.invoice) {
        toast.success(
          `Invoice ${dataIssue.invoice.serialNumber} issued successfully!`
        );
        router.push(`/invoices/${invoiceId}`);
      } else {
        toast.error(dataIssue.error || "Issuance failed");
        router.push(`/invoices/${invoiceId}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error issuing invoice";
      toast.error(msg);
    } finally {
      setIssuing(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <Link href="/invoices">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 text-slate-400 hover:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <FileText className="w-6 h-6 text-indigo-400" />
                Create Tax Invoice
              </h1>
              <p className="text-xs text-slate-400">
                Independent invoice generation with live preview and permanent storage.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* View toggle for mobile or small screens */}
            <div className="xl:hidden flex bg-slate-900 rounded-lg p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab("form")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  activeTab === "form"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Form
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  activeTab === "preview"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Live Preview
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={savingDraft || issuing}
              onClick={handleSaveDraft}
              className="border-slate-700 hover:bg-slate-800 text-slate-300 gap-1.5"
            >
              <Save className="w-4 h-4 text-slate-400" />
              {savingDraft ? "Saving..." : "Save Draft"}
            </Button>

            <Button
              size="sm"
              disabled={issuing || savingDraft}
              onClick={handleIssueDirectly}
              className={`gap-1.5 font-medium ${
                mode === "PRODUCTION" && !isProductionReady
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed hover:bg-slate-800"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
              }`}
            >
              <Send className="w-4 h-4" />
              {issuing
                ? "Issuing..."
                : mode === "TEST"
                ? "Issue Test Invoice"
                : "Issue Production Invoice"}
            </Button>
          </div>
        </div>

        {/* Operating Mode Bar */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                mode === "TEST"
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              }`}
            >
              {mode === "TEST" ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  Operating Mode: {mode === "TEST" ? "Test Mode" : "Production Mode"}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    mode === "TEST"
                      ? "bg-amber-500/20 text-amber-300"
                      : "bg-emerald-500/20 text-emerald-300"
                  }`}
                >
                  {mode === "TEST" ? "DEMO & WATERMARKED" : "LEGAL GST"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {mode === "TEST"
                  ? "Test documents carry an immutable test watermark on every page and do not consume production sequences."
                  : "Production documents assign sequential official numbers and require verified GST registration details."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-center">
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setMode("TEST")}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  mode === "TEST"
                    ? "bg-amber-500 text-slate-950 shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Test Mode
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isProductionReady) {
                    toast.warning(
                      "Production mode requires verified GST registration in Invoice Settings."
                    );
                  }
                  setMode("PRODUCTION");
                }}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  mode === "PRODUCTION"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Production Mode
              </button>
            </div>
          </div>
        </div>

        {/* Warning if in Production Mode but registration is unverified */}
        {mode === "PRODUCTION" && !isProductionReady && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start justify-between gap-3 text-xs text-rose-300">
            <div className="flex gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-rose-200">
                  Production Invoice Issuance Blocked
                </p>
                <p className="mt-1 text-slate-300">
                  Foxion&apos;s GST registration is pending or unverified. Real production invoices cannot be issued until all safeguards pass:
                </p>
                <ul className="list-disc list-inside mt-1.5 space-y-0.5 text-rose-300/90 font-mono text-[11px]">
                  {readinessBlockers.map((b, idx) => (
                    <li key={idx}>{b}</li>
                  ))}
                </ul>
                <p className="mt-2 text-slate-400">
                  You can still create drafts and test documents in Test Mode, or configure registration in Invoice Settings.
                </p>
              </div>
            </div>
            <Link href="/settings/invoices">
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 border-rose-500/30 text-rose-300 hover:bg-rose-500/20"
              >
                <Settings className="w-3.5 h-3.5 mr-1.5" />
                Configure Settings
              </Button>
            </Link>
          </div>
        )}

        {/* Split Screen Container */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left Column: Form */}
          <div
            className={`xl:col-span-6 space-y-5 ${
              activeTab === "preview" ? "hidden xl:block" : "block"
            }`}
          >
            {/* 1. Invoice Basics */}
            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader className="py-3.5 px-4 border-b border-slate-800">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">
                    1
                  </span>
                  Invoice Date &amp; Financial Year
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Invoice Date <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Platform
                    </label>
                    <Select
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value)}
                      options={[
                        { value: "Meesho", label: "Meesho" },
                        { value: "Amazon", label: "Amazon" },
                        { value: "Flipkart", label: "Flipkart" },
                        { value: "Direct Webstore", label: "Direct Webstore" },
                        { value: "Instagram", label: "Instagram" },
                        { value: "Other", label: "Other" },
                      ]}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 2. Buyer / Customer */}
            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader className="py-3.5 px-4 border-b border-slate-800">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">
                    2
                  </span>
                  Buyer / Customer Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Customer / Business Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Rahul Sharma or ABC Enterprises"
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Customer Type
                    </label>
                    <Select
                      value={buyerType}
                      onChange={(e) =>
                        setBuyerType(
                          e.target.value as "B2C_UNREGISTERED" | "B2B_REGISTERED" | "OTHER"
                        )
                      }
                      options={[
                        { value: "B2C_UNREGISTERED", label: "B2C (Unregistered)" },
                        { value: "B2B_REGISTERED", label: "B2B (Registered)" },
                        { value: "OTHER", label: "Other" },
                      ]}
                    />
                  </div>
                </div>

                {buyerType === "B2B_REGISTERED" && (
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Customer GSTIN <span className="text-indigo-400">(Optional for B2C)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="24ABCDE1234F1Z5"
                      value={buyerGstin}
                      onChange={(e) => setBuyerGstin(e.target.value.toUpperCase())}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-indigo-500 uppercase"
                    />
                  </div>
                )}

                {/* Billing Address */}
                <div className="space-y-3 pt-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Billing Address
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Address line 1 *"
                      value={line1}
                      onChange={(e) => setLine1(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                    <input
                      type="text"
                      placeholder="Address line 2 (Optional)"
                      value={line2}
                      onChange={(e) => setLine2(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <input
                      type="text"
                      placeholder="City *"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                    <select
                      value={state}
                      onChange={(e) => handleStateChange(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      {INDIAN_STATES.map((s) => (
                        <option key={s.code} value={s.name}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Pincode"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Contact */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <input
                    type="text"
                    placeholder="Phone number"
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    type="email"
                    placeholder="Customer email"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Shipping Address checkbox */}
                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={sameAsBilling}
                      onChange={(e) => setSameAsBilling(e.target.checked)}
                      className="rounded border-slate-800 text-indigo-600 focus:ring-0"
                    />
                    Shipping address is the same as billing address
                  </label>
                </div>

                {!sameAsBilling && (
                  <div className="space-y-3 pt-2 border-t border-slate-800">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Shipping Address
                    </label>
                    <input
                      type="text"
                      placeholder="Shipping line 1"
                      value={shipLine1}
                      onChange={(e) => setShipLine1(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                    <div className="grid grid-cols-3 gap-3">
                      <input
                        type="text"
                        placeholder="City"
                        value={shipCity}
                        onChange={(e) => setShipCity(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                      <select
                        value={shipState}
                        onChange={(e) => {
                          setShipState(e.target.value);
                          const f = INDIAN_STATES.find((s) => s.name === e.target.value);
                          if (f) setShipStateCode(f.code);
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        {INDIAN_STATES.map((s) => (
                          <option key={s.code} value={s.name}>
                            {s.name} ({s.code})
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Pincode"
                        value={shipPincode}
                        onChange={(e) => setShipPincode(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 3. Marketplace & Shipment References */}
            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader className="py-3.5 px-4 border-b border-slate-800">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">
                    3
                  </span>
                  Marketplace &amp; Courier References (Informational)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Marketplace Order ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 1928374650123"
                      value={marketplaceOrderId}
                      onChange={(e) => setMarketplaceOrderId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Courier / Logistics Partner
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Delhivery, Shadowfax, XpressBees"
                      value={courierCompany}
                      onChange={(e) => setCourierCompany(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      AWB / Tracking Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 293847561029"
                      value={awbNumber}
                      onChange={(e) => setAwbNumber(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Marketplace Ref
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Sub-order ref"
                      value={marketplaceRef}
                      onChange={(e) => setMarketplaceRef(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 4. Line Items */}
            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader className="py-3.5 px-4 border-b border-slate-800 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">
                    4
                  </span>
                  Line Items ({items.length})
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addItem}
                  className="h-8 text-xs border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Line Item
                </Button>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-3 relative group"
                  >
                    <div className="flex justify-between items-center text-xs text-slate-400">
                      <span className="font-semibold text-white">Item #{idx + 1}</span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Description <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Product description / title"
                          value={item.description}
                          onChange={(e) => updateItem(idx, "description", e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          HSN / SAC
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 61091000"
                          value={item.hsnSac}
                          onChange={(e) => updateItem(idx, "hsnSac", e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(idx, "quantity", Math.max(1, Number(e.target.value)))
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Unit
                        </label>
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => updateItem(idx, "unit", e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Unit Price (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateItem(idx, "unitPrice", Math.max(0, Number(e.target.value)))
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Discount Type
                        </label>
                        <select
                          value={item.discountType}
                          onChange={(e) =>
                            updateItem(
                              idx,
                              "discountType",
                              e.target.value as "NONE" | "PERCENT" | "FIXED"
                            )
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="NONE">None</option>
                          <option value="PERCENT">% Off</option>
                          <option value="FIXED">₹ Fixed</option>
                        </select>
                      </div>

                      {item.discountType !== "NONE" ? (
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Discount Val
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={item.discountValue}
                            onChange={(e) =>
                              updateItem(idx, "discountValue", Math.max(0, Number(e.target.value)))
                            }
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            GST Rate
                          </label>
                          <select
                            value={item.gstRate}
                            onChange={(e) => updateItem(idx, "gstRate", Number(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                          >
                            <option value={0}>0%</option>
                            <option value={5}>5%</option>
                            <option value={12}>12%</option>
                            <option value={18}>18%</option>
                            <option value={28}>28%</option>
                          </select>
                        </div>
                      )}
                    </div>

                    {item.discountType !== "NONE" && (
                      <div className="w-1/3">
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          GST Rate
                        </label>
                        <select
                          value={item.gstRate}
                          onChange={(e) => updateItem(idx, "gstRate", Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                        >
                          <option value={0}>0%</option>
                          <option value={5}>5%</option>
                          <option value={12}>12%</option>
                          <option value={18}>18%</option>
                          <option value={28}>28%</option>
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 5. Tax Treatment & Settings */}
            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader className="py-3.5 px-4 border-b border-slate-800">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">
                    5
                  </span>
                  Tax Treatment &amp; Place of Supply
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Tax Treatment
                    </label>
                    <Select
                      value={taxTreatment}
                      onChange={(e) =>
                        setTaxTreatment(
                          e.target.value as "INTRA_STATE" | "INTER_STATE" | "EXEMPT" | "NIL"
                        )
                      }
                      options={[
                        {
                          value: "INTRA_STATE",
                          label: "Intra-State (CGST + SGST)",
                        },
                        {
                          value: "INTER_STATE",
                          label: "Inter-State (IGST)",
                        },
                        { value: "EXEMPT", label: "Exempt (0% GST)" },
                        { value: "NIL", label: "Nil Rated" },
                      ]}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Place of Supply
                    </label>
                    <input
                      type="text"
                      disabled
                      value={`${placeOfSupply} (${placeOfSupplyCode})`}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-6 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={applyRoundOff}
                      onChange={(e) => setApplyRoundOff(e.target.checked)}
                      className="rounded border-slate-800 text-indigo-600 focus:ring-0"
                    />
                    Apply Round-off (Nearest Rupee)
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={reverseCharge}
                      onChange={(e) => setReverseCharge(e.target.checked)}
                      className="rounded border-slate-800 text-indigo-600 focus:ring-0"
                    />
                    Tax payable on reverse charge basis
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={exportPng}
                      onChange={(e) => setExportPng(e.target.checked)}
                      className="rounded border-slate-800 text-indigo-600 focus:ring-0"
                    />
                    Also generate &amp; store PNG image on issuance
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* 6. Notes & Payment terms */}
            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader className="py-3.5 px-4 border-b border-slate-800">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">
                    6
                  </span>
                  Notes &amp; Terms
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Payment Terms
                  </label>
                  <input
                    type="text"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Additional Notes
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Customer notes or dispatch instructions..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Live HTML Preview */}
          <div
            className={`xl:col-span-6 space-y-4 ${
              activeTab === "form" ? "hidden xl:block" : "block"
            }`}
          >
            {/* Quick summary bar */}
            {previewTotals && (
              <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Taxable Amount</span>
                  <span className="font-bold text-white font-mono text-sm">
                    {formatINR(previewTotals.taxableSubtotal)}
                  </span>
                </div>
                <div>
                  <span className="text-indigo-400 block text-[11px]">Total GST</span>
                  <span className="font-bold text-indigo-300 font-mono text-sm">
                    {formatINR(previewTotals.totalGst)}
                  </span>
                </div>
                <div>
                  <span className="text-emerald-400 block text-[11px]">Amount Payable</span>
                  <span className="font-bold text-emerald-300 font-mono text-base">
                    {formatINR(previewTotals.amountPayable)}
                  </span>
                </div>
              </div>
            )}

            {/* Embedded Iframe Preview */}
            <Card className="bg-slate-900 border-slate-800 overflow-hidden shadow-2xl">
              <div className="p-3 bg-slate-950 border-b border-slate-800 flex justify-between items-center text-xs text-slate-400">
                <span className="flex items-center gap-2 font-medium">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  Real-Time A4 Template Preview
                </span>
                <span className="text-[11px] text-slate-500">
                  Updates automatically as you type
                </span>
              </div>

              <div className="bg-slate-800/40 p-3 sm:p-5 flex justify-center">
                {previewHtml ? (
                  <iframe
                    srcDoc={previewHtml}
                    title="Invoice Preview"
                    className="w-full h-[750px] bg-white rounded shadow-lg border border-slate-700"
                    style={{ minHeight: "750px" }}
                  />
                ) : (
                  <div className="w-full h-[600px] flex items-center justify-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                    Generating preview...
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
