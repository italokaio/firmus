import { Module } from "@nestjs/common";
import { BrokersController } from "./brokers.controller";
import { SalesController } from "./sales.controller";
import { SalesPipelineController } from "./sales-pipeline.controller";
import { SalesService } from "./sales.service";

@Module({
  controllers: [BrokersController, SalesController, SalesPipelineController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
