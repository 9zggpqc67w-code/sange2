import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentModule } from './agent/agent.module';
import { ApplicantsModule } from './applicants/applicants.module';
import { ClarificationsModule } from './clarifications/clarifications.module';
import { validateEnv } from './config/env.validation';
import { DocumentsModule } from './documents/documents.module';
import { HealthModule } from './health/health.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { JourneyModule } from './journey/journey.module';
import { PrismaModule } from './prisma/prisma.module';
import { WorkflowModule } from './workflow/workflow.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    HealthModule,
    ApplicantsModule,
    DocumentsModule,
    IngestionModule,
    WorkflowModule,
    ClarificationsModule,
    JourneyModule,
    AgentModule,
  ],
})
export class AppModule {}
