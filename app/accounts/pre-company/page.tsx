"use client";

import React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { AccountsLedgerView } from "@/components/accounts/AccountsLedgerView";

export default function PreCompanyAccountsPage() {
  return (
    <AppLayout>
      <AccountsLedgerView
        accountType="MAIN"
        origin="PRE_COMPANY"
        title="Pre-Company Transactions"
        subtitle="Historical business transactions and expenses recorded prior to official company bank setup"
      />
    </AppLayout>
  );
}
