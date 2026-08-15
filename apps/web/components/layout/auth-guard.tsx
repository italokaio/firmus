"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { AuthenticatedUser } from "@leilao-erp/types";
import { apiClient } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth-store";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, hasHydrated, setSession, clearSession } = useAuthStore();
  const [verified, setVerified] = React.useState(false);

  React.useEffect(() => {
    if (!hasHydrated) return;

    // O localStorage só acelera a primeira pintura; a sessão de verdade mora
    // no cookie httpOnly, então sempre revalidamos contra a API no boot —
    // cobre cookie expirado/revogado e permissões que mudaram desde o último acesso.
    apiClient
      .get<{ user: AuthenticatedUser }>("/auth/me")
      .then((res) => setSession(res.user))
      .catch(() => {
        clearSession();
        router.replace("/login");
      })
      .finally(() => setVerified(true));
  }, [hasHydrated, router, setSession, clearSession]);

  if (!hasHydrated || !verified || !user) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
