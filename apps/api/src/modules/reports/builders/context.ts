import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import type { AcquisitionService } from "../../acquisition/acquisition.service";
import type { DashboardService } from "../../dashboard/dashboard.service";
import type { FinanceService } from "../../finance/finance.service";
import type { PropertyStatementService } from "../../finance/property-statement.service";
import type { LegalService } from "../../legal/legal.service";
import type { SalesService } from "../../sales/sales.service";
import type { SimulatorService } from "../../simulator/simulator.service";

/** Tudo que um construtor de relatório precisa: serviços de leitura + quem gerou e quando. */
export interface ReportContext {
  prisma: PrismaService;
  financeService: FinanceService;
  statementService: PropertyStatementService;
  dashboardService: DashboardService;
  acquisitionService: AcquisitionService;
  legalService: LegalService;
  simulatorService: SimulatorService;
  salesService: SalesService;
  companyId: string;
  generatedBy: string;
  generatedAt: Date;
}
