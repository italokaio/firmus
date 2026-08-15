import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  ConfirmRenovationMediaInput,
  CreateChecklistItemInput,
  CreateRenovationCommentInput,
  CreateRenovationTaskInput,
  MoveRenovationTaskInput,
  UpdateChecklistItemInput,
  UpdateRenovationTaskInput,
} from "@leilao-erp/types";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { StorageService } from "../../infrastructure/storage/storage.service";
import { AuditService } from "../audit/audit.service";

const taskInclude = {
  responsible: { select: { id: true, name: true } },
  checklist: { orderBy: { createdAt: "asc" as const } },
  comments: {
    orderBy: { createdAt: "asc" as const },
    include: { author: { select: { id: true, name: true } } },
  },
  media: { orderBy: { createdAt: "desc" as const } },
  dependsOn: { include: { dependsOn: { select: { id: true, title: true, stage: true } } } },
  property: { select: { id: true, origem: true, endereco: true } },
};

@Injectable()
export class RenovationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
  ) {}

  /** Sem `propertyId`, retorna o kanban global (todas as propriedades da empresa). */
  async listBoard(companyId: string, propertyId?: string) {
    if (propertyId) await this.assertPropertyBelongsToCompany(companyId, propertyId);

    const tasks = await this.prisma.renovationTask.findMany({
      where: propertyId ? { propertyId } : { property: { companyId } },
      include: taskInclude,
      orderBy: [{ stage: "asc" }, { order: "asc" }],
    });
    return this.attachMediaUrls(tasks);
  }

  async createTask(companyId: string, propertyId: string, input: CreateRenovationTaskInput) {
    await this.assertPropertyBelongsToCompany(companyId, propertyId);
    if (input.responsibleId) await this.assertUserBelongsToCompany(companyId, input.responsibleId);
    if (input.dependsOnTaskIds.length > 0) {
      await this.assertTasksBelongToProperty(propertyId, input.dependsOnTaskIds);
    }

    const lastInStage = await this.prisma.renovationTask.findFirst({
      where: { propertyId, stage: input.stage },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const task = await this.prisma.renovationTask.create({
      data: {
        propertyId,
        title: input.title,
        description: input.description,
        stage: input.stage,
        order: (lastInStage?.order ?? -1) + 1,
        responsibleId: input.responsibleId,
        priority: input.priority,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        valorPrevisto: input.valorPrevisto,
        dependsOn: { create: input.dependsOnTaskIds.map((dependsOnTaskId) => ({ dependsOnTaskId })) },
      },
      include: taskInclude,
    });

    await this.auditService.log({
      entityType: "RenovationTask",
      entityId: task.id,
      action: "CREATE",
      after: { propertyId, title: input.title, stage: input.stage },
    });

    return this.attachMediaUrl(task);
  }

  async updateTask(
    companyId: string,
    propertyId: string,
    taskId: string,
    input: UpdateRenovationTaskInput,
  ) {
    const before = await this.findTaskOrThrow(companyId, propertyId, taskId);
    if (input.responsibleId) await this.assertUserBelongsToCompany(companyId, input.responsibleId);
    if (input.dependsOnTaskIds) {
      await this.assertTasksBelongToProperty(propertyId, input.dependsOnTaskIds);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (input.dependsOnTaskIds) {
        await tx.renovationTaskDependency.deleteMany({ where: { taskId } });
        await tx.renovationTaskDependency.createMany({
          data: input.dependsOnTaskIds.map((dependsOnTaskId) => ({ taskId, dependsOnTaskId })),
        });
      }

      return tx.renovationTask.update({
        where: { id: taskId },
        data: {
          title: input.title,
          description: input.description,
          responsibleId: input.responsibleId,
          priority: input.priority,
          startDate:
            input.startDate === undefined ? undefined : input.startDate ? new Date(input.startDate) : null,
          dueDate: input.dueDate === undefined ? undefined : input.dueDate ? new Date(input.dueDate) : null,
          valorPrevisto: input.valorPrevisto,
          valorRealizado: input.valorRealizado,
          percentualConcluido: input.percentualConcluido,
        },
        include: taskInclude,
      });
    });

    await this.auditService.log({
      entityType: "RenovationTask",
      entityId: taskId,
      action: "UPDATE",
      before: { percentualConcluido: before.percentualConcluido },
      after: { percentualConcluido: updated.percentualConcluido },
    });

    return this.attachMediaUrl(updated);
  }

  /** Move o cartão entre colunas (stage) e/ou reordena dentro da coluna, renumerando os vizinhos. */
  async moveTask(companyId: string, propertyId: string, taskId: string, input: MoveRenovationTaskInput) {
    await this.findTaskOrThrow(companyId, propertyId, taskId);

    await this.prisma.$transaction(async (tx) => {
      const siblings = await tx.renovationTask.findMany({
        where: { propertyId, stage: input.stage, id: { not: taskId } },
        orderBy: { order: "asc" },
        select: { id: true },
      });

      const orderedIds = [...siblings.map((s) => s.id)];
      const insertAt = Math.min(input.order, orderedIds.length);
      orderedIds.splice(insertAt, 0, taskId);

      await Promise.all(
        orderedIds.map((id, index) =>
          tx.renovationTask.update({
            where: { id },
            data: { order: index, stage: id === taskId ? input.stage : undefined },
          }),
        ),
      );
    });

    await this.auditService.log({
      entityType: "RenovationTask",
      entityId: taskId,
      action: "UPDATE",
      after: { event: "moved", stage: input.stage, order: input.order },
    });

    return this.findTaskOrThrow(companyId, propertyId, taskId, true);
  }

  async addChecklistItem(
    companyId: string,
    propertyId: string,
    taskId: string,
    input: CreateChecklistItemInput,
  ) {
    await this.findTaskOrThrow(companyId, propertyId, taskId);
    return this.prisma.renovationChecklistItem.create({ data: { taskId, title: input.title } });
  }

  async updateChecklistItem(
    companyId: string,
    propertyId: string,
    taskId: string,
    itemId: string,
    input: UpdateChecklistItemInput,
  ) {
    await this.findTaskOrThrow(companyId, propertyId, taskId);
    const item = await this.prisma.renovationChecklistItem.findFirst({ where: { id: itemId, taskId } });
    if (!item) throw new NotFoundException("Item do checklist não encontrado");
    return this.prisma.renovationChecklistItem.update({ where: { id: itemId }, data: input });
  }

  async addComment(
    companyId: string,
    propertyId: string,
    taskId: string,
    authorId: string,
    input: CreateRenovationCommentInput,
  ) {
    await this.findTaskOrThrow(companyId, propertyId, taskId);
    return this.prisma.renovationComment.create({
      data: { taskId, authorId, body: input.body },
      include: { author: { select: { id: true, name: true } } },
    });
  }

  async createMediaUploadUrl(
    companyId: string,
    propertyId: string,
    taskId: string,
    fileName: string,
    mimeType: string,
  ) {
    await this.findTaskOrThrow(companyId, propertyId, taskId);
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageKey = `companies/${companyId}/properties/${propertyId}/renovation/${taskId}/${randomUUID()}-${safeName}`;
    const uploadUrl = await this.storageService.createUploadUrl(storageKey, mimeType);
    return { uploadUrl, storageKey };
  }

  async confirmMedia(
    companyId: string,
    propertyId: string,
    taskId: string,
    input: ConfirmRenovationMediaInput,
  ) {
    await this.findTaskOrThrow(companyId, propertyId, taskId);
    const media = await this.prisma.renovationMedia.create({
      data: { taskId, storageKey: input.storageKey, kind: input.kind, caption: input.caption },
    });
    return { ...media, url: await this.storageService.createDownloadUrl(media.storageKey) };
  }

  private async attachMediaUrls<
    T extends { media: Array<{ storageKey: string } & Record<string, unknown>> },
  >(tasks: T[]) {
    return Promise.all(tasks.map((task) => this.attachMediaUrl(task)));
  }

  private async attachMediaUrl<
    T extends { media: Array<{ storageKey: string } & Record<string, unknown>> },
  >(task: T) {
    return {
      ...task,
      media: await Promise.all(
        task.media.map(async (media) => ({
          ...media,
          url: await this.storageService.createDownloadUrl(media.storageKey),
        })),
      ),
    };
  }

  private async findTaskOrThrow(
    companyId: string,
    propertyId: string,
    taskId: string,
    withUrls = false,
  ) {
    await this.assertPropertyBelongsToCompany(companyId, propertyId);
    const task = await this.prisma.renovationTask.findFirst({
      where: { id: taskId, propertyId },
      include: taskInclude,
    });
    if (!task) throw new NotFoundException("Cartão de reforma não encontrado");
    return withUrls ? this.attachMediaUrl(task) : task;
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

  private async assertTasksBelongToProperty(propertyId: string, taskIds: string[]) {
    const tasks = await this.prisma.renovationTask.findMany({ where: { id: { in: taskIds }, propertyId } });
    if (tasks.length !== taskIds.length) {
      throw new BadRequestException("Uma ou mais dependências informadas não pertencem a este imóvel");
    }
  }
}
