import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { authenticator } from "otplib";
import { randomBytes, createHash } from "node:crypto";
import type { AuthenticatedUser, AuthTokens, JwtAccessPayload, LoginInput } from "@leilao-erp/types";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

interface TwoFactorTokenPayload {
  sub: string;
  companyId: string;
  purpose: "2fa";
}

type LoginServiceResult =
  | { user: AuthenticatedUser; tokens: AuthTokens }
  | { requiresTwoFactor: true; twoFactorToken: string };

interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

const userWithRolesInclude = {
  roles: {
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  },
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async login(input: LoginInput, meta: RequestMeta): Promise<LoginServiceResult> {
    const company = await this.prisma.company.findUnique({
      where: { slug: input.companySlug },
    });
    if (!company || !company.active) {
      throw new UnauthorizedException("Empresa, e-mail ou senha inválidos");
    }

    const user = await this.prisma.user.findFirst({
      where: { companyId: company.id, email: input.email, active: true },
      include: userWithRolesInclude,
    });
    if (!user) {
      throw new UnauthorizedException("Empresa, e-mail ou senha inválidos");
    }

    const passwordMatches = await argon2.verify(user.passwordHash, input.password);
    if (!passwordMatches) {
      throw new UnauthorizedException("Empresa, e-mail ou senha inválidos");
    }

    if (user.twoFactorEnabled) {
      const twoFactorToken = await this.issueTwoFactorToken(user.id, user.companyId);
      return { requiresTwoFactor: true, twoFactorToken };
    }

    return this.completeLogin(user, meta);
  }

  async verifyTwoFactorLogin(twoFactorToken: string, code: string, meta: RequestMeta) {
    let payload: TwoFactorTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<TwoFactorTokenPayload>(twoFactorToken, {
        secret: this.configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Código expirado — faça login novamente");
    }
    if (payload.purpose !== "2fa") throw new UnauthorizedException("Token inválido");

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, companyId: payload.companyId, active: true },
      include: userWithRolesInclude,
    });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException("Sessão expirada — faça login novamente");
    }

    if (!authenticator.verify({ token: code, secret: user.twoFactorSecret })) {
      throw new UnauthorizedException("Código de verificação inválido");
    }

    return this.completeLogin(user, meta);
  }

  private async completeLogin(
    user: {
      id: string;
      companyId: string;
      name: string;
      email: string;
      investorId: string | null;
      brokerId: string | null;
      roles: Array<{ role: { name: string; permissions: Array<{ permission: { key: string } }> } }>;
    },
    meta: RequestMeta,
  ) {
    const authenticatedUser = this.toAuthenticatedUser(user);
    const tokens = await this.issueTokens(authenticatedUser, meta);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.auditService.log({
      entityType: "User",
      entityId: user.id,
      action: "LOGIN",
      companyId: user.companyId,
      userId: user.id,
    });

    return { user: authenticatedUser, tokens };
  }

  private async issueTwoFactorToken(userId: string, companyId: string): Promise<string> {
    const payload: TwoFactorTokenPayload = { sub: userId, companyId, purpose: "2fa" };
    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
      expiresIn: "5m",
    });
  }

  async refresh(refreshToken: string, meta: RequestMeta) {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Sessão expirada, faça login novamente");
    }

    const user = await this.prisma.user.findFirst({
      where: { id: stored.userId, companyId: stored.companyId, active: true },
      include: userWithRolesInclude,
    });
    if (!user) {
      throw new UnauthorizedException("Sessão expirada, faça login novamente");
    }

    const authenticatedUser = this.toAuthenticatedUser(user);
    const tokens = await this.issueTokens(authenticatedUser, meta);

    const newTokenHash = this.hashToken(tokens.refreshToken);
    const newRecord = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: newTokenHash },
    });

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedBy: newRecord?.id },
    });

    return { user: authenticatedUser, tokens };
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Troca a senha da própria conta. Revoga os refresh tokens de outras
   * sessões (mantém a sessão atual, identificada pelo cookie corrente) —
   * mitiga o caso de um token roubado continuar valendo após a troca.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentRefreshToken: string | undefined,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const passwordMatches = await argon2.verify(user.passwordHash, currentPassword);
    if (!passwordMatches) {
      throw new UnauthorizedException("Senha atual incorreta");
    }

    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    const currentTokenHash = currentRefreshToken ? this.hashToken(currentRefreshToken) : undefined;
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(currentTokenHash ? { tokenHash: { not: currentTokenHash } } : {}),
      },
      data: { revokedAt: new Date() },
    });

    await this.auditService.log({
      entityType: "User",
      entityId: userId,
      action: "UPDATE",
      companyId: user.companyId,
      userId,
      after: { passwordChanged: true },
    });
  }

  private async issueTokens(user: AuthenticatedUser, meta: RequestMeta): Promise<AuthTokens> {
    const payload: JwtAccessPayload = {
      sub: user.id,
      companyId: user.companyId,
      roles: user.roles,
      permissions: user.permissions,
      investorId: user.investorId,
      brokerId: user.brokerId,
    };

    const expiresIn = this.configService.get<string>("JWT_ACCESS_EXPIRES_IN", "15m");
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
      expiresIn,
    });

    const refreshToken = randomBytes(48).toString("hex");
    const refreshDays = this.configService.get<number>("JWT_REFRESH_EXPIRES_IN_DAYS", 30);
    const expiresAt = new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
        createdByIp: meta.ip,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiresInSeconds(expiresIn),
    };
  }

  private toAuthenticatedUser(
    user: {
      id: string;
      companyId: string;
      name: string;
      email: string;
      investorId: string | null;
      brokerId: string | null;
      roles: Array<{ role: { name: string; permissions: Array<{ permission: { key: string } }> } }>;
    },
  ): AuthenticatedUser {
    const roles = user.roles.map((userRole) => userRole.role.name);
    const permissions = Array.from(
      new Set(
        user.roles.flatMap((userRole) =>
          userRole.role.permissions.map((rolePermission) => rolePermission.permission.key),
        ),
      ),
    );

    return {
      id: user.id,
      companyId: user.companyId,
      name: user.name,
      email: user.email,
      roles,
      permissions,
      investorId: user.investorId ?? undefined,
      brokerId: user.brokerId ?? undefined,
    };
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private parseExpiresInSeconds(expiresIn: string): number {
    const match = /^(\d+)([smhd])$/.exec(expiresIn);
    if (!match) return 900;
    const [, amountStr, unit] = match;
    const amount = Number(amountStr);
    const unitSeconds = { s: 1, m: 60, h: 3600, d: 86400 }[unit as "s" | "m" | "h" | "d"];
    return amount * unitSeconds;
  }
}
