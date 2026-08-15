"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthenticatedUser } from "@leilao-erp/types";

interface AuthState {
  user: AuthenticatedUser | null;
  hasHydrated: boolean;
  setSession: (user: AuthenticatedUser) => void;
  clearSession: () => void;
}

/**
 * A sessão de verdade vive em cookies httpOnly (Fase 10 — ver
 * apps/api/src/modules/auth/auth-cookies.ts), inacessíveis a este código por
 * design (mitiga roubo de token via XSS). O que fica em localStorage aqui é
 * só uma cópia de exibição do usuário/permissões para hidratar a UI
 * instantaneamente; a fonte de verdade é sempre revalidada via GET /auth/me
 * no boot do app (ver AuthGuard).
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      hasHydrated: false,
      setSession: (user) => set({ user }),
      clearSession: () => set({ user: null }),
    }),
    {
      name: "leilao-erp-auth",
      onRehydrateStorage: () => (state) => {
        if (state) state.hasHydrated = true;
      },
    },
  ),
);
