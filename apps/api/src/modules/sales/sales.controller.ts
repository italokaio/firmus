import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, UsePipes } from "@nestjs/common";
import {
  PERMISSIONS,
  createProposalSchema,
  createReceivableSchema,
  createSaleSchema,
  presignUploadSchema,
  updateProposalSchema,
  updateReceivableSchema,
  updateSaleSchema,
  upsertFinancingSchema,
  upsertSaleContractSchema,
  type AuthenticatedUser,
  type CreateProposalInput,
  type CreateReceivableInput,
  type CreateSaleInput,
  type PresignUploadInput,
  type UpdateProposalInput,
  type UpdateReceivableInput,
  type UpdateSaleInput,
  type UpsertFinancingInput,
  type UpsertSaleContractInput,
} from "@leilao-erp/types";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { rowScope } from "../../common/row-scope";
import { SalesService } from "./sales.service";

@Controller("properties/:propertyId/sale")
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.SALES_VIEW)
  get(@CurrentUser() user: AuthenticatedUser, @Param("propertyId") propertyId: string) {
    return this.salesService.getSaleByProperty(user.companyId, propertyId, rowScope(user));
  }

  @Post()
  @RequirePermission(PERMISSIONS.SALES_MANAGE)
  @UsePipes(new ZodValidationPipe(createSaleSchema))
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Body() body: CreateSaleInput,
  ) {
    return this.salesService.createSale(user.companyId, propertyId, body, rowScope(user));
  }

  @Patch()
  @RequirePermission(PERMISSIONS.SALES_MANAGE)
  @UsePipes(new ZodValidationPipe(updateSaleSchema))
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Body() body: UpdateSaleInput,
  ) {
    return this.salesService.updateSale(user.companyId, propertyId, body, rowScope(user));
  }

  @Delete()
  @RequirePermission(PERMISSIONS.SALES_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: AuthenticatedUser, @Param("propertyId") propertyId: string): Promise<void> {
    await this.salesService.deleteSale(user.companyId, propertyId, rowScope(user));
  }

  @Post("proposals")
  @RequirePermission(PERMISSIONS.SALES_MANAGE)
  @UsePipes(new ZodValidationPipe(createProposalSchema))
  addProposal(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Body() body: CreateProposalInput,
  ) {
    return this.salesService.addProposal(user.companyId, propertyId, body, rowScope(user));
  }

  @Patch("proposals/:id")
  @RequirePermission(PERMISSIONS.SALES_MANAGE)
  @UsePipes(new ZodValidationPipe(updateProposalSchema))
  updateProposal(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Param("id") id: string,
    @Body() body: UpdateProposalInput,
  ) {
    return this.salesService.updateProposal(user.companyId, propertyId, id, body, rowScope(user));
  }

  @Delete("proposals/:id")
  @RequirePermission(PERMISSIONS.SALES_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProposal(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Param("id") id: string,
  ): Promise<void> {
    await this.salesService.deleteProposal(user.companyId, propertyId, id, rowScope(user));
  }

  @Post("contract/uploads/presign")
  @RequirePermission(PERMISSIONS.SALES_MANAGE)
  @UsePipes(new ZodValidationPipe(presignUploadSchema))
  presignContractUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Body() body: PresignUploadInput,
  ) {
    return this.salesService.createContractUploadUrl(
      user.companyId,
      propertyId,
      body.fileName,
      body.mimeType,
      rowScope(user),
    );
  }

  @Put("contract")
  @RequirePermission(PERMISSIONS.SALES_MANAGE)
  @UsePipes(new ZodValidationPipe(upsertSaleContractSchema))
  upsertContract(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Body() body: UpsertSaleContractInput,
  ) {
    return this.salesService.upsertContract(user.companyId, propertyId, body, rowScope(user));
  }

  @Put("financing")
  @RequirePermission(PERMISSIONS.SALES_MANAGE)
  @UsePipes(new ZodValidationPipe(upsertFinancingSchema))
  upsertFinancing(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Body() body: UpsertFinancingInput,
  ) {
    return this.salesService.upsertFinancing(user.companyId, propertyId, body, rowScope(user));
  }

  @Get("receivables")
  @RequirePermission(PERMISSIONS.SALES_VIEW)
  listReceivables(@CurrentUser() user: AuthenticatedUser, @Param("propertyId") propertyId: string) {
    return this.salesService.listReceivables(user.companyId, propertyId, rowScope(user));
  }

  @Post("receivables")
  @RequirePermission(PERMISSIONS.SALES_MANAGE)
  @UsePipes(new ZodValidationPipe(createReceivableSchema))
  addReceivable(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Body() body: CreateReceivableInput,
  ) {
    return this.salesService.addReceivable(user.companyId, propertyId, body, rowScope(user));
  }

  @Patch("receivables/:id")
  @RequirePermission(PERMISSIONS.SALES_MANAGE)
  @UsePipes(new ZodValidationPipe(updateReceivableSchema))
  updateReceivable(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Param("id") id: string,
    @Body() body: UpdateReceivableInput,
  ) {
    return this.salesService.updateReceivable(user.companyId, propertyId, id, body, rowScope(user));
  }

  @Delete("receivables/:id")
  @RequirePermission(PERMISSIONS.SALES_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteReceivable(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Param("id") id: string,
  ): Promise<void> {
    await this.salesService.deleteReceivable(user.companyId, propertyId, id, rowScope(user));
  }
}
