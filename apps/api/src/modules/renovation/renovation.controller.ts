import { Body, Controller, Get, Param, Patch, Post, UsePipes } from "@nestjs/common";
import {
  PERMISSIONS,
  confirmRenovationMediaSchema,
  createChecklistItemSchema,
  createRenovationCommentSchema,
  createRenovationTaskSchema,
  moveRenovationTaskSchema,
  presignUploadSchema,
  updateChecklistItemSchema,
  updateRenovationTaskSchema,
  type AuthenticatedUser,
  type ConfirmRenovationMediaInput,
  type CreateChecklistItemInput,
  type CreateRenovationCommentInput,
  type CreateRenovationTaskInput,
  type MoveRenovationTaskInput,
  type PresignUploadInput,
  type UpdateChecklistItemInput,
  type UpdateRenovationTaskInput,
} from "@leilao-erp/types";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RenovationService } from "./renovation.service";

@Controller("properties/:propertyId/renovation")
export class RenovationController {
  constructor(private readonly renovationService: RenovationService) {}

  @Get("tasks")
  @RequirePermission(PERMISSIONS.RENOVATION_VIEW)
  list(@CurrentUser() user: AuthenticatedUser, @Param("propertyId") propertyId: string) {
    return this.renovationService.listBoard(user.companyId, propertyId);
  }

  @Post("tasks")
  @RequirePermission(PERMISSIONS.RENOVATION_MANAGE)
  @UsePipes(new ZodValidationPipe(createRenovationTaskSchema))
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Body() body: CreateRenovationTaskInput,
  ) {
    return this.renovationService.createTask(user.companyId, propertyId, body);
  }

  @Patch("tasks/:taskId")
  @RequirePermission(PERMISSIONS.RENOVATION_MANAGE)
  @UsePipes(new ZodValidationPipe(updateRenovationTaskSchema))
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Param("taskId") taskId: string,
    @Body() body: UpdateRenovationTaskInput,
  ) {
    return this.renovationService.updateTask(user.companyId, propertyId, taskId, body);
  }

  @Patch("tasks/:taskId/move")
  @RequirePermission(PERMISSIONS.RENOVATION_MANAGE)
  @UsePipes(new ZodValidationPipe(moveRenovationTaskSchema))
  move(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Param("taskId") taskId: string,
    @Body() body: MoveRenovationTaskInput,
  ) {
    return this.renovationService.moveTask(user.companyId, propertyId, taskId, body);
  }

  @Post("tasks/:taskId/checklist")
  @RequirePermission(PERMISSIONS.RENOVATION_MANAGE)
  @UsePipes(new ZodValidationPipe(createChecklistItemSchema))
  addChecklistItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Param("taskId") taskId: string,
    @Body() body: CreateChecklistItemInput,
  ) {
    return this.renovationService.addChecklistItem(user.companyId, propertyId, taskId, body);
  }

  @Patch("tasks/:taskId/checklist/:itemId")
  @RequirePermission(PERMISSIONS.RENOVATION_MANAGE)
  @UsePipes(new ZodValidationPipe(updateChecklistItemSchema))
  updateChecklistItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Param("taskId") taskId: string,
    @Param("itemId") itemId: string,
    @Body() body: UpdateChecklistItemInput,
  ) {
    return this.renovationService.updateChecklistItem(user.companyId, propertyId, taskId, itemId, body);
  }

  @Post("tasks/:taskId/comments")
  @RequirePermission(PERMISSIONS.RENOVATION_MANAGE)
  @UsePipes(new ZodValidationPipe(createRenovationCommentSchema))
  addComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Param("taskId") taskId: string,
    @Body() body: CreateRenovationCommentInput,
  ) {
    return this.renovationService.addComment(user.companyId, propertyId, taskId, user.id, body);
  }

  @Post("tasks/:taskId/uploads/presign")
  @RequirePermission(PERMISSIONS.RENOVATION_MANAGE)
  @UsePipes(new ZodValidationPipe(presignUploadSchema))
  presignUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Param("taskId") taskId: string,
    @Body() body: PresignUploadInput,
  ) {
    return this.renovationService.createMediaUploadUrl(
      user.companyId,
      propertyId,
      taskId,
      body.fileName,
      body.mimeType,
    );
  }

  @Post("tasks/:taskId/media")
  @RequirePermission(PERMISSIONS.RENOVATION_MANAGE)
  @UsePipes(new ZodValidationPipe(confirmRenovationMediaSchema))
  confirmMedia(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Param("taskId") taskId: string,
    @Body() body: ConfirmRenovationMediaInput,
  ) {
    return this.renovationService.confirmMedia(user.companyId, propertyId, taskId, body);
  }
}
