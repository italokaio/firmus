"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";

export default function RootPage() {
  const router = useRouter();
  const { user, hasHydrated } = useAuthStore();

  React.useEffect(() => {
    if (!hasHydrated) return;
    router.replace(user ? "/dashboard" : "/login");
  }, [hasHydrated, user, router]);

  return null;
}
