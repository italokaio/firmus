import { randomBytes } from "node:crypto";
import type { Response } from "express";
import type { ConfigService } from "@nestjs/config";
import { CSRF_COOKIE_NAME } from "../../common/guards/csrf.guard";

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";
/** Caminho restrito do refresh token — só trafega para as próprias rotas de auth. */
const REFRESH_COOKIE_PATH = "/api/auth";

function cookieBase(configService: ConfigService) {
  return {
    secure: configService.get<string>("COOKIE_SECURE", "false") === "true",
    domain: configService.get<string>("COOKIE_DOMAIN") || undefined,
    sameSite: "lax" as const,
  };
}

export function setAuthCookies(
  res: Response,
  configService: ConfigService,
  tokens: { accessToken: string; refreshToken: string; expiresIn: number },
) {
  const base = cookieBase(configService);
  const refreshDays = configService.get<number>("JWT_REFRESH_EXPIRES_IN_DAYS", 30);
  const refreshMaxAge = refreshDays * 24 * 60 * 60 * 1000;

  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...base,
    httpOnly: true,
    path: "/",
    maxAge: tokens.expiresIn * 1000,
  });
  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...base,
    httpOnly: true,
    path: REFRESH_COOKIE_PATH,
    maxAge: refreshMaxAge,
  });
  // Legível por JS de propósito — é a metade "conhecida pelo cliente" do
  // padrão double-submit (ver CsrfGuard). Não é secreto por si só.
  res.cookie(CSRF_COOKIE_NAME, randomBytes(24).toString("hex"), {
    ...base,
    httpOnly: false,
    path: "/",
    maxAge: refreshMaxAge,
  });
}

export function clearAuthCookies(res: Response, configService: ConfigService) {
  const base = cookieBase(configService);
  res.clearCookie(ACCESS_TOKEN_COOKIE, { ...base, path: "/" });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { ...base, path: REFRESH_COOKIE_PATH });
  res.clearCookie(CSRF_COOKIE_NAME, { ...base, path: "/" });
}
