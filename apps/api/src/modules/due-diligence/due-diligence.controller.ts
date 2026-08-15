import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, UsePipes } from "@nestjs/common";
import {
  PERMISSIONS,
  confirmDueDiligenceFileSchema,
  createDueDiligenceCommentSchema,
  createDueDiligenceItemSchema,
  presignUploadSchema,
  updateDueDiligenceItemSchema,
  type AuthenticatedUser,
  type ConfirmDueDiligenceFileInput,
  type CreateDueDiligenceCommentInput,
  type CreateDueDiligenceItemInput,
  type PresignUploadInput,
  type UpdateDueDiligenceItemInput,
} from "@leilao-erp/types";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { DueDiligenceService } from "./due-diligence.service";

@Controller("properties/:propertyId/due-diligence")
export class DueDiligenceController {
  constructor(private readonly dueDiligenceService: DueDiligenceService) {}

  @Get()
  @RequirePermission(PERMISSIONS.DUE_DILIGENCE_VIEW)
  list(@CurrentUser() user: AuthenticatedUser, @Param("propertyId") propertyId: string) {
    return this.dueDiligenceService.listItems(user.companyId, propertyId);
  }

  @Post("initialize")
  @RequirePermission(PERMISSIONS.DUE_DILIGENCE_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  initialize(@CurrentUser() user: AuthenticatedUser, @Param("propertyId") propertyId: string) {
    return this.dueDiligenceService.initializeChecklist(user.companyId, propertyId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.DUE_DILIGENCE_MANAGE)
  @UsePipes(new ZodValidationPipe(createDueDiligenceItemSchema))
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Body() body: CreateDueDiligenceItemInput,
  ) {
    return this.dueDiligenceService.createItem(user.companyId, propertyId, body);
  }

  @Patch(":itemId")
  @RequirePermission(PERMISSIONS.DUE_DILIGENCE_MANAGE)
  @UsePipes(new ZodValidationPipe(updateDueDiligenceItemSchema))
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Param("itemId") itemId: string,
    @Body() body: UpdateDueDiligenceItemInput,
  ) {
    return this.dueDiligenceService.updateItem(user.companyId, propertyId, itemId, body);
  }

  @Post(":itemId/comments")
  @RequirePermission(PERMISSIONS.DUE_DILIGENCE_MANAGE)
  @UsePipes(new ZodValidationPipe(createDueDiligenceCommentSchema))
  addComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Param("itemId") itemId: string,
    @Body() body: CreateDueDiligenceCommentInput,
  ) {
    return this.dueDiligenceService.addComment(user.companyId, propertyId, itemId, user.id, body);
  }

  @Post(":itemId/uploads/presign")
  @RequirePermission(PERMISSIONS.DUE_DILIGENCE_MANAGE)
  @UsePipes(new ZodValidationPipe(presignUploadSchema))
  presignUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Param("itemId") itemId: string,
    @Body() body: PresignUploadInput,
  ) {
    return this.dueDiligenceService.createFileUploadUrl(
      user.companyId,
      propertyId,
      itemId,
      body.fileName,
      body.mimeType,
    );
  }

  @Post(":itemId/files")
  @RequirePermission(PERMISSIONS.DUE_DILIGENCE_MANAGE)
  @UsePipes(new ZodValidationPipe(confirmDueDiligenceFileSchema))
  confirmFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Param("itemId") itemId: string,
    @Body() body: ConfirmDueDiligenceFileInput,
  ) {
    return this.dueDiligenceService.confirmFile(user.companyId, propertyId, itemId, body, user.id);
  }
}
