import { SetMetadata } from "@nestjs/common";
import type { PermissionValue } from "@leilao-erp/types";

export const PERMISSION_KEY = "requiredPermission";

/** Exige que o usuário autenticado possua a permissão informada (ex.: "users:create"). */
export const RequirePermission = (permission: PermissionValue) =>
  SetMetadata(PERMISSION_KEY, permission);
