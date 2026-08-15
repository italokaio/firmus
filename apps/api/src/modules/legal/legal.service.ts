import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  ConfirmLegalDocumentInput,
  CreateLegalEventInput,
  UpdateLegalCaseInput,
  UpdateLegalEventInput,
} from "@leilao-erp/types";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { StorageService } from "../../infrastructure/storage/storage.service";
import { AuditService } from "../audit/audit.service";

const caseInclude = {
  events: { orderBy: { dueDate: "asc" as const } },
  documents: { orderBy: { createdAt: "desc" as const } },
};

@Injectable()
export class LegalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
  ) {}

  async getByProperty(companyId: string, propertyId: string) {
    await this.assertPropertyBelongsToCompany(companyId, propertyId);
    const legalCase = await this.prisma.legalCase.findUnique({
      where: { propertyId },
      include: caseInclude,
    });
    if (!legalCase) return null;
    return this.withComputedFields(legalCase);
  }

  async update(companyId: string, propertyId: string, input: UpdateLegalCaseInput) {
    const legalCase = await this.findCaseOrThrow(companyId, propertyId);

    const updated = await this.prisma.legalCase.update({
      where: { propertyId },
      data: input,
      include: caseInclude,
    });

    await this.auditService.log({
      entityType: "LegalCase",
      entityId: legalCase.id,
      action: "UPDATE",
      before: { status: legalCase.status },
      after: { status: updated.status },
    });

    return this.withComputedFields(updated);
  }

  async addEvent(companyId: string, propertyId: string, input: CreateLegalEventInput) {
    const legalCase = await this.findCaseOrThrow(companyId, propertyId);

    const event = await this.prisma.legalCaseEvent.create({
      data: {
        legalCaseId: legalCase.id,
        type: input.type,
        title: input.title,
        description: input.description,
        dueDate: new Date(input.dueDate),
      },
    });

    await this.auditService.log({
      entityType: "LegalCaseEvent",
      entityId: event.id,
      action: "CREATE",
      after: { propertyId, type: input.type, title: input.title },
    });

    return this.withEventOverdue(event);
  }

  async updateEvent(
    companyId: string,
    propertyId: string,
    eventId: string,
    input: UpdateLegalEventInput,
  ) {
    const legalCase = await this.findCaseOrThrow(companyId, propertyId);
    const event = await this.prisma.legalCaseEvent.findFirst({
      where: { id: eventId, legalCaseId: legalCase.id },
    });
    if (!event) throw new NotFoundException("Prazo/audiência não encontrado(a)");

    const updated = await this.prisma.legalCaseEvent.update({
      where: { id: eventId },
      data: {
        title: input.title,
        description: input.description,
        status: input.status,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      },
    });

    await this.auditService.log({
      entityType: "LegalCaseEvent",
      entityId: eventId,
      action: "UPDATE",
      before: { status: event.status },
      after: { status: updated.status },
    });

    return this.withEventOverdue(updated);
  }

  async createDocumentUploadUrl(
    companyId: string,
    propertyId: string,
    fileName: string,
    mimeType: string,
  ) {
    const legalCase = await this.findCaseOrThrow(companyId, propertyId);
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageKey = `companies/${companyId}/properties/${propertyId}/legal/${legalCase.id}/${randomUUID()}-${safeName}`;
    const uploadUrl = await this.storageService.createUploadUrl(storageKey, mimeType);
    return { uploadUrl, storageKey };
  }

  async confirmDocument(
    companyId: string,
    propertyId: string,
    input: ConfirmLegalDocumentInput,
    uploadedById: string,
  ) {
    const legalCase = await this.findCaseOrThrow(companyId, propertyId);

    const document = await this.prisma.legalCaseDocument.create({
      data: {
        legalCaseId: legalCase.id,
        name: input.name,
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        uploadedById,
      },
    });

    await this.auditService.log({
      entityType: "LegalCaseDocument",
      entityId: document.id,
      action: "CREATE",
      after: { propertyId, name: input.name },
    });

    return { ...document, url: await this.storageService.createDownloadUrl(document.storageKey) };
  }

  private async withComputedFields<
    T extends {
      events: Array<{ dueDate: Date; status: string } & Record<string, unknown>>;
      documents: Array<{ storageKey: string } & Record<string, unknown>>;
    },
  >(legalCase: T) {
    return {
      ...legalCase,
      events: legalCase.events.map((event) => this.withEventOverdue(event)),
      documents: await Promise.all(
        legalCase.documents.map(async (document) => ({
          ...document,
          url: await this.storageService.createDownloadUrl(document.storageKey),
        })),
      ),
    };
  }

  private withEventOverdue<T extends { dueDate: Date; status: string }>(event: T) {
    return { ...event, overdue: event.status === "PENDENTE" && event.dueDate < new Date() };
  }

  private async findCaseOrThrow(companyId: string, propertyId: string) {
    await this.assertPropertyBelongsToCompany(companyId, propertyId);
    const legalCase = await this.prisma.legalCase.findUnique({ where: { propertyId } });
    if (!legalCase) {
      throw new NotFoundException(
        "Este imóvel ainda não possui processo jurídico — registre a aquisição primeiro",
      );
    }
    return legalCase;
  }

  private async assertPropertyBelongsToCompany(companyId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, companyId },
      select: { id: true },
    });
    if (!property) throw new NotFoundException("Imóvel não encontrado");
  }
}
