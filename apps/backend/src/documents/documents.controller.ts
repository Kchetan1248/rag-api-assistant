import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as os from 'os';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
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
        if (!file.originalname.match(/\.(json|yaml|yml|md|pdf|csv|txt)$/i)) {
          return cb(new BadRequestException('Only documents are allowed!'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadFile(@Request() req, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    
    try {
      return await this.documentsService.processUploadedFile(file, req.user.userId);
    } catch (e) {
      throw new BadRequestException(e.message || 'Unknown error');
    }
  }

  @Get()
  async getDocuments(@Request() req) {
    return this.documentsService.getDocuments(req.user.userId);
  }

  @Delete(':id')
  async deleteDocument(@Request() req, @Param('id') id: string) {
    return this.documentsService.deleteDocument(id, req.user.userId);
  }
}
