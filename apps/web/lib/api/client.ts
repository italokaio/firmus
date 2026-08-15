"use client";

import type { ApiErrorBody } from "@leilao-erp/types";
import { useAuthStore } from "@/lib/stores/auth-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const CSRF_COOKIE_NAME = "XSRF-TOKEN";
const CSRF_HEADER_NAME = "X-CSRF-Token";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly issues?: unknown,
  ) {
    super(message);
  }
}

/** Lê o cookie legível `XSRF-TOKEN` (a API o grava no login/refresh) para ecoar no header — ver CsrfGuard no backend. */
function readCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1] ?? "") : null;
}

let refreshPromise: Promise<boolean> | null = null;

/** A sessão vive só em cookies httpOnly — aqui só confirmamos se o refresh funcionou, sem tocar em token algum. */
async function refreshSession(): Promise<boolean> {
  const csrfToken = readCsrfToken();
  const response = await fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: csrfToken ? { [CSRF_HEADER_NAME]: csrfToken } : undefined,
  });
  if (!response.ok) {
    useAuthStore.getState().clearSession();
    return false;
  }
  return true;
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Não tenta refresh automático em 401 — usado por login e pelo próprio refresh. */
  skipAuth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { body, skipAuth, headers, method, ...rest } = options;
  const csrfToken = readCsrfToken();
  const isMutating = MUTATING_METHODS.has((method ?? "GET").toUpperCase());

  const response = await fetch(`${API_URL}/api${path}`, {
    ...rest,
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(isMutating && csrfToken ? { [CSRF_HEADER_NAME]: csrfToken } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && !skipAuth && !isRetry) {
    refreshPromise ??= refreshSession().finally(() => {
      refreshPromise = null;
    });
    const refreshed = await refreshPromise;
    if (refreshed) {
      return request<T>(path, options, true);
    }
  }

  if (response.status === 204) return undefined as T;

  // NestJS envia corpo vazio (não o texto "null") quando o handler retorna `null`
  // — response.json() lançaria "Unexpected end of JSON input" nesse caso, então
  // tratamos corpo vazio como `null` explicitamente antes de tentar parsear.
  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = undefined;
  }

  if (!response.ok) {
    const errorBody = payload as ApiErrorBody & { issues?: unknown };
    throw new ApiError(response.status, errorBody?.message ?? "Erro inesperado", errorBody?.issues);
  }

  return payload as T;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
};
