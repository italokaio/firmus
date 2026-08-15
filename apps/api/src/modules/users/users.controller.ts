import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, UsePipes } from "@nestjs/common";
import {
  PERMISSIONS,
  createUserSchema,
  updateUserSchema,
  type AuthenticatedUser,
  type CreateUserInput,
  type UpdateUserInput,
} from "@leilao-erp/types";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermission(PERMISSIONS.USERS_VIEW)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.list(user.companyId);
  }

  @Get(":id")
  @RequirePermission(PERMISSIONS.USERS_VIEW)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.usersService.findById(user.companyId, id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.USERS_CREATE)
  @UsePipes(new ZodValidationPipe(createUserSchema))
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateUserInput) {
    return this.usersService.create(user.companyId, body);
  }

  @Patch(":id")
  @RequirePermission(PERMISSIONS.USERS_EDIT)
  @UsePipes(new ZodValidationPipe(updateUserSchema))
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: UpdateUserInput,
  ) {
    return this.usersService.update(user.companyId, id, body);
  }

  /** Desliga o 2FA de outro usuário — ação de administrador (ver seção de segurança do manual). */
  @Post(":id/2fa/disable")
  @RequirePermission(PERMISSIONS.USERS_EDIT)
  @HttpCode(HttpStatus.NO_CONTENT)
  async adminDisableTwoFactor(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<void> {
    await this.usersService.adminDisableTwoFactor(user.companyId, id);
  }
}
