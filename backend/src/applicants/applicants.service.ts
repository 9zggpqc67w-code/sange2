import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApplicantDto, UpdateGoalDto } from './dto/applicant.dto';

@Injectable()
export class ApplicantsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateApplicantDto) {
    return this.prisma.applicant.create({
      data: { name: dto.name.trim(), email: dto.email, goal: dto.goal, programLabel: dto.programLabel },
    });
  }

  /** Applicant plus a compact document list; later stages extend this into the full journey view. */
  async get(id: string) {
    const applicant = await this.prisma.applicant.findUnique({
      where: { id },
      include: {
        documents: {
          select: { id: true, filename: true, docType: true, status: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!applicant) throw new NotFoundException(`Applicant ${id} not found`);
    return applicant;
  }

  /** Throws 404 if the applicant does not exist; used by other modules. */
  async assertExists(id: string): Promise<void> {
    const found = await this.prisma.applicant.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundException(`Applicant ${id} not found`);
  }

  async updateGoal(id: string, dto: UpdateGoalDto) {
    await this.assertExists(id);
    return this.prisma.applicant.update({
      where: { id },
      data: { goal: dto.goal, ...(dto.programLabel !== undefined && { programLabel: dto.programLabel }) },
    });
  }
}
