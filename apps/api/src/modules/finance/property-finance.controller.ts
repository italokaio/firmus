import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UsePipes } from "@nestjs/common";
import {
  PERMISSIONS,
  createTransactionSchema,
  transactionFilterSchema,
  updateTransactionSchema,
  type AuthenticatedUser,
  type CreateTransactionInput,
  type TransactionFilterInput,
  type UpdateTransactionInput,
} from "@leilao-erp/types";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { FinanceService } from "./finance.service";

@Controller("properties/:propertyId/finance")
export class PropertyFinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get("account")
  @RequirePermission(PERMISSIONS.FINANCE_VIEW)
  getAccount(@CurrentUser() user: AuthenticatedUser, @Param("propertyId") propertyId: string) {
    return this.financeService.getAccountByProperty(user.companyId, propertyId);
  }

  @Get("transactions")
  @RequirePermission(PERMISSIONS.FINANCE_VIEW)
  listTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Query(new ZodValidationPipe(transactionFilterSchema)) filters: TransactionFilterInput,
  ) {
    return this.financeService.listTransactionsByProperty(user.companyId, propertyId, filters);
  }

  @Post("transactions")
  @RequirePermission(PERMISSIONS.FINANCE_MANAGE)
  @UsePipes(new ZodValidationPipe(createTransactionSchema))
  createTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Body() body: CreateTransactionInput,
  ) {
    return this.financeService.createTransactionByProperty(user.companyId, propertyId, body, user.id);
  }

  @Patch("transactions/:txId")
  @RequirePermission(PERMISSIONS.FINANCE_MANAGE)
  @UsePipes(new ZodValidationPipe(updateTransactionSchema))
  updateTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Param("txId") txId: string,
    @Body() body: UpdateTransactionInput,
  ) {
    return this.financeService.updateTransactionByProperty(user.companyId, propertyId, txId, body);
  }

  @Delete("transactions/:txId")
  @RequirePermission(PERMISSIONS.FINANCE_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Param("txId") txId: string,
  ): Promise<void> {
    await this.financeService.deleteTransactionByProperty(user.companyId, propertyId, txId);
  }

  @Get("dre")
  @RequirePermission(PERMISSIONS.FINANCE_VIEW)
  getDre(@CurrentUser() user: AuthenticatedUser, @Param("propertyId") propertyId: string) {
    return this.financeService.getDre(user.companyId, propertyId);
  }

  @Get("cashflow")
  @RequirePermission(PERMISSIONS.FINANCE_VIEW)
  getCashflow(@CurrentUser() user: AuthenticatedUser, @Param("propertyId") propertyId: string) {
    return this.financeService.getCashflow(user.companyId, propertyId);
  }
}
