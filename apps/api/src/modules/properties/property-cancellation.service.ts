import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  REIMBURSEMENT_CATEGORY_NAME,
  type CancelAcquisitionInput,
  type CancelAcquisitionResultDto,
  type CancelImpactDto,
} from "@leilao-erp/types";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { PropertiesService, type PropertyRowScope } from "./properties.service";

export { REIMBURSEMENT_CATEGORY_NAME };
export const ALREADY_CANCELLED_MESSAGE = "A aquisição deste imóvel já foi cancelada.";
export const ONLY_ACQUIRED_MESSAGE =
  "Só é possível cancelar a aquisição de imóveis adquiridos. Para um imóvel ainda em análise, use o status 'Reprovada'.";

/**
 * Cancelamento de aquisição (Fase 2). Irreversível: preserva os lançamentos
 * realizados, cancela os previstos em aberto e, se houver devolução, registra
 * a receita de reembolso — tudo numa única transação.
 */
@Injectable()
export class PropertyCancellationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly propertiesService: PropertiesService,
  ) {}

  /** Prévia para o diálogo de confirmação: o que será cancelado e o resultado realizado até agora. */
  async getImpact(companyId: string, propertyId: string, scope?: PropertyRowScope): Promise<CancelImpactDto> {
    await this.propertiesService.findById(companyId, propertyId, scope);
    const transactions = await this.prisma.transaction.findMany({
      where: { financeAccount: { companyId, propertyId }, status: { in: ["PREVISTO", "REALIZADO"] } },
      select: { amount: true, status: true, category: { select: { type: true } } },
    });

    let previstosTotal = new Prisma.Decimal(0);
    let previstosCount = 0;
    let receitas = new Prisma.Decimal(0);
    let despesas = new Prisma.Decimal(0);
    for (const tx of transactions) {
      if (tx.status === "PREVISTO") {
        previstosCount += 1;
        previstosTotal = previstosTotal.plus(tx.amount);
      } else if (tx.category.type === "RECEITA") receitas = receitas.plus(tx.amount);
      else despesas = despesas.plus(tx.amount);
    }
    return {
      previstosCount,
      previstosTotal: previstosTotal.toFixed(2),
      realizadoReceitas: receitas.toFixed(2),
      realizadoDespesas: despesas.toFixed(2),
      resultadoRealizado: receitas.minus(despesas).toFixed(2),
    };
  }

  async cancel(
    companyId: string,
    userId: string,
    propertyId: string,
    input: CancelAcquisitionInput,
    scope?: PropertyRowScope,
  ): Promise<CancelAcquisitionResultDto> {
    const property = await this.propertiesService.findById(companyId, propertyId, scope);
    if (property.status === "AQUISICAO_CANCELADA") throw new BadRequestException(ALREADY_CANCELLED_MESSAGE);
    if (property.status !== "ADQUIRIDA") throw new BadRequestException(ONLY_ACQUIRED_MESSAGE);

    const account = await this.prisma.financeAccount.findFirst({ where: { companyId, propertyId } });
    if (!account) throw new BadRequestException("Conta de caixa do imóvel não encontrada");

    const reembolso = input.reembolso;
    const reembolsoOrigem = reembolso?.origemTipo ?? null;
    const reembolsoInvestidorId = reembolsoOrigem === "INVESTIDOR" ? (reembolso?.investidorId ?? null) : null;
    if (reembolsoInvestidorId) {
      const investor = await this.prisma.investor.findFirst({ where: { id: reembolsoInvestidorId, companyId } });
      if (!investor) throw new BadRequestException("Investidor informado não existe nesta empresa");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Guarda contra cancelamento duplo concorrente: só um dos pedidos vence.
      const updated = await tx.property.updateMany({
        where: { id: propertyId, companyId, status: "ADQUIRIDA" },
        data: {
          status: "AQUISICAO_CANCELADA",
          canceladoEm: new Date(input.data),
          canceladoPorId: userId,
          motivoCancelamento: input.motivo,
        },
      });
      if (updated.count !== 1) throw new BadRequestException(ALREADY_CANCELLED_MESSAGE);

      // C6: previstos em aberto → Cancelado (não apagados), cada um com seu histórico.
      const previstos = await tx.transaction.findMany({
        where: { financeAccountId: account.id, status: "PREVISTO" },
        select: { id: true },
      });
      if (previstos.length > 0) {
        await tx.transaction.updateMany({
          where: { id: { in: previstos.map((p) => p.id) } },
          data: { status: "CANCELADO" },
        });
        for (const previsto of previstos) {
          await this.auditService.log({
            client: tx,
            entityType: "Transaction",
            entityId: previsto.id,
            action: "UPDATE",
            before: { campo: "Status", valor: "Previsto" },
            after: { campo: "Status", valor: "Cancelado" },
          });
        }
      }

      // C7: devolução (total ou parcial) = receita de reembolso; o que não voltar fica como perda realizada.
      let reimbursementId: string | null = null;
      if (reembolso) {
        const category = await this.findOrCreateReimbursementCategory(tx, companyId);
        const created = await tx.transaction.create({
          data: {
            financeAccountId: account.id,
            categoryId: category.id,
            amount: reembolso.valor,
            date: new Date(reembolso.data),
            description: `Reembolso — aquisição cancelada: ${input.motivo}`,
            status: reembolso.status,
            origemTipo: reembolsoOrigem,
            investidorId: reembolsoInvestidorId,
            createdById: userId,
          },
        });
        reimbursementId = created.id;
        await this.auditService.log({
          client: tx,
          entityType: "Transaction",
          entityId: created.id,
          action: "CREATE",
          after: { accountId: account.id, amount: reembolso.valor, status: reembolso.status, origem: "reembolso" },
        });
      }

      await this.auditService.log({
        client: tx,
        entityType: "Property",
        entityId: propertyId,
        action: "UPDATE",
        before: { status: "ADQUIRIDA" },
        after: {
          status: "AQUISICAO_CANCELADA",
          motivo: input.motivo,
          canceladoEm: input.data,
          lancamentosCancelados: previstos.length,
          reembolso: reembolso?.valor ?? null,
        },
      });

      return { canceledTransactions: previstos.length, reimbursementTransactionId: reimbursementId };
    });

    return {
      property: (await this.propertiesService.findById(companyId, propertyId, scope)) as never,
      ...result,
    };
  }

  /** Categorias são por empresa e únicas por nome: cria a de reembolso na primeira vez que for preciso. */
  private async findOrCreateReimbursementCategory(tx: Prisma.TransactionClient, companyId: string) {
    const existing = await tx.financeCategory.findFirst({ where: { companyId, name: REIMBURSEMENT_CATEGORY_NAME } });
    if (existing) {
      if (existing.type !== "RECEITA") {
        throw new BadRequestException(
          `Já existe uma categoria "${REIMBURSEMENT_CATEGORY_NAME}" do tipo Despesa. Renomeie-a para registrar o reembolso.`,
        );
      }
      return existing;
    }
    return tx.financeCategory.create({ data: { companyId, name: REIMBURSEMENT_CATEGORY_NAME, type: "RECEITA" } });
  }
}
