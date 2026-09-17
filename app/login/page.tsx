"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/lib/ui";
import { Lock, Mail, ShieldCheck, AlertCircle } from "lucide-react";
import { toast } from "sonner";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Invalid credentials");
      }

      toast.success("Welcome back to Foxion!");
      router.push(from);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to log in");
      toast.error(err.message || "Failed to log in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-slate-800 bg-slate-900/90 shadow-xl">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Sign In</CardTitle>
        <CardDescription>
          Enter your credentials to access Foxion internal records
        </CardDescription>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-rose-950/80 border border-rose-800/80 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder=""
          />

          <Input
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full h-10 mt-2 font-semibold"
            loading={loading}
          >
            Sign In to Foxion
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
      <div className="w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/25">
            FX
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Foxion Business Suite
          </h1>
          <p className="text-xs text-slate-400">
            Internal accounting, inventory & ecommerce operations
          </p>
        </div>

        <Suspense
          fallback={
            <div className="p-8 text-center text-slate-400">
              Loading sign in...
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
