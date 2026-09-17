"use client";

import React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { AccountsLedgerView } from "@/components/accounts/AccountsLedgerView";

export default function EcommerceAccountsPage() {
  return (
    <AppLayout>
      <AccountsLedgerView
        accountType="ECOMMERCE"
        title="Ecommerce Accounts"
        subtitle="Financial ledger for Amazon, Meesho, Flipkart, Direct orders, marketplace fees, and refunds"
      />
    </AppLayout>
  );
}
