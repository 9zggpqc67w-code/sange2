import { Module } from '@nestjs/common';
import { IngestionModule } from '../ingestion/ingestion.module';
import { EvaluationService } from './evaluation.service';
import { EvaluationsController, WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';

@Module({
  imports: [IngestionModule],
  controllers: [WorkflowController, EvaluationsController],
  providers: [EvaluationService, WorkflowService],
  exports: [EvaluationService, WorkflowService],
})
export class WorkflowModule {}
