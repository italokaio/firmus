import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Put, UsePipes } from "@nestjs/common";
import {
  PERMISSIONS,
  upsertSimulatorScenarioSchema,
  type AuthenticatedUser,
  type UpsertSimulatorScenarioInput,
} from "@leilao-erp/types";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { SimulatorService } from "./simulator.service";

@Controller("properties/:propertyId/simulator")
export class SimulatorController {
  constructor(private readonly simulatorService: SimulatorService) {}

  @Get()
  @RequirePermission(PERMISSIONS.SIMULATOR_VIEW)
  getOverview(@CurrentUser() user: AuthenticatedUser, @Param("propertyId") propertyId: string) {
    return this.simulatorService.getOverview(user.companyId, propertyId);
  }

  @Put("scenarios/:tipo")
  @RequirePermission(PERMISSIONS.SIMULATOR_MANAGE)
  @UsePipes(new ZodValidationPipe(upsertSimulatorScenarioSchema))
  upsertScenario(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Param("tipo") tipo: string,
    @Body() body: UpsertSimulatorScenarioInput,
  ) {
    return this.simulatorService.upsertScenario(user.companyId, propertyId, tipo, body);
  }

  @Delete("scenarios/:tipo")
  @RequirePermission(PERMISSIONS.SIMULATOR_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteScenario(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Param("tipo") tipo: string,
  ): Promise<void> {
    await this.simulatorService.deleteScenario(user.companyId, propertyId, tipo);
  }
}
