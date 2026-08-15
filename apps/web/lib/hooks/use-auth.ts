"use client";

import { useRouter } from "next/navigation";
import type { LoginInput, LoginResponse, LoginResult } from "@leilao-erp/types";
import { apiClient } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth-store";

export function useAuth() {
  const router = useRouter();
  const { user, setSession, clearSession } = useAuthStore();

  async function login(input: LoginInput): Promise<LoginResult> {
    const result = await apiClient.post<LoginResult>("/auth/login", input, { skipAuth: true });
    if ("requiresTwoFactor" in result) return result;
    setSession(result.user);
    router.push("/dashboard");
    return result;
  }

  async function verifyTwoFactor(twoFactorToken: string, code: string) {
    const result = await apiClient.post<LoginResponse>(
      "/auth/2fa/verify-login",
      { twoFactorToken, code },
      { skipAuth: true },
    );
    setSession(result.user);
    router.push("/dashboard");
  }

  async function logout() {
    await apiClient.post("/auth/logout", undefined, { skipAuth: true }).catch(() => undefined);
    clearSession();
    router.push("/login");
  }

  return { user, login, verifyTwoFactor, logout };
}
