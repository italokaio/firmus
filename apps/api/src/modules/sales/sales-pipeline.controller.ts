import { Controller, Get } from "@nestjs/common";
import { PERMISSIONS, type AuthenticatedUser } from "@leilao-erp/types";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { rowScope } from "../../common/row-scope";
import { SalesService } from "./sales.service";

@Controller("sales")
export class SalesPipelineController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.SALES_VIEW)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.salesService.listSales(user.companyId, rowScope(user));
  }
}
