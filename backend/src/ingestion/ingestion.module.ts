import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { DocumentReader } from './document-reader';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [LlmModule],
  controllers: [IngestionController],
  providers: [DocumentReader, IngestionService],
  exports: [IngestionService],
})
export class IngestionModule {}
