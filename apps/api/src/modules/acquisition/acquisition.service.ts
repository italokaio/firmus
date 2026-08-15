import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type Acquisition } from "@prisma/client";
import type { CreateAcquisitionInput, UpdateAcquisitionInput } from "@leilao-erp/types";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { DueDiligenceService } from "../due-diligence/due-diligence.service";

const COST_FIELDS = [
  "custasCartorarias",
  "itbi",
  "registro",
  "escritura",
  "honorariosAdvocaticios",
  "taxas",
  "comissoes",
  "custosBancarios",
] as const;

@Injectable()
export class AcquisitionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly dueDiligenceService: DueDiligenceService,
  ) {}

  async getByProperty(companyId: string, propertyId: string) {
    const property = await this.assertPropertyBelongsToCompany(companyId, propertyId);
    const acquisition = await this.prisma.acquisition.findUnique({ where: { propertyId } });
    if (!acquisition) return null;
    return this.withComputedFields(acquisition, property.area);
  }

  async create(companyId: string, propertyId: string, input: CreateAcquisitionInput) {
    const property = await this.assertPropertyBelongsToCompany(companyId, propertyId);

    const existing = await this.prisma.acquisition.findUnique({ where: { propertyId } });
    if (existing) {
      throw new ConflictException("Este imóvel já possui um registro de aquisição");
    }

    await this.dueDiligenceService.assertNoCriticalPendingItems(propertyId);

    const [acquisition] = await this.prisma.$transaction([
      this.prisma.acquisition.create({ data: { propertyId, ...input } }),
      this.prisma.property.update({ where: { id: propertyId }, data: { status: "ADQUIRIDA" } }),
      // O processo jurídico nasce junto da aquisição — a partir daqui o imóvel
      // entra no fluxo de pagamento/registro/imissão na posse (Módulo 4).
      this.prisma.legalCase.create({ data: { propertyId } }),
    ]);

    await this.auditService.log({
      entityType: "Acquisition",
      entityId: acquisition.id,
      action: "CREATE",
      after: { propertyId, valorLance: input.valorLance },
    });

    return this.withComputedFields(acquisition, property.area);
  }

  async update(companyId: string, propertyId: string, input: UpdateAcquisitionInput) {
    const property = await this.assertPropertyBelongsToCompany(companyId, propertyId);
    const before = await this.prisma.acquisition.findUnique({ where: { propertyId } });
    if (!before) throw new NotFoundException("Aquisição não encontrada para este imóvel");

    const updated = await this.prisma.acquisition.update({ where: { propertyId }, data: input });

    await this.auditService.log({
      entityType: "Acquisition",
      entityId: updated.id,
      action: "UPDATE",
      before: { valorLance: before.valorLance.toString() },
      after: { valorLance: updated.valorLance.toString() },
    });

    return this.withComputedFields(updated, property.area);
  }

  private withComputedFields(acquisition: Acquisition, propertyArea: Prisma.Decimal) {
    const custoTotal = COST_FIELDS.reduce(
      (total, field) => total.plus(acquisition[field]),
      new Prisma.Decimal(acquisition.valorLance),
    );
    const valorPorM2 = propertyArea.greaterThan(0) ? custoTotal.dividedBy(propertyArea) : null;

    return {
      ...acquisition,
      custoTotal: custoTotal.toFixed(2),
      capitalInvestido: custoTotal.toFixed(2),
      valorPorM2: valorPorM2 ? valorPorM2.toFixed(2) : null,
    };
  }

  private async assertPropertyBelongsToCompany(companyId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, companyId },
      select: { id: true, area: true },
    });
    if (!property) throw new NotFoundException("Imóvel não encontrado");
    return property;
  }
}
