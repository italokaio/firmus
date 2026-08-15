import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UsePipes } from "@nestjs/common";
import {
  PERMISSIONS,
  createInvestorSchema,
  updateInvestorSchema,
  type AuthenticatedUser,
  type CreateInvestorInput,
  type UpdateInvestorInput,
} from "@leilao-erp/types";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { InvestorsService, type InvestorRowScope } from "./investors.service";

function investorScope(user: AuthenticatedUser): InvestorRowScope {
  return { investorId: user.investorId };
}

@Controller("investors")
export class InvestorsController {
  constructor(private readonly investorsService: InvestorsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.INVESTORS_VIEW)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.investorsService.listInvestors(user.companyId, investorScope(user));
  }

  @Post()
  @RequirePermission(PERMISSIONS.INVESTORS_MANAGE)
  @UsePipes(new ZodValidationPipe(createInvestorSchema))
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateInvestorInput) {
    return this.investorsService.createInvestor(user.companyId, body);
  }

  @Get(":id")
  @RequirePermission(PERMISSIONS.INVESTORS_VIEW)
  getDetail(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.investorsService.getInvestorDetail(user.companyId, id, investorScope(user));
  }

  @Patch(":id")
  @RequirePermission(PERMISSIONS.INVESTORS_MANAGE)
  @UsePipes(new ZodValidationPipe(updateInvestorSchema))
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: UpdateInvestorInput,
  ) {
    return this.investorsService.updateInvestor(user.companyId, id, body);
  }

  @Delete(":id")
  @RequirePermission(PERMISSIONS.INVESTORS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<void> {
    await this.investorsService.deleteInvestor(user.companyId, id);
  }
}
