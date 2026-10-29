import { Controller, Get, Query } from "@nestjs/common";
import {
  PERMISSIONS,
  portfolioQuerySchema,
  type AuthenticatedUser,
  type PortfolioQueryInput,
} from "@leilao-erp/types";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("summary")
  @RequirePermission(PERMISSIONS.DASHBOARD_VIEW)
  getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getSummary(user.companyId);
  }

  /** Dashboard de negócio: funil, projeção de resultado, caixa, origem do capital e alertas. */
  @Get("portfolio")
  @RequirePermission(PERMISSIONS.DASHBOARD_VIEW)
  getPortfolio(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(portfolioQuerySchema)) query: PortfolioQueryInput,
  ) {
    return this.dashboardService.getPortfolio(user.companyId, query.month);
  }
}
