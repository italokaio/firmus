import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UsePipes,
} from "@nestjs/common";
import {
  PERMISSIONS,
  createFinanceAccountSchema,
  createFinanceCategorySchema,
  createTransactionSchema,
  transactionExportFilterSchema,
  transactionFilterSchema,
  updateFinanceAccountSchema,
  updateTransactionSchema,
  type AuthenticatedUser,
  type CreateFinanceAccountInput,
  type CreateFinanceCategoryInput,
  type CreateTransactionInput,
  type TransactionExportFilterInput,
  type TransactionFilterInput,
  type UpdateFinanceAccountInput,
  type UpdateTransactionInput,
} from "@leilao-erp/types";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { FinanceService } from "./finance.service";

@Controller("finance")
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get("summary")
  @RequirePermission(PERMISSIONS.FINANCE_VIEW)
  getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.financeService.getSummary(user.companyId);
  }

  @Get("categories")
  @RequirePermission(PERMISSIONS.FINANCE_VIEW)
  listCategories(@CurrentUser() user: AuthenticatedUser) {
    return this.financeService.listCategories(user.companyId);
  }

  @Post("categories")
  @RequirePermission(PERMISSIONS.FINANCE_MANAGE)
  @UsePipes(new ZodValidationPipe(createFinanceCategorySchema))
  createCategory(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateFinanceCategoryInput) {
    return this.financeService.createCategory(user.companyId, body);
  }

  @Delete("categories/:id")
  @RequirePermission(PERMISSIONS.FINANCE_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCategory(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<void> {
    await this.financeService.deleteCategory(user.companyId, id);
  }

  @Get("accounts")
  @RequirePermission(PERMISSIONS.FINANCE_VIEW)
  listAccounts(@CurrentUser() user: AuthenticatedUser) {
    return this.financeService.listAccounts(user.companyId);
  }

  @Post("accounts")
  @RequirePermission(PERMISSIONS.FINANCE_MANAGE)
  @UsePipes(new ZodValidationPipe(createFinanceAccountSchema))
  createAccount(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateFinanceAccountInput) {
    return this.financeService.createAccount(user.companyId, body);
  }

  @Patch("accounts/:id")
  @RequirePermission(PERMISSIONS.FINANCE_MANAGE)
  @UsePipes(new ZodValidationPipe(updateFinanceAccountSchema))
  updateAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: UpdateFinanceAccountInput,
  ) {
    return this.financeService.updateAccount(user.companyId, id, body);
  }

  @Delete("accounts/:id")
  @RequirePermission(PERMISSIONS.FINANCE_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<void> {
    await this.financeService.deleteAccount(user.companyId, id);
  }

  /** Extrato em Excel (uma linha por lançamento) de toda a empresa, com filtros opcionais. */
  @Get("transactions/export")
  @RequirePermission(PERMISSIONS.FINANCE_VIEW)
  @Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  @Header("Content-Disposition", 'attachment; filename="lancamentos.xlsx"')
  async exportTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(transactionExportFilterSchema)) filters: TransactionExportFilterInput,
  ) {
    return new StreamableFile(await this.financeService.exportTransactionsXlsx(user.companyId, filters));
  }

  /** Soma das despesas por origem ("Pago por") para o filtro informado. */
  @Get("transactions/origin-totals")
  @RequirePermission(PERMISSIONS.FINANCE_VIEW)
  getOriginTotals(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(transactionExportFilterSchema)) filters: TransactionExportFilterInput,
  ) {
    return this.financeService.getTotalsByOrigin(user.companyId, filters);
  }

  @Get("accounts/:id/transactions/:txId/history")
  @RequirePermission(PERMISSIONS.FINANCE_VIEW)
  getTransactionHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") accountId: string,
    @Param("txId") txId: string,
  ) {
    return this.financeService.getTransactionHistory(user.companyId, accountId, txId);
  }

  @Get("accounts/:id/transactions")
  @RequirePermission(PERMISSIONS.FINANCE_VIEW)
  listTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") accountId: string,
    @Query(new ZodValidationPipe(transactionFilterSchema)) filters: TransactionFilterInput,
  ) {
    return this.financeService.listTransactions(user.companyId, accountId, filters);
  }

  @Post("accounts/:id/transactions")
  @RequirePermission(PERMISSIONS.FINANCE_MANAGE)
  @UsePipes(new ZodValidationPipe(createTransactionSchema))
  createTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") accountId: string,
    @Body() body: CreateTransactionInput,
  ) {
    return this.financeService.createTransaction(user.companyId, accountId, body, user.id);
  }

  @Patch("accounts/:id/transactions/:txId")
  @RequirePermission(PERMISSIONS.FINANCE_MANAGE)
  @UsePipes(new ZodValidationPipe(updateTransactionSchema))
  updateTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") accountId: string,
    @Param("txId") txId: string,
    @Body() body: UpdateTransactionInput,
  ) {
    return this.financeService.updateTransaction(user.companyId, accountId, txId, body);
  }

  @Delete("accounts/:id/transactions/:txId")
  @RequirePermission(PERMISSIONS.FINANCE_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") accountId: string,
    @Param("txId") txId: string,
  ): Promise<void> {
    await this.financeService.deleteTransaction(user.companyId, accountId, txId);
  }
}
