import { Controller, Get, Param, ParseEnumPipe, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JourneyService } from './journey.service';

@ApiTags('journey')
@Controller('applicants/:applicantId')
export class JourneyController {
  constructor(private readonly journey: JourneyService) {}

  @Get('journey')
  @ApiOperation({
    summary: 'The complete current applicant state (read model)',
    description:
      'Applicant, stage, documents, profile fields with evidence, latest evaluation (readiness, requirements), gaps, conflicts, ' +
      'recent evaluation history and clarifications. Assembled from the database; no document is re-read.',
  })
  get(@Param('applicantId', ParseUUIDPipe) applicantId: string) {
    return this.journey.get(applicantId);
  }

  @Get('gaps')
  @ApiOperation({ summary: 'Current gaps and conflicts (from the latest evaluation)' })
  gaps(@Param('applicantId', ParseUUIDPipe) applicantId: string) {
    return this.journey.gaps(applicantId);
  }

  @Get('claims')
  @ApiOperation({ summary: 'Evidence claims with provenance; scope=all includes superseded runs (history)' })
  @ApiQuery({ name: 'scope', required: false, enum: ['active', 'all'] })
  claims(
    @Param('applicantId', ParseUUIDPipe) applicantId: string,
    @Query('scope', new ParseEnumPipe(['active', 'all'], { optional: true })) scope?: 'active' | 'all',
  ) {
    return this.journey.claims(applicantId, scope);
  }
}
