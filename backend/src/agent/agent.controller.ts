import { Controller, Get, HttpCode, Param, ParseBoolPipe, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AgentService } from './agent.service';

@ApiTags('agent')
@Controller('applicants/:applicantId/agent')
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  @Post('decide')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Choose the ONE best next action for the applicant',
    description:
      'Reads the applicant journey state, lets Claude choose among backend-validated candidates, validates the result (deterministic fallback if invalid or Claude is unavailable) ' +
      'and stores an AgentAction (plus a Clarification for questions). Returns the existing pending decision if the evaluation has not changed. Never changes applicant facts.',
  })
  @ApiQuery({ name: 'refresh', required: false, type: Boolean, description: 'Decide again even if a pending decision exists' })
  decide(
    @Param('applicantId', ParseUUIDPipe) applicantId: string,
    @Query('refresh', new ParseBoolPipe({ optional: true })) refresh?: boolean,
  ) {
    return this.agent.decide(applicantId, { refresh });
  }

  @Get('next-action')
  @ApiOperation({ summary: 'The current pending action (read-only; never calls the LLM)' })
  nextAction(@Param('applicantId', ParseUUIDPipe) applicantId: string) {
    return this.agent.nextAction(applicantId);
  }

  @Get('actions')
  @ApiOperation({ summary: 'Recent agent actions, newest first' })
  actions(@Param('applicantId', ParseUUIDPipe) applicantId: string) {
    return this.agent.history(applicantId);
  }
}
