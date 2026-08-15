import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UsePipes } from "@nestjs/common";
import {
  PERMISSIONS,
  createReportSchema,
  type AuthenticatedUser,
  type CreateReportInput,
} from "@leilao-erp/types";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { ReportsService } from "./reports.service";

@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.REPORTS_VIEW)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.listReports(user.companyId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.REPORTS_MANAGE)
  @UsePipes(new ZodValidationPipe(createReportSchema))
  generate(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateReportInput) {
    return this.reportsService.generateReport(user.companyId, user.id, body);
  }

  @Delete(":id")
  @RequirePermission(PERMISSIONS.REPORTS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<void> {
    await this.reportsService.deleteReport(user.companyId, id);
  }
}
