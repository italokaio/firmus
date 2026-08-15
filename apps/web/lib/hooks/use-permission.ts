"use client";

import type { PermissionValue } from "@leilao-erp/types";
import { useAuthStore } from "@/lib/stores/auth-store";

export function usePermission(permission: PermissionValue): boolean {
  return useAuthStore((state) => state.user?.permissions.includes(permission) ?? false);
}
