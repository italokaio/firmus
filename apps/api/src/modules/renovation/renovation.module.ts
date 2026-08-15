import { Module } from "@nestjs/common";
import { RenovationController } from "./renovation.controller";
import { RenovationBoardController } from "./renovation-board.controller";
import { RenovationService } from "./renovation.service";

@Module({
  controllers: [RenovationController, RenovationBoardController],
  providers: [RenovationService],
  exports: [RenovationService],
})
export class RenovationModule {}
