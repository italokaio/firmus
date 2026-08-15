import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  ConfirmDocumentUploadInput,
  ConfirmPhotoUploadInput,
  CreatePropertyInput,
  PropertyFilterInput,
  UpdatePropertyInput,
} from "@leilao-erp/types";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { StorageService } from "../../infrastructure/storage/storage.service";
import { AuditService } from "../audit/audit.service";

const propertyInclude = {
  photos: { orderBy: { order: "asc" as const } },
  documents: { orderBy: { createdAt: "desc" as const } },
  tags: { include: { tag: true } },
};

/**
 * Escopo por linha (row-level scope): quando o usuário logado tem
 * `brokerId`/`investorId` vinculado (contas de Corretor/Investidor), o
 * acesso a Property é restrito ao que é atribuído/cadastrado por ele ou às
 * propriedades onde ele participa como investidor. Contas de equipe (sem
 * nenhum dos dois vínculos) continuam vendo tudo, como hoje — controlado só
 * pelas permissões do papel.
 */
export interface PropertyRowScope {
  userId: string;
  investorId?: string;
  brokerId?: string;
}

function scopeWhereClause(scope?: PropertyRowScope) {
  if (!scope || (!scope.investorId && !scope.brokerId)) return undefined;

  const or: Array<Record<string, unknown>> = [];
  if (scope.brokerId) {
    or.push({ corretorResponsavelId: scope.brokerId });
    or.push({ createdByUserId: scope.userId });
  }
  if (scope.investorId) {
    or.push({ investors: { some: { investorId: scope.investorId } } });
  }
  return { OR: or };
}

@Injectable()
export class PropertiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
  ) {}

  async list(companyId: string, filters: PropertyFilterInput, scope?: PropertyRowScope) {
    const properties = await this.prisma.property.findMany({
      where: {
        companyId,
        status: filters.status,
        prioridade: filters.prioridade,
        tags: filters.tagId ? { some: { tagId: filters.tagId } } : undefined,
        AND: filters.search
          ? [
              {
                OR: [
                  { origem: { contains: filters.search, mode: "insensitive" } },
                  { cidade: { contains: filters.search, mode: "insensitive" } },
                  { endereco: { contains: filters.search, mode: "insensitive" } },
                  { matricula: { contains: filters.search, mode: "insensitive" } },
                ],
              },
            ]
          : undefined,
        ...scopeWhereClause(scope),
      },
      include: propertyInclude,
      orderBy: { createdAt: "desc" },
    });
    return this.attachPhotoUrls(properties);
  }

  async findById(companyId: string, id: string, scope?: PropertyRowScope) {
    const property = await this.prisma.property.findFirst({
      where: { id, companyId, ...scopeWhereClause(scope) },
      include: propertyInclude,
    });
    if (!property) throw new NotFoundException("Imóvel não encontrado");
    return this.attachPhotoUrl(property);
  }

  async create(companyId: string, input: CreatePropertyInput, createdByUserId?: string) {
    await this.assertTagsBelongToCompany(companyId, input.tagIds);

    const { tagIds, editalUrl, ...data } = input;

    // Toda Property ganha sua própria conta de caixa (nível IMOVEL), pendurada
    // na conta raiz EMPRESA da empresa — é o que sustenta o DRE/fluxo de caixa
    // por imóvel no módulo Financeiro (Fase 4).
    const rootAccount = await this.prisma.financeAccount.findFirst({
      where: { companyId, level: "EMPRESA", parentAccountId: null },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    const property = await this.prisma.$transaction(async (tx) => {
      const created = await tx.property.create({
        data: {
          ...data,
          editalUrl: editalUrl || null,
          companyId,
          createdByUserId,
          tags: { create: tagIds.map((tagId) => ({ tagId })) },
        },
        include: propertyInclude,
      });

      await tx.financeAccount.create({
        data: {
          companyId,
          propertyId: created.id,
          parentAccountId: rootAccount?.id,
          level: "IMOVEL",
          name: created.origem,
        },
      });

      return created;
    });

    await this.auditService.log({
      entityType: "Property",
      entityId: property.id,
      action: "CREATE",
      after: { origem: property.origem, endereco: property.endereco, status: property.status },
    });

    return this.attachPhotoUrl(property);
  }

  async update(companyId: string, id: string, input: UpdatePropertyInput, scope?: PropertyRowScope) {
    const before = await this.findById(companyId, id, scope);

    if (input.tagIds) {
      await this.assertTagsBelongToCompany(companyId, input.tagIds);
    }

    const { tagIds, editalUrl, ...data } = input;
    const updated = await this.prisma.$transaction(async (tx) => {
      if (tagIds) {
        await tx.propertyTag.deleteMany({ where: { propertyId: id } });
        await tx.propertyTag.createMany({ data: tagIds.map((tagId) => ({ propertyId: id, tagId })) });
      }
      return tx.property.update({
        where: { id },
        data: { ...data, editalUrl: editalUrl === "" ? null : editalUrl },
        include: propertyInclude,
      });
    });

    await this.auditService.log({
      entityType: "Property",
      entityId: id,
      action: "UPDATE",
      before: { status: before.status, prioridade: before.prioridade },
      after: { status: updated.status, prioridade: updated.prioridade },
    });

    return this.attachPhotoUrl(updated);
  }

  async delete(companyId: string, id: string) {
    const property = await this.findById(companyId, id);
    await this.prisma.property.delete({ where: { id } });
    await this.auditService.log({
      entityType: "Property",
      entityId: id,
      action: "DELETE",
      before: { origem: property.origem, endereco: property.endereco },
    });
  }

  async createUploadUrl(
    companyId: string,
    propertyId: string,
    fileName: string,
    mimeType: string,
    scope?: PropertyRowScope,
  ) {
    await this.assertPropertyBelongsToCompany(companyId, propertyId, scope);
    const storageKey = this.storageService.buildObjectKey(companyId, propertyId, fileName);
    const uploadUrl = await this.storageService.createUploadUrl(storageKey, mimeType);
    return { uploadUrl, storageKey };
  }

  async confirmPhoto(
    companyId: string,
    propertyId: string,
    input: ConfirmPhotoUploadInput,
    scope?: PropertyRowScope,
  ) {
    await this.assertPropertyBelongsToCompany(companyId, propertyId, scope);
    const count = await this.prisma.propertyPhoto.count({ where: { propertyId } });

    const photo = await this.prisma.propertyPhoto.create({
      data: {
        propertyId,
        storageKey: input.storageKey,
        caption: input.caption,
        order: count,
      },
    });

    await this.auditService.log({
      entityType: "PropertyPhoto",
      entityId: photo.id,
      action: "CREATE",
      after: { propertyId, storageKey: input.storageKey },
    });

    return photo;
  }

  async deletePhoto(companyId: string, propertyId: string, photoId: string, scope?: PropertyRowScope) {
    await this.assertPropertyBelongsToCompany(companyId, propertyId, scope);
    const photo = await this.prisma.propertyPhoto.findFirst({ where: { id: photoId, propertyId } });
    if (!photo) throw new NotFoundException("Foto não encontrada");

    await this.prisma.propertyPhoto.delete({ where: { id: photoId } });
    await this.auditService.log({ entityType: "PropertyPhoto", entityId: photoId, action: "DELETE" });
  }

  async confirmDocument(
    companyId: string,
    propertyId: string,
    input: ConfirmDocumentUploadInput,
    scope?: PropertyRowScope,
  ) {
    await this.assertPropertyBelongsToCompany(companyId, propertyId, scope);

    let version = 1;
    if (input.previousDocumentId) {
      const previous = await this.prisma.propertyDocument.findFirst({
        where: { id: input.previousDocumentId, propertyId },
      });
      if (!previous) throw new BadRequestException("Documento anterior não encontrado");
      version = previous.version + 1;
    }

    const document = await this.prisma.propertyDocument.create({
      data: {
        propertyId,
        name: input.name,
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        version,
        previousVersionId: input.previousDocumentId,
      },
    });

    await this.auditService.log({
      entityType: "PropertyDocument",
      entityId: document.id,
      action: "CREATE",
      after: { propertyId, name: input.name, version },
    });

    return document;
  }

  async getDocumentDownloadUrl(
    companyId: string,
    propertyId: string,
    documentId: string,
    scope?: PropertyRowScope,
  ) {
    await this.assertPropertyBelongsToCompany(companyId, propertyId, scope);
    const document = await this.prisma.propertyDocument.findFirst({
      where: { id: documentId, propertyId },
    });
    if (!document) throw new NotFoundException("Documento não encontrado");
    return { url: await this.storageService.createDownloadUrl(document.storageKey) };
  }

  private async attachPhotoUrls<
    T extends { photos: Array<{ storageKey: string } & Record<string, unknown>> },
  >(properties: T[]) {
    return Promise.all(properties.map((property) => this.attachPhotoUrl(property)));
  }

  private async attachPhotoUrl<
    T extends { photos: Array<{ storageKey: string } & Record<string, unknown>> },
  >(property: T) {
    return {
      ...property,
      photos: await Promise.all(
        property.photos.map(async (photo) => ({
          ...photo,
          url: await this.storageService.createDownloadUrl(photo.storageKey),
        })),
      ),
    };
  }

  private async assertPropertyBelongsToCompany(
    companyId: string,
    propertyId: string,
    scope?: PropertyRowScope,
  ) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, companyId, ...scopeWhereClause(scope) },
      select: { id: true },
    });
    if (!property) throw new NotFoundException("Imóvel não encontrado");
  }

  private async assertTagsBelongToCompany(companyId: string, tagIds: string[]) {
    if (tagIds.length === 0) return;
    const tags = await this.prisma.tag.findMany({ where: { id: { in: tagIds }, companyId } });
    if (tags.length !== tagIds.length) {
      throw new BadRequestException("Uma ou mais tags informadas não pertencem a esta empresa");
    }
  }
}
