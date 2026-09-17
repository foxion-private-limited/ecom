import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Foxion | Business Management Suite",
  description:
    "Internal accounting, ecommerce accounting, inventory, and business intelligence for Foxion.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-blue-600 selection:text-white">
        {children}
        <Toaster position="top-right" richColors theme="dark" />
      </body>
    </html>
  );
}
