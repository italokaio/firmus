import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PERMISSIONS } from "@leilao-erp/types";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";

/**
 * Garante que o catálogo global de permissões exista no banco a cada boot,
 * independente de o seed de desenvolvimento ter rodado. Idempotente.
 */
@Injectable()
export class PermissionsCatalogService implements OnModuleInit {
  private readonly logger = new Logger(PermissionsCatalogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const keys = Object.values(PERMISSIONS);
    for (const key of keys) {
      const [module] = key.split(":");
      await this.prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key, module: module ?? "geral" },
      });
    }
    this.logger.log(`Catálogo de permissões sincronizado (${keys.length} permissões)`);
  }
}
