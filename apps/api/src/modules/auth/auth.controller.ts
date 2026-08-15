import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException, UsePipes } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import {
  changePasswordSchema,
  loginSchema,
  type AuthenticatedUser,
  type ChangePasswordInput,
  type LoginInput,
} from "@leilao-erp/types";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AuthService } from "./auth.service";
import { REFRESH_TOKEN_COOKIE, clearAuthCookies, setAuthCookies } from "./auth-cookies";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(loginSchema))
  async login(
    @Body() body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(body, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
    if ("requiresTwoFactor" in result) return result;

    setAuthCookies(res, this.configService, result.tokens);
    return { user: result.user };
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!refreshToken) throw new UnauthorizedException("Sessão expirada, faça login novamente");

    const { user, tokens } = await this.authService.refresh(refreshToken, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
    setAuthCookies(res, this.configService, tokens);
    return { user };
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (refreshToken) await this.authService.logout(refreshToken);
    clearAuthCookies(res, this.configService);
  }

  /** Confirma se a sessão (cookie) ainda é válida — usado no boot do SPA. */
  @Get("me")
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }

  /** Troca a senha da própria conta — self-service, sem permissão especial. */
  @Post("change-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UsePipes(new ZodValidationPipe(changePasswordSchema))
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ChangePasswordInput,
    @Req() req: Request,
  ): Promise<void> {
    const currentRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    await this.authService.changePassword(user.id, body.currentPassword, body.newPassword, currentRefreshToken);
  }
}
