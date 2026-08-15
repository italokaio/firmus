import { Module } from "@nestjs/common";
import { RolesController } from "./roles.controller";
import { RolesService } from "./roles.service";
import { PermissionsCatalogService } from "./permissions-catalog.service";

@Module({
  controllers: [RolesController],
  providers: [RolesService, PermissionsCatalogService],
  exports: [RolesService],
})
export class RolesPermissionsModule {}
