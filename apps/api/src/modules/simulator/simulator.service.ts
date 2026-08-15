import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type SimulatorScenario } from "@prisma/client";
import {
  SIMULATOR_SCENARIO_TYPES,
  type SimulatorScenarioType,
  type UpsertSimulatorScenarioInput,
} from "@leilao-erp/types";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AcquisitionService } from "../acquisition/acquisition.service";

@Injectable()
export class SimulatorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly acquisitionService: AcquisitionService,
  ) {}

  async getOverview(companyId: string, propertyId: string) {
    await this.assertPropertyBelongsToCompany(companyId, propertyId);

    const [scenarios, suggestedInputs] = await Promise.all([
      this.prisma.simulatorScenario.findMany({ where: { propertyId }, orderBy: { tipo: "asc" } }),
      this.getSuggestedInputs(companyId, propertyId),
    ]);

    return {
      scenarios: scenarios.map((scenario) => this.withComputedFields(scenario)),
      suggestedInputs,
    };
  }

  async upsertScenario(
    companyId: string,
    propertyId: string,
    tipo: string,
    input: UpsertSimulatorScenarioInput,
  ) {
    this.assertValidTipo(tipo);
    await this.assertPropertyBelongsToCompany(companyId, propertyId);

    const scenario = await this.prisma.simulatorScenario.upsert({
      where: { propertyId_tipo: { propertyId, tipo } },
      update: input,
      create: { propertyId, tipo, ...input },
    });

    await this.auditService.log({
      entityType: "SimulatorScenario",
      entityId: scenario.id,
      action: "UPDATE",
      after: { propertyId, tipo, capitalInvestido: input.capitalInvestido, valorVendaEstimado: input.valorVendaEstimado },
    });

    return this.withComputedFields(scenario);
  }

  async deleteScenario(companyId: string, propertyId: string, tipo: string) {
    this.assertValidTipo(tipo);
    await this.assertPropertyBelongsToCompany(companyId, propertyId);

    const scenario = await this.prisma.simulatorScenario.findUnique({
      where: { propertyId_tipo: { propertyId, tipo } },
    });
    if (!scenario) throw new NotFoundException("Cenário não encontrado para este imóvel");

    await this.prisma.simulatorScenario.delete({ where: { id: scenario.id } });
    await this.auditService.log({
      entityType: "SimulatorScenario",
      entityId: scenario.id,
      action: "DELETE",
      before: { propertyId, tipo },
    });
  }

  /** Sugestão de capital investido (aquisição + reforma), só para pré-preencher o formulário. */
  private async getSuggestedInputs(companyId: string, propertyId: string) {
    const [property, acquisition, renovationTotals] = await Promise.all([
      this.prisma.property.findFirst({ where: { id: propertyId, companyId }, select: { valorAvaliacao: true } }),
      this.acquisitionService.getByProperty(companyId, propertyId),
      this.prisma.renovationTask.aggregate({
        where: { propertyId },
        _sum: { valorRealizado: true, valorPrevisto: true },
      }),
    ]);

    const custoAquisicao = acquisition ? new Prisma.Decimal(acquisition.custoTotal) : new Prisma.Decimal(0);
    const custoReforma =
      renovationTotals._sum.valorRealizado && renovationTotals._sum.valorRealizado.greaterThan(0)
        ? renovationTotals._sum.valorRealizado
        : (renovationTotals._sum.valorPrevisto ?? new Prisma.Decimal(0));

    return {
      capitalInvestidoSugerido: custoAquisicao.plus(custoReforma).toFixed(2),
      valorAvaliacaoImovel: (property?.valorAvaliacao ?? new Prisma.Decimal(0)).toFixed(2),
    };
  }

  /**
   * Modelo simplificado de dois pontos no tempo — saída única do capital
   * investido em t=0 e entrada única do valor de venda líquido em t=prazoMeses.
   * Adequado para um flip de leilão sem aportes intermediários modelados
   * explicitamente; TIR mensal calculada em forma fechada (só 2 fluxos).
   */
  private withComputedFields(scenario: SimulatorScenario) {
    const capitalInvestido = new Prisma.Decimal(scenario.capitalInvestido);
    const valorVendaEstimado = new Prisma.Decimal(scenario.valorVendaEstimado);
    const custosVenda = new Prisma.Decimal(scenario.custosVenda);
    const taxaDescontoAnual = new Prisma.Decimal(scenario.taxaDescontoAnual);

    const netInflow = valorVendaEstimado.minus(custosVenda);
    const lucroBruto = netInflow.minus(capitalInvestido);
    const roi = capitalInvestido.greaterThan(0)
      ? lucroBruto.dividedBy(capitalInvestido).times(100)
      : new Prisma.Decimal(0);
    const margem = valorVendaEstimado.greaterThan(0)
      ? lucroBruto.dividedBy(valorVendaEstimado).times(100).toFixed(2)
      : null;
    const paybackMeses = netInflow.greaterThanOrEqualTo(capitalInvestido) ? scenario.prazoMeses : null;

    let tirAnual: string | null = null;
    let vpl: Prisma.Decimal;

    if (capitalInvestido.greaterThan(0) && scenario.prazoMeses > 0) {
      if (netInflow.greaterThan(0)) {
        const ratio = netInflow.dividedBy(capitalInvestido).toNumber();
        const monthlyRate = Math.pow(ratio, 1 / scenario.prazoMeses) - 1;
        const tirAnualValue = (Math.pow(1 + monthlyRate, 12) - 1) * 100;
        tirAnual = Number.isFinite(tirAnualValue) ? tirAnualValue.toFixed(2) : null;
      }

      const monthlyDiscount = Math.pow(1 + taxaDescontoAnual.dividedBy(100).toNumber(), 1 / 12) - 1;
      const discountFactor = Math.pow(1 + monthlyDiscount, scenario.prazoMeses);
      vpl = netInflow.dividedBy(discountFactor).minus(capitalInvestido);
    } else {
      vpl = lucroBruto;
    }

    return {
      ...scenario,
      lucroBruto: lucroBruto.toFixed(2),
      roi: roi.toFixed(2),
      margem,
      paybackMeses,
      tirAnual,
      vpl: vpl.toFixed(2),
    };
  }

  private assertValidTipo(tipo: string): asserts tipo is SimulatorScenarioType {
    if (!SIMULATOR_SCENARIO_TYPES.includes(tipo as SimulatorScenarioType)) {
      throw new BadRequestException("Tipo de cenário inválido");
    }
  }

  private async assertPropertyBelongsToCompany(companyId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, companyId },
      select: { id: true },
    });
    if (!property) throw new NotFoundException("Imóvel não encontrado");
  }
}
