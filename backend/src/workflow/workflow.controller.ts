import { Controller, Get, HttpCode, Param, ParseBoolPipe, ParseIntPipe, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { EvaluationService } from './evaluation.service';
import { WorkflowService } from './workflow.service';

@ApiTags('workflow')
@Controller('applicants/:applicantId')
export class WorkflowController {
  constructor(private readonly workflow: WorkflowService) {}

  @Post('documents/:documentId/process')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Process one document, then re-evaluate the applicant',
    description:
      'Extracts grounded claims into a new document run, runs qualification, stores an evaluation snapshot and updates the journey stage. ' +
      'A processing failure is reported on the document (status FAILED + error) and leaves earlier evidence untouched.',
  })
  @ApiQuery({ name: 'force', required: false, type: Boolean, description: 'Re-process a document that is already DONE (creates a new run version)' })
  processDocument(
    @Param('applicantId', ParseUUIDPipe) applicantId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Query('force', new ParseBoolPipe({ optional: true })) force?: boolean,
  ) {
    return this.workflow.processDocument(applicantId, documentId, { force });
  }

  @Post('process')
  @HttpCode(200)
  @ApiOperation({ summary: 'Process all waiting (UPLOADED / FAILED) documents, then evaluate once' })
  processPending(@Param('applicantId', ParseUUIDPipe) applicantId: string) {
    return this.workflow.processPending(applicantId);
  }

  @Post('evaluate')
  @ApiOperation({ summary: 'Re-run qualification on the current evidence and store a new evaluation snapshot' })
  evaluate(@Param('applicantId', ParseUUIDPipe) applicantId: string) {
    return this.workflow.evaluate(applicantId);
  }
}

@ApiTags('evaluations')
@Controller('applicants/:applicantId/evaluations')
export class EvaluationsController {
  constructor(private readonly evaluations: EvaluationService) {}

  @Get()
  @ApiOperation({ summary: 'Evaluation history (newest first, summaries only)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async list(
    @Param('applicantId', ParseUUIDPipe) applicantId: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.evaluations.history(applicantId, Math.min(Math.max(limit ?? 20, 1), 100));
  }

  // Must stay above ':evaluationId' so "latest" is not parsed as an id.
  @Get('latest')
  @ApiOperation({ summary: 'The latest full evaluation snapshot' })
  latest(@Param('applicantId', ParseUUIDPipe) applicantId: string) {
    return this.evaluations.latestOrThrow(applicantId);
  }

  @Get(':evaluationId')
  @ApiOperation({ summary: 'One full evaluation snapshot: fields, gaps, requirements, readiness and inputs' })
  get(
    @Param('applicantId', ParseUUIDPipe) applicantId: string,
    @Param('evaluationId', ParseUUIDPipe) evaluationId: string,
  ) {
    return this.evaluations.get(applicantId, evaluationId);
  }

  @Get(':evaluationId/replay')
  @ApiOperation({ summary: 'Recompute a stored evaluation from its recorded inputs and check it reproduces' })
  replay(
    @Param('applicantId', ParseUUIDPipe) applicantId: string,
    @Param('evaluationId', ParseUUIDPipe) evaluationId: string,
  ) {
    return this.evaluations.replay(applicantId, evaluationId);
  }
}
