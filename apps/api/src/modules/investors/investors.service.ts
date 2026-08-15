import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  CreateInvestorInput,
  CreatePropertyInvestorInput,
  CreateProfitDistributionInput,
  UpdateInvestorInput,
  UpdatePropertyInvestorInput,
  UpdateProfitDistributionInput,
} from "@leilao-erp/types";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { FinanceService } from "../finance/finance.service";

const investorSummaryInclude = { investor: { select: { id: true, name: true, document: true } } };

/**
 * Escopo por linha para contas vinculadas a um Investor (`user.investorId`):
 * só enxergam o próprio registro/participações — nunca a carteira inteira de
 * investidores da empresa. Contas de equipe (sem investorId) não são afetadas.
 */
export interface InvestorRowScope {
  investorId?: string;
}

@Injectable()
export class InvestorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly financeService: FinanceService,
  ) {}

  // ---------- Investidores (empresa) ----------

  async listInvestors(companyId: string, scope?: InvestorRowScope) {
    const investors = await this.prisma.investor.findMany({
      where: { companyId, id: scope?.investorId },
      include: { participations: { select: { valorAporte: true } } },
      orderBy: { name: "asc" },
    });

    return investors.map(({ participations, ...investor }) => ({
      ...investor,
      participationsCount: participations.length,
      totalAporte: participations
        .reduce((sum, p) => sum.plus(p.valorAporte), new Prisma.Decimal(0))
        .toFixed(2),
    }));
  }

  async getInvestorDetail(companyId: string, id: string, scope?: InvestorRowScope) {
    if (scope?.investorId && scope.investorId !== id) {
      throw new NotFoundException("Investidor não encontrado");
    }
    const investor = await this.prisma.investor.findFirst({
      where: { id, companyId },
      include: {
        participations: {
          include: {
            property: { select: { id: true, origem: true } },
            distributions: { orderBy: { createdAt: "desc" } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!investor) throw new NotFoundException("Investidor não encontrado");

    const { participations, ...rest } = investor;
    return {
      ...rest,
      participationsCount: participations.length,
      totalAporte: participations
        .reduce((sum, p) => sum.plus(p.valorAporte), new Prisma.Decimal(0))
        .toFixed(2),
      participations,
    };
  }

  async createInvestor(companyId: string, input: CreateInvestorInput) {
    const existing = await this.prisma.investor.findFirst({ where: { companyId, document: input.document } });
    if (existing) throw new ConflictException("Já existe um investidor com este CPF/CNPJ");

    const investor = await this.prisma.investor.create({
      data: { companyId, ...input, email: input.email || null },
    });
    await this.auditService.log({
      entityType: "Investor",
      entityId: investor.id,
      action: "CREATE",
      after: { name: input.name, document: input.document },
    });
    return investor;
  }

  async updateInvestor(companyId: string, id: string, input: UpdateInvestorInput) {
    const before = await this.assertInvestorBelongsToCompany(companyId, id);

    if (input.document && input.document !== before.document) {
      const existing = await this.prisma.investor.findFirst({
        where: { companyId, document: input.document, id: { not: id } },
      });
      if (existing) throw new ConflictException("Já existe um investidor com este CPF/CNPJ");
    }

    const updated = await this.prisma.investor.update({
      where: { id },
      data: { ...input, email: input.email === "" ? null : input.email },
    });
    await this.auditService.log({
      entityType: "Investor",
      entityId: id,
      action: "UPDATE",
      before: { name: before.name },
      after: { name: updated.name },
    });
    return updated;
  }

  async deleteInvestor(companyId: string, id: string) {
    const investor = await this.assertInvestorBelongsToCompany(companyId, id);
    const participationsCount = await this.prisma.propertyInvestor.count({ where: { investorId: id } });
    if (participationsCount > 0) {
      throw new ConflictException("Investidor possui participações em imóveis e não pode ser removido");
    }

    await this.prisma.investor.delete({ where: { id } });
    await this.auditService.log({ entityType: "Investor", entityId: id, action: "DELETE", before: investor });
  }

  // ---------- Participações por imóvel ----------

  async listPropertyInvestors(companyId: string, propertyId: string, scope?: InvestorRowScope) {
    await this.assertPropertyBelongsToCompany(companyId, propertyId, scope);
    return this.prisma.propertyInvestor.findMany({
      where: { propertyId, investorId: scope?.investorId },
      include: investorSummaryInclude,
      orderBy: { createdAt: "asc" },
    });
  }

  async addPropertyInvestor(companyId: string, propertyId: string, input: CreatePropertyInvestorInput) {
    await this.assertPropertyBelongsToCompany(companyId, propertyId);
    await this.assertInvestorBelongsToCompany(companyId, input.investorId);

    const existing = await this.prisma.propertyInvestor.findUnique({
      where: { propertyId_investorId: { propertyId, investorId: input.investorId } },
    });
    if (existing) throw new ConflictException("Este investidor já participa deste imóvel");

    await this.assertPercentualWithinLimit(propertyId, input.percentual);

    const participation = await this.prisma.propertyInvestor.create({
      data: {
        propertyId,
        investorId: input.investorId,
        percentual: input.percentual,
        valorAporte: input.valorAporte,
        dataAporte: input.dataAporte ? new Date(input.dataAporte) : undefined,
        observacoes: input.observacoes,
      },
      include: investorSummaryInclude,
    });

    await this.auditService.log({
      entityType: "PropertyInvestor",
      entityId: participation.id,
      action: "CREATE",
      after: { propertyId, investorId: input.investorId, percentual: input.percentual },
    });

    return participation;
  }

  async updatePropertyInvestor(
    companyId: string,
    propertyId: string,
    id: string,
    input: UpdatePropertyInvestorInput,
  ) {
    const participation = await this.findParticipationOrThrow(companyId, propertyId, id);

    if (input.percentual) {
      await this.assertPercentualWithinLimit(propertyId, input.percentual, id);
    }

    const updated = await this.prisma.propertyInvestor.update({
      where: { id },
      data: {
        percentual: input.percentual,
        valorAporte: input.valorAporte,
        dataAporte: input.dataAporte === undefined ? undefined : input.dataAporte ? new Date(input.dataAporte) : null,
        observacoes: input.observacoes,
      },
      include: investorSummaryInclude,
    });

    await this.auditService.log({
      entityType: "PropertyInvestor",
      entityId: id,
      action: "UPDATE",
      before: { percentual: participation.percentual.toString() },
      after: { percentual: updated.percentual.toString() },
    });

    return updated;
  }

  async removePropertyInvestor(companyId: string, propertyId: string, id: string) {
    const participation = await this.findParticipationOrThrow(companyId, propertyId, id);
    const distributionsCount = await this.prisma.profitDistribution.count({ where: { propertyInvestorId: id } });
    if (distributionsCount > 0) {
      throw new ConflictException(
        "Esta participação possui distribuições de lucro registradas e não pode ser removida",
      );
    }

    await this.prisma.propertyInvestor.delete({ where: { id } });
    await this.auditService.log({
      entityType: "PropertyInvestor",
      entityId: id,
      action: "DELETE",
      before: { propertyId, investorId: participation.investorId },
    });
  }

  async getSuggestedLucroBase(companyId: string, propertyId: string, scope?: InvestorRowScope) {
    await this.assertPropertyBelongsToCompany(companyId, propertyId, scope);
    const dre = await this.financeService.getDre(companyId, propertyId);
    return { lucroBaseSugerido: dre.lucroLiquido };
  }

  // ---------- Distribuição de lucro ----------

  async listDistributions(
    companyId: string,
    propertyId: string,
    propertyInvestorId: string,
    scope?: InvestorRowScope,
  ) {
    await this.findParticipationOrThrow(companyId, propertyId, propertyInvestorId, scope);
    return this.prisma.profitDistribution.findMany({
      where: { propertyInvestorId },
      orderBy: { createdAt: "desc" },
    });
  }

  async createDistribution(
    companyId: string,
    propertyId: string,
    propertyInvestorId: string,
    input: CreateProfitDistributionInput,
  ) {
    const participation = await this.findParticipationOrThrow(companyId, propertyId, propertyInvestorId);

    const lucroBase = new Prisma.Decimal(input.lucroBase);
    const percentualAplicado = new Prisma.Decimal(participation.percentual);
    const aliquotaIR = new Prisma.Decimal(input.aliquotaIR);
    const valorBruto = lucroBase.times(percentualAplicado).dividedBy(100);
    const valorIR = valorBruto.times(aliquotaIR).dividedBy(100);
    const valorLiquido = valorBruto.minus(valorIR);

    const distribution = await this.prisma.profitDistribution.create({
      data: {
        propertyInvestorId,
        lucroBase,
        percentualAplicado,
        valorBruto,
        aliquotaIR,
        valorIR,
        valorLiquido,
        observacoes: input.observacoes,
      },
    });

    await this.auditService.log({
      entityType: "ProfitDistribution",
      entityId: distribution.id,
      action: "CREATE",
      after: { propertyInvestorId, valorLiquido: valorLiquido.toFixed(2) },
    });

    return distribution;
  }

  async updateDistribution(
    companyId: string,
    propertyId: string,
    propertyInvestorId: string,
    id: string,
    input: UpdateProfitDistributionInput,
  ) {
    await this.findParticipationOrThrow(companyId, propertyId, propertyInvestorId);
    const distribution = await this.prisma.profitDistribution.findFirst({
      where: { id, propertyInvestorId },
    });
    if (!distribution) throw new NotFoundException("Distribuição não encontrada");

    const statusChanged = input.status !== undefined && input.status !== distribution.status;

    const updated = await this.prisma.profitDistribution.update({
      where: { id },
      data: {
        status: input.status,
        observacoes: input.observacoes,
        dataPagamento: statusChanged ? (input.status === "PAGO" ? new Date() : null) : undefined,
      },
    });

    await this.auditService.log({
      entityType: "ProfitDistribution",
      entityId: id,
      action: "UPDATE",
      before: { status: distribution.status },
      after: { status: updated.status },
    });

    return updated;
  }

  async deleteDistribution(companyId: string, propertyId: string, propertyInvestorId: string, id: string) {
    await this.findParticipationOrThrow(companyId, propertyId, propertyInvestorId);
    const distribution = await this.prisma.profitDistribution.findFirst({ where: { id, propertyInvestorId } });
    if (!distribution) throw new NotFoundException("Distribuição não encontrada");
    if (distribution.status === "PAGO") {
      throw new ConflictException("Distribuições já pagas não podem ser excluídas — preserve o histórico");
    }

    await this.prisma.profitDistribution.delete({ where: { id } });
    await this.auditService.log({
      entityType: "ProfitDistribution",
      entityId: id,
      action: "DELETE",
      before: { propertyInvestorId, valorLiquido: distribution.valorLiquido.toString() },
    });
  }

  // ---------- Helpers ----------

  private async assertPercentualWithinLimit(propertyId: string, percentual: string, excludeId?: string) {
    const others = await this.prisma.propertyInvestor.findMany({
      where: { propertyId, id: excludeId ? { not: excludeId } : undefined },
      select: { percentual: true },
    });
    const total = others.reduce((sum, p) => sum.plus(p.percentual), new Prisma.Decimal(percentual));
    if (total.greaterThan(100)) {
      throw new BadRequestException(
        `A soma dos percentuais de participação excederia 100% (ficaria em ${total.toFixed(2)}%)`,
      );
    }
  }

  private async findParticipationOrThrow(
    companyId: string,
    propertyId: string,
    id: string,
    scope?: InvestorRowScope,
  ) {
    await this.assertPropertyBelongsToCompany(companyId, propertyId, scope);
    const participation = await this.prisma.propertyInvestor.findFirst({
      where: { id, propertyId, investorId: scope?.investorId },
    });
    if (!participation) throw new NotFoundException("Participação não encontrada");
    return participation;
  }

  private async assertPropertyBelongsToCompany(
    companyId: string,
    propertyId: string,
    scope?: InvestorRowScope,
  ) {
    const property = await this.prisma.property.findFirst({
      where: {
        id: propertyId,
        companyId,
        ...(scope?.investorId ? { investors: { some: { investorId: scope.investorId } } } : {}),
      },
      select: { id: true },
    });
    if (!property) throw new NotFoundException("Imóvel não encontrado");
  }

  private async assertInvestorBelongsToCompany(companyId: string, id: string) {
    const investor = await this.prisma.investor.findFirst({ where: { id, companyId } });
    if (!investor) throw new NotFoundException("Investidor não encontrado");
    return investor;
  }
}
