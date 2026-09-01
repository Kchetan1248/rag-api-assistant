import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentsProcessor } from './documents.processor';
import { DocumentParserService } from './parser/document-parser.service';
import { ChunkerService } from './chunker/chunker.service';
import { VectorizationService } from './vectorization/vectorization.service';

@Module({
  imports: [],
  controllers: [DocumentsController],
  providers: [
    DocumentsService, 
    DocumentsProcessor, 
    DocumentParserService, 
    ChunkerService,
    VectorizationService
  ],
})
export class DocumentsModule {}
