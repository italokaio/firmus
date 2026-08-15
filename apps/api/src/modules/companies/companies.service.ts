import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import { DEFAULT_ROLES, DEFAULT_ROLE_PERMISSIONS, type RegisterCompanyInput } from "@leilao-erp/types";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Cria uma nova empresa (tenant) já com os papéis-base e o primeiro usuário
   * Administrador. É o único ponto de entrada para novos tenants no SaaS —
   * a rota é pública (sem login), mas protegida pela `COMPANY_SETUP_KEY` para
   * não ficar aberta a qualquer visitante que encontre o endereço da tela.
   */
  async provisionNewCompany(input: RegisterCompanyInput) {
    const setupKey = this.configService.getOrThrow<string>("COMPANY_SETUP_KEY");
    if (input.setupKey !== setupKey) {
      throw new UnauthorizedException("Chave de configuração inválida");
    }

    const existing = await this.prisma.company.findFirst({
      where: { OR: [{ slug: input.companySlug }, { document: input.companyDocument }] },
    });
    if (existing) {
      throw new ConflictException("Já existe uma empresa com este identificador ou CNPJ/CPF");
    }

    const passwordHash = await argon2.hash(input.adminPassword);

    const company = await this.prisma.$transaction(async (tx) => {
      const createdCompany = await tx.company.create({
        data: {
          name: input.companyName,
          document: input.companyDocument,
          slug: input.companySlug,
        },
      });

      let adminRoleId: string | undefined;
      for (const roleName of DEFAULT_ROLES) {
        const role = await tx.role.create({
          data: { companyId: createdCompany.id, name: roleName, isSystem: true },
        });
        if (roleName === "ADMINISTRADOR") adminRoleId = role.id;

        const permissionKeys = DEFAULT_ROLE_PERMISSIONS[roleName];
        const permissions = await tx.permission.findMany({
          where: { key: { in: permissionKeys } },
        });
        if (permissions.length > 0) {
          await tx.rolePermission.createMany({
            data: permissions.map((permission) => ({
              roleId: role.id,
              permissionId: permission.id,
            })),
          });
        }
      }

      if (!adminRoleId) {
        throw new Error("Falha ao provisionar papel ADMINISTRADOR");
      }

      const adminUser = await tx.user.create({
        data: {
          companyId: createdCompany.id,
          name: input.adminName,
          email: input.adminEmail,
          passwordHash,
          roles: { create: { roleId: adminRoleId } },
        },
      });

      // Conta de caixa raiz (nível EMPRESA) — todo imóvel cadastrado ganha uma
      // subconta IMOVEL pendurada nela (ver PropertiesService.create).
      await tx.financeAccount.create({
        data: { companyId: createdCompany.id, level: "EMPRESA", name: createdCompany.name },
      });

      return { company: createdCompany, adminUser };
    });

    await this.auditService.log({
      entityType: "Company",
      entityId: company.company.id,
      action: "CREATE",
      companyId: company.company.id,
      userId: company.adminUser.id,
      after: { name: company.company.name, slug: company.company.slug },
    });

    return {
      companyId: company.company.id,
      companySlug: company.company.slug,
      adminEmail: company.adminUser.email,
    };
  }

  async getProfile(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException("Empresa não encontrada");
    return company;
  }

  async updateProfile(companyId: string, data: { name?: string }) {
    const before = await this.getProfile(companyId);
    const updated = await this.prisma.company.update({ where: { id: companyId }, data });

    await this.auditService.log({
      entityType: "Company",
      entityId: companyId,
      action: "UPDATE",
      before: { name: before.name },
      after: { name: updated.name },
    });

    return updated;
  }
}
