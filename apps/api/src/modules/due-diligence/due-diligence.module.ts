import { Module } from "@nestjs/common";
import { DueDiligenceController } from "./due-diligence.controller";
import { DueDiligenceService } from "./due-diligence.service";

@Module({
  controllers: [DueDiligenceController],
  providers: [DueDiligenceService],
  exports: [DueDiligenceService],
})
export class DueDiligenceModule {}
