import { Module } from "@nestjs/common";
import { AcquisitionModule } from "../acquisition/acquisition.module";
import { SimulatorController } from "./simulator.controller";
import { SimulatorService } from "./simulator.service";

@Module({
  imports: [AcquisitionModule],
  controllers: [SimulatorController],
  providers: [SimulatorService],
  exports: [SimulatorService],
})
export class SimulatorModule {}
