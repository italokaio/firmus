import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import * as argon2 from "argon2";
import type { CreateUserInput, UpdateUserInput } from "@leilao-erp/types";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

// select explícito (não `include`) para nunca devolver passwordHash/twoFactorSecret/
// twoFactorTempSecret ao frontend — só campos seguros de exibir.
const userSelect = {
  id: true,
  companyId: true,
  name: true,
  email: true,
  active: true,
  investorId: true,
  brokerId: true,
  twoFactorEnabled: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  roles: { select: { role: { select: { id: true, name: true } } } },
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  list(companyId: string) {
    return this.prisma.user.findMany({
      where: { companyId },
      select: userSelect,
      orderBy: { name: "asc" },
    });
  }

  async findById(companyId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, companyId },
      select: userSelect,
    });
    if (!user) throw new NotFoundException("Usuário não encontrado");
    return user;
  }

  async create(companyId: string, input: CreateUserInput) {
    await this.assertRolesBelongToCompany(companyId, input.roleIds);
    if (input.investorId) {
      await this.assertInvestorBelongsToCompany(companyId, input.investorId);
      await this.assertInvestorNotLinked(input.investorId);
    }
    if (input.brokerId) {
      await this.assertBrokerBelongsToCompany(companyId, input.brokerId);
      await this.assertBrokerNotLinked(input.brokerId);
    }

    const existing = await this.prisma.user.findFirst({
      where: { companyId, email: input.email },
    });
    if (existing) throw new ConflictException("Já existe um usuário com este e-mail");

    const passwordHash = await argon2.hash(input.password);
    const user = await this.prisma.user.create({
      data: {
        companyId,
        name: input.name,
        email: input.email,
        passwordHash,
        investorId: input.investorId,
        brokerId: input.brokerId,
        roles: { create: input.roleIds.map((roleId) => ({ roleId })) },
      },
      select: userSelect,
    });

    await this.auditService.log({
      entityType: "User",
      entityId: user.id,
      action: "CREATE",
      after: { name: user.name, email: user.email, roleIds: input.roleIds },
    });

    return user;
  }

  async update(companyId: string, id: string, input: UpdateUserInput) {
    const before = await this.findById(companyId, id);

    if (input.roleIds) {
      await this.assertRolesBelongToCompany(companyId, input.roleIds);
    }
    if (input.investorId) {
      await this.assertInvestorBelongsToCompany(companyId, input.investorId);
      await this.assertInvestorNotLinked(input.investorId, id);
    }
    if (input.brokerId) {
      await this.assertBrokerBelongsToCompany(companyId, input.brokerId);
      await this.assertBrokerNotLinked(input.brokerId, id);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (input.roleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({
          data: input.roleIds.map((roleId) => ({ userId: id, roleId })),
        });
      }
      return tx.user.update({
        where: { id },
        data: {
          name: input.name,
          active: input.active,
          investorId: input.investorId,
          brokerId: input.brokerId,
        },
        select: userSelect,
      });
    });

    await this.auditService.log({
      entityType: "User",
      entityId: id,
      action: "UPDATE",
      before: { name: before.name, active: before.active },
      after: { name: updated.name, active: updated.active },
    });

    return updated;
  }

  /**
   * Desliga o 2FA de outro usuário (ação de administrador) — diferente do
   * self-service em TwoFactorService.disable, não exige um código TOTP do
   * alvo (o admin não tem acesso a ele). Revoga as sessões ativas do usuário
   * por segurança, já que a proteção de acesso dele mudou por terceiro.
   */
  async adminDisableTwoFactor(companyId: string, targetUserId: string) {
    const user = await this.findById(companyId, targetUserId);

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorTempSecret: null },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId: targetUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.auditService.log({
      entityType: "User",
      entityId: targetUserId,
      action: "UPDATE",
      before: { twoFactorEnabled: user.twoFactorEnabled },
      after: { twoFactorEnabled: false, disabledByAdmin: true },
    });
  }

  private async assertRolesBelongToCompany(companyId: string, roleIds: string[]) {
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds }, companyId },
      select: { id: true },
    });
    if (roles.length !== roleIds.length) {
      throw new BadRequestException("Um ou mais papéis informados não pertencem a esta empresa");
    }
  }

  private async assertInvestorBelongsToCompany(companyId: string, investorId: string) {
    const investor = await this.prisma.investor.findFirst({ where: { id: investorId, companyId } });
    if (!investor) throw new BadRequestException("Investidor informado não pertence a esta empresa");
  }

  private async assertBrokerBelongsToCompany(companyId: string, brokerId: string) {
    const broker = await this.prisma.broker.findFirst({ where: { id: brokerId, companyId } });
    if (!broker) throw new BadRequestException("Corretor informado não pertence a esta empresa");
  }

  private async assertInvestorNotLinked(investorId: string, excludeUserId?: string) {
    const linked = await this.prisma.user.findFirst({
      where: { investorId, id: excludeUserId ? { not: excludeUserId } : undefined },
      select: { id: true },
    });
    if (linked) throw new ConflictException("Este investidor já está vinculado a outro usuário");
  }

  private async assertBrokerNotLinked(brokerId: string, excludeUserId?: string) {
    const linked = await this.prisma.user.findFirst({
      where: { brokerId, id: excludeUserId ? { not: excludeUserId } : undefined },
      select: { id: true },
    });
    if (linked) throw new ConflictException("Este corretor já está vinculado a outro usuário");
  }
}
