import { Module } from '@nestjs/common';
import { WorkflowModule } from '../workflow/workflow.module';
import { JourneyController } from './journey.controller';
import { JourneyService } from './journey.service';

@Module({
  imports: [WorkflowModule],
  controllers: [JourneyController],
  providers: [JourneyService],
  exports: [JourneyService],
})
export class JourneyModule {}
