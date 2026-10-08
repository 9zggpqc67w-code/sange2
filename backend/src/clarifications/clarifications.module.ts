import { Module } from '@nestjs/common';
import { WorkflowModule } from '../workflow/workflow.module';
import { ClarificationsController } from './clarifications.controller';
import { ClarificationsService } from './clarifications.service';

@Module({
  imports: [WorkflowModule],
  controllers: [ClarificationsController],
  providers: [ClarificationsService],
  exports: [ClarificationsService],
})
export class ClarificationsModule {}
