import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateTagInput } from "@leilao-erp/types";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class TagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  list(companyId: string) {
    return this.prisma.tag.findMany({ where: { companyId }, orderBy: { name: "asc" } });
  }

  async create(companyId: string, input: CreateTagInput) {
    const existing = await this.prisma.tag.findFirst({
      where: { companyId, name: input.name },
    });
    if (existing) throw new ConflictException("Já existe uma tag com este nome");

    const tag = await this.prisma.tag.create({ data: { companyId, ...input } });
    await this.auditService.log({ entityType: "Tag", entityId: tag.id, action: "CREATE", after: input });
    return tag;
  }

  async delete(companyId: string, id: string) {
    const tag = await this.prisma.tag.findFirst({ where: { id, companyId } });
    if (!tag) throw new NotFoundException("Tag não encontrada");

    await this.prisma.tag.delete({ where: { id } });
    await this.auditService.log({ entityType: "Tag", entityId: id, action: "DELETE", before: tag });
  }
}
