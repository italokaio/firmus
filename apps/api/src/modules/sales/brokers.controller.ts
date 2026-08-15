import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UsePipes } from "@nestjs/common";
import {
  PERMISSIONS,
  createBrokerSchema,
  updateBrokerSchema,
  type AuthenticatedUser,
  type CreateBrokerInput,
  type UpdateBrokerInput,
} from "@leilao-erp/types";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { SalesService } from "./sales.service";

@Controller("brokers")
export class BrokersController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.SALES_VIEW)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.salesService.listBrokers(user.companyId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.SALES_MANAGE)
  @UsePipes(new ZodValidationPipe(createBrokerSchema))
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateBrokerInput) {
    return this.salesService.createBroker(user.companyId, body);
  }

  @Patch(":id")
  @RequirePermission(PERMISSIONS.SALES_MANAGE)
  @UsePipes(new ZodValidationPipe(updateBrokerSchema))
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: UpdateBrokerInput,
  ) {
    return this.salesService.updateBroker(user.companyId, id, body);
  }

  @Delete(":id")
  @RequirePermission(PERMISSIONS.SALES_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<void> {
    await this.salesService.deleteBroker(user.companyId, id);
  }
}
