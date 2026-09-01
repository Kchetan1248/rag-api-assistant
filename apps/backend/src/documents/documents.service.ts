import { Injectable, Logger } from '@nestjs/common';
import { DocumentsProcessor } from './documents.processor';
import { PrismaService } from '../prisma/prisma.service';
import { VectorizationService } from './vectorization/vectorization.service';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly documentsProcessor: DocumentsProcessor,
    private readonly prisma: PrismaService,
    private readonly vectorizationService: VectorizationService,
  ) {}

  async processUploadedFile(file: Express.Multer.File) {
    const fileDetails = {
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      savedPath: file.path,
    };

    // Process the document synchronously
    const result = await this.documentsProcessor.process(fileDetails);

    this.logger.log(`Processed file ${fileDetails.originalName} synchronously`);

    return {
      message: 'File uploaded and processed successfully',
      fileDetails,
      status: 'PROCESSED',
      details: result
    };
  }

  async getDocuments() {
    return this.prisma.document.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteDocument(id: string) {
    // 1. Delete vectors from Qdrant
    await this.vectorizationService.deleteDocumentVectors(id);
    
    // 2. Delete from PostgreSQL
    await this.prisma.document.delete({
      where: { id },
    });

    this.logger.log(`Deleted document ${id} successfully`);
    return { success: true };
  }
}
