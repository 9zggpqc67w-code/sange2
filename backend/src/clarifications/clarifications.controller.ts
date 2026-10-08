import { Body, Controller, Get, Param, ParseEnumPipe, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiPropertyOptional, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ClarificationStatus } from '../generated/prisma/enums';
import { ClarificationsService } from './clarifications.service';

export class AnswerClarificationDto {
  @ApiPropertyOptional({ example: '2025' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  text?: string;

  @ApiPropertyOptional({ description: 'Any JSON value, e.g. a number or an object' })
  @IsOptional()
  value?: unknown;

  @ApiPropertyOptional({ description: 'The option the applicant picked, e.g. a conflict option' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  choice?: string;
}

@ApiTags('clarifications')
@Controller('applicants/:applicantId/clarifications')
export class ClarificationsController {
  constructor(private readonly clarifications: ClarificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Questions asked of the applicant and their answers (newest first)' })
  @ApiQuery({ name: 'status', required: false, enum: ClarificationStatus })
  list(
    @Param('applicantId', ParseUUIDPipe) applicantId: string,
    @Query('status', new ParseEnumPipe(ClarificationStatus, { optional: true })) status?: ClarificationStatus,
  ) {
    return this.clarifications.list(applicantId, status);
  }

  @Get(':clarificationId')
  @ApiOperation({ summary: 'One clarification' })
  get(
    @Param('applicantId', ParseUUIDPipe) applicantId: string,
    @Param('clarificationId', ParseUUIDPipe) clarificationId: string,
  ) {
    return this.clarifications.get(applicantId, clarificationId);
  }

  @Post(':clarificationId/answer')
  @ApiOperation({
    summary: 'Record the applicant’s answer',
    description:
      'Persists the answer and marks the clarification ANSWERED. For a conflict clarification the answer must be one of the existing options (by value, choice or text); ' +
      'it is recorded as an additional applicant resolution claim and the applicant is re-evaluated (see `resolution` in the response). The document claims are never changed.',
  })
  answer(
    @Param('applicantId', ParseUUIDPipe) applicantId: string,
    @Param('clarificationId', ParseUUIDPipe) clarificationId: string,
    @Body() dto: AnswerClarificationDto,
  ) {
    return this.clarifications.answer(applicantId, clarificationId, dto);
  }
}
