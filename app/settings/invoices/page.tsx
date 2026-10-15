"use client";

import React, { useState, useEffect } from "react";
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
  Modal,
} from "@/lib/ui";
import {
  Settings,
  ShieldCheck,
  ShieldAlert,
  Save,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Building2,
  FileText,
  Palette,
  ArrowLeft,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { INDIAN_STATES } from "@/lib/invoices/validation";

interface SettingsState {
  sellerLegalName: string;
  sellerTradeName: string;
  sellerAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    stateCode: string;
    pincode?: string;
    country?: string;
  };
  sellerGstin: string;
  sellerPhone: string;
  sellerEmail: string;
  logoUrl: string;
  brandColor: string;
  invoicePrefix: string;
  gstRegistrationEffectiveDate: string;
  registrationVerified: boolean;
  registrationVerifiedAt?: string;
  registrationVerifiedBy?: string;
  registrationReference?: string;
  defaultPaymentTerms: string;
  defaultDeclarations: string;
  testMode: boolean;
}

export default function InvoiceSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [isProductionReady, setIsProductionReady] = useState(false);
  const [blockers, setBlockers] = useState<string[]>([]);

  // Verification modal
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifyReference, setVerifyReference] = useState("");
  const [verifying, setVerifying] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings/invoices");
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings({
          ...data.settings,
          gstRegistrationEffectiveDate: data.settings.gstRegistrationEffectiveDate
            ? new Date(data.settings.gstRegistrationEffectiveDate)
                .toISOString()
                .split("T")[0]
            : "",
        });
        setIsProductionReady(data.productionReadiness?.isReady || false);
        setBlockers(data.productionReadiness?.blockers || []);
      }
    } catch {
      toast.error("Failed to load invoice settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleStateChange = (selectedState: string) => {
    if (!settings) return;
    const found = INDIAN_STATES.find((s) => s.name === selectedState);
    setSettings({
      ...settings,
      sellerAddress: {
        ...settings.sellerAddress,
        state: selectedState,
        stateCode: found?.code || "24",
      },
    });
  };

  const handleSave = async () => {
    if (!settings) return;
    if (!settings.sellerLegalName.trim()) {
      toast.error("Seller legal name is required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...settings,
        gstRegistrationEffectiveDate: settings.gstRegistrationEffectiveDate
          ? new Date(settings.gstRegistrationEffectiveDate)
          : null,
      };

      const res = await fetch("/api/settings/invoices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Invoice settings saved successfully");
        setIsProductionReady(data.productionReadiness?.isReady || false);
        setBlockers(data.productionReadiness?.blockers || []);
        fetchSettings();
      } else {
        toast.error(data.error || "Failed to update settings");
      }
    } catch {
      toast.error("Network error saving settings");
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyRegistration = async () => {
    if (!verifyReference.trim()) {
      toast.error("Verification reference is required");
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch("/api/settings/invoices/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: verifyReference.trim(),
          effectiveDate: settings?.gstRegistrationEffectiveDate || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("GST Registration verified successfully!");
        setVerifyModalOpen(false);
        fetchSettings();
      } else {
        toast.error(data.error || "Verification failed");
      }
    } catch {
      toast.error("Network error during verification");
    } finally {
      setVerifying(false);
    }
  };

  const handleRevokeVerification = async () => {
    if (!confirm("Are you sure you want to revoke registration verification? Production issuance will be blocked immediately.")) {
      return;
    }

    try {
      const res = await fetch("/api/settings/invoices/verify", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Registration verification revoked");
        fetchSettings();
      } else {
        toast.error(data.error || "Failed to revoke verification");
      }
    } catch {
      toast.error("Network error revoking verification");
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mb-3 text-indigo-400" />
          <p>Loading invoice configuration...</p>
        </div>
      </AppLayout>
    );
  }

  if (!settings) return null;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Top Header */}
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
                <Settings className="w-6 h-6 text-indigo-400" />
                Invoice &amp; GST Settings
              </h1>
              <p className="text-xs text-slate-400">
                Configure seller snapshots, branding, numbering series, and GST registration status.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            disabled={saving}
            onClick={handleSave}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 font-medium"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>

        {/* GST Registration & Safeguards Banner */}
        <Card
          className={`border ${
            settings.registrationVerified
              ? "bg-emerald-950/20 border-emerald-500/30"
              : "bg-amber-950/20 border-amber-500/30"
          }`}
        >
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={`p-2.5 rounded-xl ${
                    settings.registrationVerified
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-amber-500/20 text-amber-400"
                  }`}
                >
                  {settings.registrationVerified ? (
                    <ShieldCheck className="w-6 h-6" />
                  ) : (
                    <ShieldAlert className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white">
                      GST Registration Status:{" "}
                      {settings.registrationVerified ? (
                        <span className="text-emerald-400">Verified &amp; Active</span>
                      ) : (
                        <span className="text-amber-400">Unverified / Testing Only</span>
                      )}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                    {settings.registrationVerified
                      ? `Authoritatively verified on ${new Date(
                          settings.registrationVerifiedAt || ""
                        ).toLocaleDateString("en-IN")} by ${settings.registrationVerifiedBy}. Ref: ${
                          settings.registrationReference
                        }`
                      : "Foxion's GST registration is pending. The system enforces strict separation: Test Mode is active, and production invoice issuance is blocked on the server."}
                  </p>

                  {!settings.registrationVerified && blockers.length > 0 && (
                    <div className="mt-3 p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
                      <span className="font-semibold text-rose-300 block mb-1">
                        Outstanding Prerequisites for Production Issuance:
                      </span>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-400 text-[11px] font-mono">
                        {blockers.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {settings.registrationVerified ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRevokeVerification}
                    className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs"
                  >
                    Revoke Verification
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!settings.sellerGstin) {
                        toast.error("Please enter and save a valid GSTIN first");
                        return;
                      }
                      setVerifyReference("Authorized Admin Verification");
                      setVerifyModalOpen(true);
                    }}
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1.5 font-medium"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Verify GST Registration
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Seller Identity */}
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="py-3.5 px-4 border-b border-slate-800">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-400" />
                Seller Identity &amp; Registration
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Legal Business Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={settings.sellerLegalName}
                  onChange={(e) =>
                    setSettings({ ...settings, sellerLegalName: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Trade Name (if different)
                </label>
                <input
                  type="text"
                  value={settings.sellerTradeName}
                  onChange={(e) =>
                    setSettings({ ...settings, sellerTradeName: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Seller GSTIN
                </label>
                <input
                  type="text"
                  placeholder="24ABCDE1234F1Z5"
                  value={settings.sellerGstin}
                  onChange={(e) =>
                    setSettings({ ...settings, sellerGstin: e.target.value.toUpperCase() })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-indigo-500 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  GST Registration Effective Date
                </label>
                <input
                  type="date"
                  value={settings.gstRegistrationEffectiveDate}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      gstRegistrationEffectiveDate: e.target.value,
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  The system prevents issuing GST invoices dated prior to this effective date.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={settings.sellerPhone}
                    onChange={(e) =>
                      setSettings({ ...settings, sellerPhone: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Billing Email
                  </label>
                  <input
                    type="email"
                    value={settings.sellerEmail}
                    onChange={(e) =>
                      setSettings({ ...settings, sellerEmail: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Registered Address */}
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="py-3.5 px-4 border-b border-slate-800">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                Registered Place of Business Address
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Address Line 1 <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={settings.sellerAddress.line1}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      sellerAddress: { ...settings.sellerAddress, line1: e.target.value },
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Address Line 2
                </label>
                <input
                  type="text"
                  value={settings.sellerAddress.line2 || ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      sellerAddress: { ...settings.sellerAddress, line2: e.target.value },
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    City <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={settings.sellerAddress.city}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        sellerAddress: { ...settings.sellerAddress, city: e.target.value },
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    State <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={settings.sellerAddress.state}
                    onChange={(e) => handleStateChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    {INDIAN_STATES.map((s) => (
                      <option key={s.code} value={s.name}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Pincode
                  </label>
                  <input
                    type="text"
                    value={settings.sellerAddress.pincode || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        sellerAddress: { ...settings.sellerAddress, pincode: e.target.value },
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    State Code (Auto)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={settings.sellerAddress.stateCode}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-400 cursor-not-allowed font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Invoice Series Prefix
                  </label>
                  <input
                    type="text"
                    value={settings.invoicePrefix}
                    onChange={(e) =>
                      setSettings({ ...settings, invoicePrefix: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Branding & Visuals */}
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="py-3.5 px-4 border-b border-slate-800">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Palette className="w-4 h-4 text-indigo-400" />
                Branding &amp; Template Styling
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Logo URL (Optional)
                </label>
                <input
                  type="text"
                  placeholder="https://... or /logo.png"
                  value={settings.logoUrl || ""}
                  onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Leaves header clean if left blank.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Brand Accent Colour (Hex)
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={settings.brandColor}
                    onChange={(e) =>
                      setSettings({ ...settings, brandColor: e.target.value })
                    }
                    className="h-9 w-12 rounded cursor-pointer bg-slate-950 border border-slate-800 p-0.5"
                  />
                  <input
                    type="text"
                    value={settings.brandColor}
                    onChange={(e) =>
                      setSettings({ ...settings, brandColor: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={settings.testMode}
                    onChange={(e) =>
                      setSettings({ ...settings, testMode: e.target.checked })
                    }
                    className="rounded border-slate-800 text-indigo-600 focus:ring-0"
                  />
                  Enable Test Mode by default for new invoices
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Default Terms & Declarations */}
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="py-3.5 px-4 border-b border-slate-800">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                Default Terms &amp; Declarations
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Default Payment Terms
                </label>
                <input
                  type="text"
                  value={settings.defaultPaymentTerms || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, defaultPaymentTerms: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Default Legal Declaration
                </label>
                <textarea
                  rows={4}
                  value={settings.defaultDeclarations || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, defaultDeclarations: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Verification Modal */}
        <Modal
          isOpen={verifyModalOpen}
          onClose={() => setVerifyModalOpen(false)}
          title="Authoritative GST Registration Verification"
        >
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs">
              <strong>Registration Verification Step:</strong> Confirms that Foxion&apos;s GSTIN
              is active on the GST portal and enables production invoice issuance. This action is
              recorded in the audit log.
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Verification Reference / ARN / Authority Reference <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={verifyReference}
                onChange={(e) => setVerifyReference(e.target.value)}
                placeholder="e.g. GST Portal REG-06 / ARN: AA2403260012345"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVerifyModalOpen(false)}
                className="border-slate-700"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={verifying || !verifyReference.trim()}
                onClick={handleVerifyRegistration}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {verifying ? "Verifying..." : "Confirm & Authorize Production"}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AppLayout>
  );
}
