import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UsePipes,
} from "@nestjs/common";
import {
  PERMISSIONS,
  confirmDocumentUploadSchema,
  confirmPhotoUploadSchema,
  createPropertySchema,
  presignUploadSchema,
  propertyFilterSchema,
  updatePropertySchema,
  type AuthenticatedUser,
  type ConfirmDocumentUploadInput,
  type ConfirmPhotoUploadInput,
  type CreatePropertyInput,
  type PresignUploadInput,
  type PropertyFilterInput,
  type UpdatePropertyInput,
} from "@leilao-erp/types";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { rowScope } from "../../common/row-scope";
import { PropertiesService } from "./properties.service";

@Controller("properties")
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.PROPERTIES_VIEW)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(propertyFilterSchema)) filters: PropertyFilterInput,
  ) {
    return this.propertiesService.list(user.companyId, filters, rowScope(user));
  }

  @Get(":id")
  @RequirePermission(PERMISSIONS.PROPERTIES_VIEW)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.propertiesService.findById(user.companyId, id, rowScope(user));
  }

  @Post()
  @RequirePermission(PERMISSIONS.PROPERTIES_CREATE)
  @UsePipes(new ZodValidationPipe(createPropertySchema))
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreatePropertyInput) {
    return this.propertiesService.create(user.companyId, body, user.id);
  }

  @Patch(":id")
  @RequirePermission(PERMISSIONS.PROPERTIES_EDIT)
  @UsePipes(new ZodValidationPipe(updatePropertySchema))
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: UpdatePropertyInput,
  ) {
    return this.propertiesService.update(user.companyId, id, body, rowScope(user));
  }

  @Delete(":id")
  @RequirePermission(PERMISSIONS.PROPERTIES_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<void> {
    await this.propertiesService.delete(user.companyId, id);
  }

  @Post(":id/uploads/presign")
  @RequirePermission(PERMISSIONS.PROPERTIES_EDIT)
  @UsePipes(new ZodValidationPipe(presignUploadSchema))
  presignUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: PresignUploadInput,
  ) {
    return this.propertiesService.createUploadUrl(
      user.companyId,
      id,
      body.fileName,
      body.mimeType,
      rowScope(user),
    );
  }

  @Post(":id/photos")
  @RequirePermission(PERMISSIONS.PROPERTIES_EDIT)
  @UsePipes(new ZodValidationPipe(confirmPhotoUploadSchema))
  confirmPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: ConfirmPhotoUploadInput,
  ) {
    return this.propertiesService.confirmPhoto(user.companyId, id, body, rowScope(user));
  }

  @Delete(":id/photos/:photoId")
  @RequirePermission(PERMISSIONS.PROPERTIES_EDIT)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("photoId") photoId: string,
  ): Promise<void> {
    await this.propertiesService.deletePhoto(user.companyId, id, photoId, rowScope(user));
  }

  @Post(":id/documents")
  @RequirePermission(PERMISSIONS.PROPERTIES_EDIT)
  @UsePipes(new ZodValidationPipe(confirmDocumentUploadSchema))
  confirmDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: ConfirmDocumentUploadInput,
  ) {
    return this.propertiesService.confirmDocument(user.companyId, id, body, rowScope(user));
  }

  @Get(":id/documents/:documentId/download")
  @RequirePermission(PERMISSIONS.PROPERTIES_VIEW)
  getDocumentDownloadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("documentId") documentId: string,
  ) {
    return this.propertiesService.getDocumentDownloadUrl(user.companyId, id, documentId, rowScope(user));
  }
}
