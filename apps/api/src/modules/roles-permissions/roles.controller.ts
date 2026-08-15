import { Body, Controller, Get, Param, Patch, Post, UsePipes } from "@nestjs/common";
import {
  PERMISSIONS,
  createRoleSchema,
  updateRolePermissionsSchema,
  type AuthenticatedUser,
  type CreateRoleInput,
  type UpdateRolePermissionsInput,
} from "@leilao-erp/types";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RolesService } from "./roles.service";

@Controller("roles")
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.ROLES_VIEW)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.rolesService.listRoles(user.companyId);
  }

  @Get("permissions-catalog")
  @RequirePermission(PERMISSIONS.ROLES_VIEW)
  listCatalog() {
    return this.rolesService.listPermissionsCatalog();
  }

  @Post()
  @RequirePermission(PERMISSIONS.ROLES_MANAGE)
  @UsePipes(new ZodValidationPipe(createRoleSchema))
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateRoleInput) {
    return this.rolesService.createRole(user.companyId, body);
  }

  @Patch(":id/permissions")
  @RequirePermission(PERMISSIONS.ROLES_MANAGE)
  @UsePipes(new ZodValidationPipe(updateRolePermissionsSchema))
  updatePermissions(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") roleId: string,
    @Body() body: UpdateRolePermissionsInput,
  ) {
    return this.rolesService.updateRolePermissions(user.companyId, roleId, body.permissionKeys);
  }
}
