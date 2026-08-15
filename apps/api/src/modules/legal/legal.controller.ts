import { Body, Controller, Get, Param, Patch, Post, UsePipes } from "@nestjs/common";
import {
  PERMISSIONS,
  confirmLegalDocumentSchema,
  createLegalEventSchema,
  presignUploadSchema,
  updateLegalCaseSchema,
  updateLegalEventSchema,
  type AuthenticatedUser,
  type ConfirmLegalDocumentInput,
  type CreateLegalEventInput,
  type PresignUploadInput,
  type UpdateLegalCaseInput,
  type UpdateLegalEventInput,
} from "@leilao-erp/types";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { LegalService } from "./legal.service";

@Controller("properties/:propertyId/legal")
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Get()
  @RequirePermission(PERMISSIONS.LEGAL_VIEW)
  get(@CurrentUser() user: AuthenticatedUser, @Param("propertyId") propertyId: string) {
    return this.legalService.getByProperty(user.companyId, propertyId);
  }

  @Patch()
  @RequirePermission(PERMISSIONS.LEGAL_MANAGE)
  @UsePipes(new ZodValidationPipe(updateLegalCaseSchema))
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Body() body: UpdateLegalCaseInput,
  ) {
    return this.legalService.update(user.companyId, propertyId, body);
  }

  @Post("events")
  @RequirePermission(PERMISSIONS.LEGAL_MANAGE)
  @UsePipes(new ZodValidationPipe(createLegalEventSchema))
  addEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Body() body: CreateLegalEventInput,
  ) {
    return this.legalService.addEvent(user.companyId, propertyId, body);
  }

  @Patch("events/:eventId")
  @RequirePermission(PERMISSIONS.LEGAL_MANAGE)
  @UsePipes(new ZodValidationPipe(updateLegalEventSchema))
  updateEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Param("eventId") eventId: string,
    @Body() body: UpdateLegalEventInput,
  ) {
    return this.legalService.updateEvent(user.companyId, propertyId, eventId, body);
  }

  @Post("uploads/presign")
  @RequirePermission(PERMISSIONS.LEGAL_MANAGE)
  @UsePipes(new ZodValidationPipe(presignUploadSchema))
  presignUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Body() body: PresignUploadInput,
  ) {
    return this.legalService.createDocumentUploadUrl(user.companyId, propertyId, body.fileName, body.mimeType);
  }

  @Post("documents")
  @RequirePermission(PERMISSIONS.LEGAL_MANAGE)
  @UsePipes(new ZodValidationPipe(confirmLegalDocumentSchema))
  confirmDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Body() body: ConfirmLegalDocumentInput,
  ) {
    return this.legalService.confirmDocument(user.companyId, propertyId, body, user.id);
  }
}
