import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, UsePipes } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  PERMISSIONS,
  registerCompanySchema,
  updateCompanyProfileSchema,
  type RegisterCompanyInput,
  type UpdateCompanyProfileInput,
} from "@leilao-erp/types";
import { Public } from "../../common/decorators/public.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CompaniesService } from "./companies.service";
import type { AuthenticatedUser } from "@leilao-erp/types";

@Controller("companies")
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Public()
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(registerCompanySchema))
  register(@Body() body: RegisterCompanyInput) {
    return this.companiesService.provisionNewCompany(body);
  }

  @Get("me")
  @RequirePermission(PERMISSIONS.COMPANY_VIEW)
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.companiesService.getProfile(user.companyId);
  }

  @Patch("me")
  @RequirePermission(PERMISSIONS.COMPANY_MANAGE)
  @UsePipes(new ZodValidationPipe(updateCompanyProfileSchema))
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateCompanyProfileInput) {
    return this.companiesService.updateProfile(user.companyId, body);
  }
}
