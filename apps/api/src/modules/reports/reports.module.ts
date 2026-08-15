import { Module } from "@nestjs/common";
import { AcquisitionModule } from "../acquisition/acquisition.module";
import { LegalModule } from "../legal/legal.module";
import { FinanceModule } from "../finance/finance.module";
import { SimulatorModule } from "../simulator/simulator.module";
import { SalesModule } from "../sales/sales.module";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({
  imports: [AcquisitionModule, LegalModule, FinanceModule, SimulatorModule, SalesModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
