import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { Request } from "express";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
export const CSRF_COOKIE_NAME = "XSRF-TOKEN";
export const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Proteção CSRF por double-submit cookie: no login/refresh a API grava um
 * valor aleatório em um cookie legível por JS (`XSRF-TOKEN`); o frontend o
 * ecoa de volta no header `X-CSRF-Token` em toda requisição que muda estado.
 * Um site atacante não consegue ler o cookie da vítima (same-origin policy),
 * então não tem como montar o header — só o próprio app legítimo consegue.
 *
 * Sem cookie de sessão ainda (ex.: login) não há nada para comparar, então a
 * checagem é pulada — o login é protegido por rate limiting, não por CSRF.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (!MUTATING_METHODS.has(req.method)) return true;

    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
    if (!cookieToken) return true;

    const headerToken = req.headers[CSRF_HEADER_NAME];
    if (headerToken !== cookieToken) {
      throw new ForbiddenException("Token CSRF ausente ou inválido");
    }
    return true;
  }
}
