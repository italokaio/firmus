import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { PropertyStatementDto, StatementStatusFilter } from "@leilao-erp/types";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { FinanceService } from "./finance.service";
import { buildStatement, type StatementTransaction } from "./property-statement";

/**
 * Demonstrativo (DRE) detalhado do imóvel. Os cálculos ficam em `property-statement.ts`
 * (funções puras e testadas); aqui só se buscam os dados.
 */
@Injectable()
export class PropertyStatementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeService: FinanceService,
  ) {}

  async getStatement(
    companyId: string,
    propertyId: string,
    statusFilter: StatementStatusFilter = "TODOS",
    now = new Date(),
  ): Promise<PropertyStatementDto> {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, companyId },
      select: {
        status: true,
        etapaPosAquisicao: true,
        valorAvaliacao: true,
        canceladoEm: true,
        motivoCancelamento: true,
        acquisition: { select: { dataAquisicao: true } },
      },
    });
    if (!property) throw new NotFoundException("Imóvel não encontrado");

    const [transactions, fluxoMensal, orcamento] = await Promise.all([
      this.financeService.listTransactionsByProperty(companyId, propertyId, {}),
      this.financeService.getCashflow(companyId, propertyId),
      this.prisma.renovationTask.aggregate({ where: { propertyId }, _sum: { valorPrevisto: true } }),
    ]);

    return buildStatement({
      propertyId,
      property: {
        status: property.status,
        etapa: property.etapaPosAquisicao,
        avaliacao: property.valorAvaliacao,
        dataAquisicao: property.acquisition?.dataAquisicao ?? null,
        canceladoEm: property.canceladoEm,
        motivoCancelamento: property.motivoCancelamento,
      },
      transactions: transactions as StatementTransaction[],
      reformaOrcado: orcamento._sum.valorPrevisto ?? new Prisma.Decimal(0),
      fluxoMensal,
      statusFilter,
      now,
    });
  }
}
