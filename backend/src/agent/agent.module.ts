import { Module } from '@nestjs/common';
import { ClarificationsModule } from '../clarifications/clarifications.module';
import { JourneyModule } from '../journey/journey.module';
import { LlmModule } from '../llm/llm.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';

@Module({
  imports: [JourneyModule, ClarificationsModule, LlmModule],
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
