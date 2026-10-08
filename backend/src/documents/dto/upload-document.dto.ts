import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { DocType } from '../../generated/prisma/enums';

export class UploadDocumentDto {
  @ApiPropertyOptional({
    enum: DocType,
    description: 'Optional hint. When omitted the type is UNKNOWN and is classified during processing.',
  })
  @IsOptional()
  @IsEnum(DocType)
  docType?: DocType;
}
