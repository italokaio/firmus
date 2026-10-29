import { Module } from "@nestjs/common";
import { FinanceController } from "./finance.controller";
import { PropertyFinanceController } from "./property-finance.controller";
import { FinanceService } from "./finance.service";
import { PropertyStatementService } from "./property-statement.service";

@Module({
  controllers: [FinanceController, PropertyFinanceController],
  providers: [FinanceService, PropertyStatementService],
  exports: [FinanceService, PropertyStatementService],
})
export class FinanceModule {}
