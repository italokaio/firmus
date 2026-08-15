import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateRoleInput } from "@leilao-erp/types";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  listRoles(companyId: string) {
    return this.prisma.role.findMany({
      where: { companyId },
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: "asc" },
    });
  }

  listPermissionsCatalog() {
    return this.prisma.permission.findMany({ orderBy: { key: "asc" } });
  }

  async createRole(companyId: string, input: CreateRoleInput) {
    const existing = await this.prisma.role.findFirst({ where: { companyId, name: input.name } });
    if (existing) throw new ConflictException("Já existe um papel com este nome");

    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: input.permissionKeys } },
    });

    const role = await this.prisma.role.create({
      data: {
        companyId,
        name: input.name,
        description: input.description,
        permissions: {
          create: permissions.map((permission) => ({ permissionId: permission.id })),
        },
      },
      include: { permissions: { include: { permission: true } } },
    });

    await this.auditService.log({
      entityType: "Role",
      entityId: role.id,
      action: "CREATE",
      after: { name: role.name, permissionKeys: input.permissionKeys },
    });

    return role;
  }

  async updateRolePermissions(companyId: string, roleId: string, permissionKeys: string[]) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, companyId },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException("Papel não encontrado");

    if (role.isSystem && role.name === "ADMINISTRADOR" && permissionKeys.length === 0) {
      throw new BadRequestException(
        "O papel ADMINISTRADOR não pode ficar sem permissões (risco de bloqueio de acesso)",
      );
    }

    const before = role.permissions.map((rolePermission) => rolePermission.permission.key);
    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: permissionKeys } },
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      await tx.rolePermission.createMany({
        data: permissions.map((permission) => ({ roleId, permissionId: permission.id })),
      });
      return tx.role.findUniqueOrThrow({
        where: { id: roleId },
        include: { permissions: { include: { permission: true } } },
      });
    });

    await this.auditService.log({
      entityType: "Role",
      entityId: roleId,
      action: "UPDATE",
      before: { permissionKeys: before },
      after: { permissionKeys },
    });

    return updated;
  }
}
