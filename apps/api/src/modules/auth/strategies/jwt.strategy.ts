import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { Request } from "express";
import type { AuthenticatedUser, JwtAccessPayload } from "@leilao-erp/types";
import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { ACCESS_TOKEN_COOKIE } from "../auth-cookies";

/**
 * O SPA autentica via cookie httpOnly (imune a roubo de token por XSS); o
 * header Bearer continua aceito para integrações/API/Swagger que não têm
 * como manter um cookie de navegador. Cookie tem prioridade quando ambos
 * estão presentes.
 */
function extractFromCookie(req: Request): string | null {
  return req?.cookies?.[ACCESS_TOKEN_COOKIE] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([extractFromCookie, ExtractJwt.fromAuthHeaderAsBearerToken()]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
    });
  }

  async validate(payload: JwtAccessPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, companyId: payload.companyId, active: true },
    });

    if (!user) {
      throw new UnauthorizedException("Usuário inválido ou inativo");
    }

    return {
      id: user.id,
      companyId: user.companyId,
      name: user.name,
      email: user.email,
      roles: payload.roles,
      permissions: payload.permissions,
      // Lidos do banco (não do payload) porque esta strategy já refaz essa
      // query a cada requisição — evita ficar até 15min desatualizado se um
      // admin vincular/desvincular investorId/brokerId depois do login.
      investorId: user.investorId ?? undefined,
      brokerId: user.brokerId ?? undefined,
    };
  }
}
