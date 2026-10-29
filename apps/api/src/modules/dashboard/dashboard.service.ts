import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { PortfolioDashboardDto } from "@leilao-erp/types";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { FinanceService } from "../finance/finance.service";
import { buildAlerts, computePortfolio, type MetricProperty, type MetricTransaction } from "./portfolio-metrics";

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeService: FinanceService,
  ) {}

  /**
   * Visão do negócio: onde está cada imóvel, quanto capital está empatado, de quem veio e quanto
   * deve virar resultado. Os cálculos ficam em `portfolio-metrics.ts` (funções puras e testadas);
   * aqui só se buscam os dados.
   */
  async getPortfolio(companyId: string, month?: string, now = new Date()): Promise<PortfolioDashboardDto> {
    const [properties, transactions, summary, aportes, legalCases, legalEvents, tasks, receivables] =
      await Promise.all([
        this.prisma.property.findMany({
          where: { companyId },
          select: {
            id: true,
            origem: true,
            status: true,
            prioridade: true,
            valorAvaliacao: true,
            etapaPosAquisicao: true,
            acquisition: { select: { dataAquisicao: true } },
          },
        }),
        this.prisma.transaction.findMany({
          where: { financeAccount: { companyId }, status: { not: "CANCELADO" } },
          select: {
            amount: true,
            status: true,
            date: true,
            origemTipo: true,
            investidorId: true,
            investidor: { select: { name: true } },
            category: { select: { type: true } },
            financeAccount: { select: { propertyId: true } },
          },
        }),
        this.financeService.getSummary(companyId),
        this.prisma.propertyInvestor.aggregate({
          where: { property: { companyId } },
          _sum: { valorAporte: true },
        }),
        this.prisma.legalCase.findMany({
          where: { status: "AGUARDANDO_PAGAMENTO", property: { companyId, status: "ADQUIRIDA" } },
          select: { propertyId: true },
        }),
        this.prisma.legalCaseEvent.findMany({
          where: { status: "PENDENTE", legalCase: { property: { companyId } } },
          select: { dueDate: true, legalCase: { select: { propertyId: true } } },
        }),
        this.prisma.renovationTask.findMany({
          where: { property: { companyId } },
          select: {
            propertyId: true,
            dueDate: true,
            percentualConcluido: true,
            valorPrevisto: true,
            valorRealizado: true,
          },
        }),
        this.prisma.receivable.findMany({
          where: { status: "PENDENTE", sale: { property: { companyId } } },
          select: { dataVencimento: true, sale: { select: { propertyId: true } } },
        }),
      ]);

    const metricProperties: MetricProperty[] = properties.map((p) => ({
      id: p.id,
      origem: p.origem,
      status: p.status,
      prioridade: p.prioridade,
      avaliacao: p.valorAvaliacao,
      etapa: p.etapaPosAquisicao,
      dataAquisicao: p.acquisition?.dataAquisicao ?? null,
    }));
    const metricTransactions: MetricTransaction[] = transactions.map((tx) => ({
      propertyId: tx.financeAccount.propertyId,
      amount: tx.amount,
      status: tx.status,
      date: tx.date,
      categoryType: tx.category.type,
      origemTipo: tx.origemTipo,
      investidorId: tx.investidorId,
      investidorName: tx.investidor?.name ?? null,
    }));

    const dto = computePortfolio(
      metricProperties,
      metricTransactions,
      {
        saldoConsolidado: summary.saldoConsolidado,
        aportesRegistrados: (aportes._sum.valorAporte ?? new Prisma.Decimal(0)).toFixed(2),
      },
      { month, now },
    );

    const adquiridos = metricProperties.filter((p) => p.status === "ADQUIRIDA");
    const adquiridoIds = new Set(adquiridos.map((p) => p.id));
    const rowsById = new Map(dto.adquiridos.map((row) => [row.id, row]));
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    dto.alertas = buildAlerts({
      now,
      adquiridos: adquiridos.map((p) => ({
        id: p.id,
        origem: p.origem,
        etapa: p.etapa,
        semAvaliacao: rowsById.get(p.id)?.semAvaliacao ?? false,
      })),
      legalCasesAguardandoPagamento: legalCases,
      legalEventsPendentes: legalEvents.map((e) => ({ propertyId: e.legalCase.propertyId, dueDate: e.dueDate })),
      renovationTasks: tasks,
      receivablesPendentes: receivables.map((r) => ({
        propertyId: r.sale.propertyId,
        dataVencimento: r.dataVencimento,
      })),
      lancamentosSemOrigem: metricTransactions
        .filter(
          (tx) =>
            tx.propertyId &&
            adquiridoIds.has(tx.propertyId) &&
            tx.status === "REALIZADO" &&
            tx.categoryType === "DESPESA" &&
            !tx.origemTipo,
        )
        .map((tx) => ({ propertyId: tx.propertyId! })),
      previstosVencidos: metricTransactions.filter((tx) => tx.status === "PREVISTO" && tx.date < today).length,
    });

    return dto;
  }

  async getSummary(companyId: string) {
    const [usersCount, rolesCount, propertiesCount, propertiesByStatus, propertiesByPriority, financeSummary] =
      await Promise.all([
        this.prisma.user.count({ where: { companyId, active: true } }),
        this.prisma.role.count({ where: { companyId } }),
        this.prisma.property.count({ where: { companyId } }),
        this.prisma.property.groupBy({
          by: ["status"],
          where: { companyId },
          _count: true,
        }),
        this.prisma.property.groupBy({
          by: ["prioridade"],
          where: { companyId },
          _count: true,
        }),
        this.financeService.getSummary(companyId),
      ]);

    return {
      usersCount,
      rolesCount,
      propertiesCount,
      propertiesByStatus: propertiesByStatus.map((row) => ({
        status: row.status,
        count: row._count,
      })),
      propertiesByPriority: propertiesByPriority.map((row) => ({
        prioridade: row.prioridade,
        count: row._count,
      })),
      finance: financeSummary,
    };
  }
}
