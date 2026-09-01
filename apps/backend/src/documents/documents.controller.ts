import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as os from 'os';
import { DocumentsService } from './documents.service';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: os.tmpdir(),
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        // Accept only specific API document formats
        if (!file.originalname.match(/\.(json|yaml|yml|md|pdf)$/)) {
          return cb(new BadRequestException('Only API documentation files are allowed!'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    
    // Pass the saved file details to the service for further processing
    try {
      return await this.documentsService.processUploadedFile(file);
    } catch (e) {
      throw new BadRequestException(e.message || 'Unknown error');
    }
  }

  @Get()
  async getDocuments() {
    return this.documentsService.getDocuments();
  }

  @Delete(':id')
  async deleteDocument(@Param('id') id: string) {
    return this.documentsService.deleteDocument(id);
  }
}
