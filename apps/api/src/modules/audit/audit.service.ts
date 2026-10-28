import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { getRequestContext } from "../../common/context/request-context";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT";

interface LogParams {
  entityType: string;
  entityId: string;
  action: AuditAction;
  before?: unknown;
  after?: unknown;
  /** Necessário apenas em fluxos sem usuário autenticado ainda (ex.: login). */
  companyId?: string;
  userId?: string;
  /** Cliente da transação em curso, para gravar a auditoria atomicamente com a mudança auditada. */
  client?: Prisma.TransactionClient;
}

/**
 * Registro de auditoria append-only: nenhum método de update/delete é exposto
 * de propósito. O contexto (empresa/usuário/IP) vem do AsyncLocalStorage
 * populado pelo RequestContextInterceptor, então a maioria dos chamadores
 * não precisa informar companyId/userId manualmente.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(params: LogParams): Promise<void> {
    const ctx = getRequestContext();
    const companyId = params.companyId ?? ctx?.companyId;
    const userId = params.userId ?? ctx?.userId;

    if (!companyId) {
      this.logger.warn(
        `Auditoria ignorada por falta de companyId (entidade ${params.entityType}/${params.entityId})`,
      );
      return;
    }

    await (params.client ?? this.prisma).auditLog.create({
      data: {
        companyId,
        userId: userId ?? null,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        before: params.before as never,
        after: params.after as never,
        ip: ctx?.ip,
        userAgent: ctx?.userAgent,
      },
    });
  }
}
