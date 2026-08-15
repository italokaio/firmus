import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { FinanceService } from "../finance/finance.service";

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeService: FinanceService,
  ) {}

  async getSummary(companyId: string) {
    const [usersCount, rolesCount, propertiesCount, propertiesByStatus, propertiesByPriority, financeSummary] =
      await Promise.all([
        this.prisma.user.count({ where: { companyId, active: true } }),
        this.prisma.role.count({ where: { companyId } }),
        this.prisma.property.count({ where: { companyId } }),
        this.prisma.property.groupBy({
          by: ["status"],
          where: { companyId },
          _count: true,
        }),
        this.prisma.property.groupBy({
          by: ["prioridade"],
          where: { companyId },
          _count: true,
        }),
        this.financeService.getSummary(companyId),
      ]);

    return {
      usersCount,
      rolesCount,
      propertiesCount,
      propertiesByStatus: propertiesByStatus.map((row) => ({
        status: row.status,
        count: row._count,
      })),
      propertiesByPriority: propertiesByPriority.map((row) => ({
        prioridade: row.prioridade,
        count: row._count,
      })),
      finance: financeSummary,
    };
  }
}
