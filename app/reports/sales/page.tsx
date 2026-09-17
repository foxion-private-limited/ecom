"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RedirectSales() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/ecommerce/sales");
  }, [router]);
  return null;
}
