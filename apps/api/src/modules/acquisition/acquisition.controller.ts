import { Body, Controller, Get, Param, Patch, Post, UsePipes } from "@nestjs/common";
import {
  PERMISSIONS,
  createAcquisitionSchema,
  updateAcquisitionSchema,
  type AuthenticatedUser,
  type CreateAcquisitionInput,
  type UpdateAcquisitionInput,
} from "@leilao-erp/types";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AcquisitionService } from "./acquisition.service";

@Controller("properties/:propertyId/acquisition")
export class AcquisitionController {
  constructor(private readonly acquisitionService: AcquisitionService) {}

  @Get()
  @RequirePermission(PERMISSIONS.ACQUISITION_VIEW)
  get(@CurrentUser() user: AuthenticatedUser, @Param("propertyId") propertyId: string) {
    return this.acquisitionService.getByProperty(user.companyId, propertyId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.ACQUISITION_MANAGE)
  @UsePipes(new ZodValidationPipe(createAcquisitionSchema))
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Body() body: CreateAcquisitionInput,
  ) {
    return this.acquisitionService.create(user.companyId, propertyId, body);
  }

  @Patch()
  @RequirePermission(PERMISSIONS.ACQUISITION_MANAGE)
  @UsePipes(new ZodValidationPipe(updateAcquisitionSchema))
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Body() body: UpdateAcquisitionInput,
  ) {
    return this.acquisitionService.update(user.companyId, propertyId, body);
  }
}
