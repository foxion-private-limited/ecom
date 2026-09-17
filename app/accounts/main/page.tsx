"use client";

import React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { AccountsLedgerView } from "@/components/accounts/AccountsLedgerView";

export default function MainAccountsPage() {
  return (
    <AppLayout>
      <AccountsLedgerView
        accountType="MAIN"
        title="Main Company Accounts"
        subtitle="General operational accounting, rent, salaries, utilities, purchases, bank & cash ledger"
      />
    </AppLayout>
  );
}
