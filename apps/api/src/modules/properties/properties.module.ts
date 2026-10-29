import { Module } from "@nestjs/common";
import { PropertiesController } from "./properties.controller";
import { PropertiesService } from "./properties.service";
import { PropertyCancellationService } from "./property-cancellation.service";

@Module({
  controllers: [PropertiesController],
  providers: [PropertiesService, PropertyCancellationService],
  exports: [PropertiesService],
})
export class PropertiesModule {}
