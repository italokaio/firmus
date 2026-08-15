import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UsePipes } from "@nestjs/common";
import { PERMISSIONS, createTagSchema, type AuthenticatedUser, type CreateTagInput } from "@leilao-erp/types";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { TagsService } from "./tags.service";

@Controller("tags")
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.TAGS_VIEW)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.tagsService.list(user.companyId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.TAGS_MANAGE)
  @UsePipes(new ZodValidationPipe(createTagSchema))
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateTagInput) {
    return this.tagsService.create(user.companyId, body);
  }

  @Delete(":id")
  @RequirePermission(PERMISSIONS.TAGS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<void> {
    await this.tagsService.delete(user.companyId, id);
  }
}
