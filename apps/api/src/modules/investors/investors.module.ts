import { Module } from "@nestjs/common";
import { FinanceModule } from "../finance/finance.module";
import { InvestorsController } from "./investors.controller";
import { PropertyInvestorsController } from "./property-investors.controller";
import { InvestorsService } from "./investors.service";

@Module({
  imports: [FinanceModule],
  controllers: [InvestorsController, PropertyInvestorsController],
  providers: [InvestorsService],
})
export class InvestorsModule {}
