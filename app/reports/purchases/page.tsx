"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RedirectPurchases() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/purchases");
  }, [router]);
  return null;
}
