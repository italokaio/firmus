import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UsePipes } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import {
  loginVerifyTwoFactorSchema,
  twoFactorDisableSchema,
  twoFactorVerifySetupSchema,
  type AuthenticatedUser,
  type LoginVerifyTwoFactorInput,
  type TwoFactorDisableInput,
  type TwoFactorVerifySetupInput,
} from "@leilao-erp/types";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AuthService } from "./auth.service";
import { TwoFactorService } from "./two-factor.service";
import { setAuthCookies } from "./auth-cookies";

@Controller("auth/2fa")
export class TwoFactorController {
  constructor(
    private readonly twoFactorService: TwoFactorService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get("status")
  getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.twoFactorService.getStatus(user.id);
  }

  @Post("setup")
  setup(@CurrentUser() user: AuthenticatedUser) {
    return this.twoFactorService.setup(user.id, user.email);
  }

  @Post("enable")
  @UsePipes(new ZodValidationPipe(twoFactorVerifySetupSchema))
  async enable(@CurrentUser() user: AuthenticatedUser, @Body() body: TwoFactorVerifySetupInput) {
    await this.twoFactorService.enable(user.id, body.code);
    return { enabled: true };
  }

  @Post("disable")
  @UsePipes(new ZodValidationPipe(twoFactorDisableSchema))
  async disable(@CurrentUser() user: AuthenticatedUser, @Body() body: TwoFactorDisableInput) {
    await this.twoFactorService.disable(user.id, body.code);
    return { enabled: false };
  }

  @Public()
  @Post("verify-login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(loginVerifyTwoFactorSchema))
  async verifyLogin(
    @Body() body: LoginVerifyTwoFactorInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.authService.verifyTwoFactorLogin(body.twoFactorToken, body.code, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
    setAuthCookies(res, this.configService, tokens);
    return { user };
  }
}
