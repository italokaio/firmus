import { Controller, Get } from "@nestjs/common";
import { PERMISSIONS, type AuthenticatedUser } from "@leilao-erp/types";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RenovationService } from "./renovation.service";

/** Kanban global de reforma — todos os imóveis da empresa, sem filtro. */
@Controller("renovation")
export class RenovationBoardController {
  constructor(private readonly renovationService: RenovationService) {}

  @Get("board")
  @RequirePermission(PERMISSIONS.RENOVATION_VIEW)
  board(@CurrentUser() user: AuthenticatedUser) {
    return this.renovationService.listBoard(user.companyId);
  }
}
