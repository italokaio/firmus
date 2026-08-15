import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UsePipes } from "@nestjs/common";
import {
  PERMISSIONS,
  createProfitDistributionSchema,
  createPropertyInvestorSchema,
  updatePropertyInvestorSchema,
  updateProfitDistributionSchema,
  type AuthenticatedUser,
  type CreateProfitDistributionInput,
  type CreatePropertyInvestorInput,
  type UpdatePropertyInvestorInput,
  type UpdateProfitDistributionInput,
} from "@leilao-erp/types";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { InvestorsService, type InvestorRowScope } from "./investors.service";

function investorScope(user: AuthenticatedUser): InvestorRowScope {
  return { investorId: user.investorId };
}

@Controller("properties/:propertyId/investors")
export class PropertyInvestorsController {
  constructor(private readonly investorsService: InvestorsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.INVESTORS_VIEW)
  list(@CurrentUser() user: AuthenticatedUser, @Param("propertyId") propertyId: string) {
    return this.investorsService.listPropertyInvestors(user.companyId, propertyId, investorScope(user));
  }

  @Post()
  @RequirePermission(PERMISSIONS.INVESTORS_MANAGE)
  @UsePipes(new ZodValidationPipe(createPropertyInvestorSchema))
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Body() body: CreatePropertyInvestorInput,
  ) {
    return this.investorsService.addPropertyInvestor(user.companyId, propertyId, body);
  }

  @Get("suggested-lucro-base")
  @RequirePermission(PERMISSIONS.INVESTORS_VIEW)
  getSuggestedLucroBase(@CurrentUser() user: AuthenticatedUser, @Param("propertyId") propertyId: string) {
    return this.investorsService.getSuggestedLucroBase(user.companyId, propertyId, investorScope(user));
  }

  @Patch(":id")
  @RequirePermission(PERMISSIONS.INVESTORS_MANAGE)
  @UsePipes(new ZodValidationPipe(updatePropertyInvestorSchema))
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Param("id") id: string,
    @Body() body: UpdatePropertyInvestorInput,
  ) {
    return this.investorsService.updatePropertyInvestor(user.companyId, propertyId, id, body);
  }

  @Delete(":id")
  @RequirePermission(PERMISSIONS.INVESTORS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Param("id") id: string,
  ): Promise<void> {
    await this.investorsService.removePropertyInvestor(user.companyId, propertyId, id);
  }

  @Get(":id/distributions")
  @RequirePermission(PERMISSIONS.INVESTORS_VIEW)
  listDistributions(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Param("id") id: string,
  ) {
    return this.investorsService.listDistributions(user.companyId, propertyId, id, investorScope(user));
  }

  @Post(":id/distributions")
  @RequirePermission(PERMISSIONS.INVESTORS_MANAGE)
  @UsePipes(new ZodValidationPipe(createProfitDistributionSchema))
  createDistribution(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Param("id") id: string,
    @Body() body: CreateProfitDistributionInput,
  ) {
    return this.investorsService.createDistribution(user.companyId, propertyId, id, body);
  }

  @Patch(":id/distributions/:distId")
  @RequirePermission(PERMISSIONS.INVESTORS_MANAGE)
  @UsePipes(new ZodValidationPipe(updateProfitDistributionSchema))
  updateDistribution(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Param("id") id: string,
    @Param("distId") distId: string,
    @Body() body: UpdateProfitDistributionInput,
  ) {
    return this.investorsService.updateDistribution(user.companyId, propertyId, id, distId, body);
  }

  @Delete(":id/distributions/:distId")
  @RequirePermission(PERMISSIONS.INVESTORS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDistribution(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Param("id") id: string,
    @Param("distId") distId: string,
  ): Promise<void> {
    await this.investorsService.deleteDistribution(user.companyId, propertyId, id, distId);
  }
}
