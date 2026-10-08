import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApplicantsService } from './applicants.service';
import { CreateApplicantDto, UpdateGoalDto } from './dto/applicant.dto';

@ApiTags('applicants')
@Controller('applicants')
export class ApplicantsController {
  constructor(private readonly applicants: ApplicantsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an applicant' })
  create(@Body() dto: CreateApplicantDto) {
    return this.applicants.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an applicant with a compact document list' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.applicants.get(id);
  }

  @Put(':id/goal')
  @HttpCode(200)
  @ApiOperation({ summary: "Set the applicant's goal / target program" })
  updateGoal(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGoalDto) {
    return this.applicants.updateGoal(id, dto);
  }
}
