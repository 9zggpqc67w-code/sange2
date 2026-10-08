import { Controller, Get, Param, ParseEnumPipe, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IngestionService } from './ingestion.service';

// Processing itself is triggered through the workflow (POST .../process), which also
// re-evaluates the applicant. This controller only reads ingestion results.
@ApiTags('ingestion')
@Controller('applicants/:applicantId/documents/:documentId')
export class IngestionController {
  constructor(private readonly ingestion: IngestionService) {}

  @Get('claims')
  @ApiOperation({ summary: 'Claims extracted from this document, with page and quote provenance' })
  @ApiQuery({ name: 'scope', required: false, enum: ['active', 'all'], description: 'active (default) = current run only; all = every run' })
  claims(
    @Param('applicantId', ParseUUIDPipe) applicantId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Query('scope', new ParseEnumPipe(['active', 'all'], { optional: true })) scope?: 'active' | 'all',
  ) {
    return this.ingestion.listClaims(applicantId, documentId, scope);
  }

  @Get('runs')
  @ApiOperation({ summary: 'Processing history of this document (one entry per run, newest first)' })
  runs(
    @Param('applicantId', ParseUUIDPipe) applicantId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.ingestion.listRuns(applicantId, documentId);
  }
}
