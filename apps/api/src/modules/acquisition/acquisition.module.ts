import { Module } from "@nestjs/common";
import { DueDiligenceModule } from "../due-diligence/due-diligence.module";
import { AcquisitionController } from "./acquisition.controller";
import { AcquisitionService } from "./acquisition.service";

@Module({
  imports: [DueDiligenceModule],
  controllers: [AcquisitionController],
  providers: [AcquisitionService],
  exports: [AcquisitionService],
})
export class AcquisitionModule {}
