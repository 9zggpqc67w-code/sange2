import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MAX_UPLOAD_BYTES } from './document-storage';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { DocumentsService } from './documents.service';

@ApiTags('documents')
@Controller('applicants/:applicantId/documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post()
  @ApiOperation({ summary: 'Upload a document (PDF, PNG or JPEG, max 10 MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' }, docType: { type: 'string' } },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  upload(
    @Param('applicantId', ParseUUIDPipe) applicantId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: UploadDocumentDto,
  ) {
    return this.documents.upload(applicantId, file, body.docType);
  }

  @Get()
  @ApiOperation({ summary: "List an applicant's documents with processing status" })
  list(@Param('applicantId', ParseUUIDPipe) applicantId: string) {
    return this.documents.list(applicantId);
  }
}
