import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  DEFAULT_DUE_DILIGENCE_ITEMS,
  type CreateDueDiligenceCommentInput,
  type CreateDueDiligenceItemInput,
  type UpdateDueDiligenceItemInput,
} from "@leilao-erp/types";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { StorageService } from "../../infrastructure/storage/storage.service";
import { AuditService } from "../audit/audit.service";

const itemInclude = {
  responsible: { select: { id: true, name: true } },
  comments: {
    orderBy: { createdAt: "asc" as const },
    include: { author: { select: { id: true, name: true } } },
  },
  files: { orderBy: { createdAt: "desc" as const } },
};

@Injectable()
export class DueDiligenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
  ) {}

  async listItems(companyId: string, propertyId: string) {
    await this.assertPropertyBelongsToCompany(companyId, propertyId);
    const items = await this.prisma.dueDiligenceItem.findMany({
      where: { propertyId },
      include: itemInclude,
      orderBy: { createdAt: "asc" },
    });
    return this.attachFileUrls(items);
  }

  async initializeChecklist(companyId: string, propertyId: string) {
    await this.assertPropertyBelongsToCompany(companyId, propertyId);

    const existingCount = await this.prisma.dueDiligenceItem.count({ where: { propertyId } });
    if (existingCount > 0) {
      throw new ConflictException("O checklist de due diligence já foi iniciado para este imóvel");
    }

    await this.prisma.$transaction([
      this.prisma.dueDiligenceItem.createMany({
        data: DEFAULT_DUE_DILIGENCE_ITEMS.map((item) => ({ ...item, propertyId })),
      }),
      this.prisma.property.updateMany({
        where: { id: propertyId, status: { in: ["NOVA_OPORTUNIDADE", "EM_ANALISE", "APROVADA"] } },
        data: { status: "EM_DUE_DILIGENCE" },
      }),
    ]);

    await this.auditService.log({
      entityType: "Property",
      entityId: propertyId,
      action: "UPDATE",
      after: { event: "due_diligence_initialized", itemCount: DEFAULT_DUE_DILIGENCE_ITEMS.length },
    });

    return this.listItems(companyId, propertyId);
  }

  async createItem(companyId: string, propertyId: string, input: CreateDueDiligenceItemInput) {
    await this.assertPropertyBelongsToCompany(companyId, propertyId);
    if (input.responsibleId) {
      await this.assertUserBelongsToCompany(companyId, input.responsibleId);
    }

    const item = await this.prisma.dueDiligenceItem.create({
      data: {
        propertyId,
        type: input.type,
        title: input.title,
        description: input.description,
        critical: input.critical,
        responsibleId: input.responsibleId,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      },
      include: itemInclude,
    });

    await this.auditService.log({
      entityType: "DueDiligenceItem",
      entityId: item.id,
      action: "CREATE",
      after: { propertyId, type: input.type, title: input.title },
    });

    return this.attachFileUrl(item);
  }

  async updateItem(
    companyId: string,
    propertyId: string,
    itemId: string,
    input: UpdateDueDiligenceItemInput,
  ) {
    const before = await this.findItemOrThrow(companyId, propertyId, itemId);
    if (input.responsibleId) {
      await this.assertUserBelongsToCompany(companyId, input.responsibleId);
    }

    const updated = await this.prisma.dueDiligenceItem.update({
      where: { id: itemId },
      data: {
        title: input.title,
        description: input.description,
        critical: input.critical,
        status: input.status,
        responsibleId: input.responsibleId,
        dueDate: input.dueDate === undefined ? undefined : input.dueDate ? new Date(input.dueDate) : null,
      },
      include: itemInclude,
    });

    await this.auditService.log({
      entityType: "DueDiligenceItem",
      entityId: itemId,
      action: "UPDATE",
      before: { status: before.status, critical: before.critical },
      after: { status: updated.status, critical: updated.critical },
    });

    return this.attachFileUrl(updated);
  }

  async addComment(
    companyId: string,
    propertyId: string,
    itemId: string,
    authorId: string,
    input: CreateDueDiligenceCommentInput,
  ) {
    await this.findItemOrThrow(companyId, propertyId, itemId);

    const comment = await this.prisma.dueDiligenceComment.create({
      data: { itemId, authorId, body: input.body },
      include: { author: { select: { id: true, name: true } } },
    });

    await this.auditService.log({
      entityType: "DueDiligenceComment",
      entityId: comment.id,
      action: "CREATE",
      after: { itemId },
    });

    return comment;
  }

  async createFileUploadUrl(
    companyId: string,
    propertyId: string,
    itemId: string,
    fileName: string,
    mimeType: string,
  ) {
    await this.findItemOrThrow(companyId, propertyId, itemId);
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageKey = `companies/${companyId}/properties/${propertyId}/due-diligence/${itemId}/${randomUUID()}-${safeName}`;
    const uploadUrl = await this.storageService.createUploadUrl(storageKey, mimeType);
    return { uploadUrl, storageKey };
  }

  async confirmFile(
    companyId: string,
    propertyId: string,
    itemId: string,
    input: { storageKey: string; name: string; mimeType: string; sizeBytes: number },
    uploadedById: string,
  ) {
    await this.findItemOrThrow(companyId, propertyId, itemId);

    const file = await this.prisma.dueDiligenceFile.create({
      data: {
        itemId,
        name: input.name,
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        uploadedById,
      },
    });

    await this.auditService.log({
      entityType: "DueDiligenceFile",
      entityId: file.id,
      action: "CREATE",
      after: { itemId, name: input.name },
    });

    return { ...file, url: await this.storageService.createDownloadUrl(file.storageKey) };
  }

  /** Usado pelo AcquisitionService — não deixa adquirir com pendência crítica em aberto. */
  async assertNoCriticalPendingItems(propertyId: string): Promise<void> {
    const pendingCritical = await this.prisma.dueDiligenceItem.count({
      where: { propertyId, critical: true, status: { not: "CONCLUIDO" } },
    });
    if (pendingCritical > 0) {
      throw new BadRequestException(
        `Existem ${pendingCritical} pendência(s) crítica(s) de due diligence não concluídas. ` +
          "A aquisição não pode ser registrada enquanto elas não forem resolvidas.",
      );
    }
  }

  private async findItemOrThrow(companyId: string, propertyId: string, itemId: string) {
    await this.assertPropertyBelongsToCompany(companyId, propertyId);
    const item = await this.prisma.dueDiligenceItem.findFirst({ where: { id: itemId, propertyId } });
    if (!item) throw new NotFoundException("Item de due diligence não encontrado");
    return item;
  }

  private async attachFileUrls<
    T extends { files: Array<{ storageKey: string } & Record<string, unknown>> },
  >(items: T[]) {
    return Promise.all(items.map((item) => this.attachFileUrl(item)));
  }

  private async attachFileUrl<
    T extends { files: Array<{ storageKey: string } & Record<string, unknown>> },
  >(item: T) {
    return {
      ...item,
      files: await Promise.all(
        item.files.map(async (file) => ({
          ...file,
          url: await this.storageService.createDownloadUrl(file.storageKey),
        })),
      ),
    };
  }

  private async assertPropertyBelongsToCompany(companyId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, companyId },
      select: { id: true },
    });
    if (!property) throw new NotFoundException("Imóvel não encontrado");
  }

  private async assertUserBelongsToCompany(companyId: string, userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, companyId } });
    if (!user) throw new BadRequestException("Responsável informado não pertence a esta empresa");
  }
}
