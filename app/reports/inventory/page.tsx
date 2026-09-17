"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RedirectInventory() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/inventory/stock");
  }, [router]);
  return null;
}
