import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContextStore {
  companyId: string;
  userId: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Contexto por requisição (empresa/usuário/IP) acessível em qualquer camada
 * sem precisar repassar parâmetros manualmente — usado principalmente pelo
 * AuditService para registrar "quem fez o quê" sem acoplar todos os services
 * à camada HTTP.
 */
export const requestContextStorage = new AsyncLocalStorage<RequestContextStore>();

export function getRequestContext(): RequestContextStore | undefined {
  return requestContextStorage.getStore();
}
