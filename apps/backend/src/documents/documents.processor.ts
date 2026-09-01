import { Injectable, Logger } from '@nestjs/common';
import { DocumentParserService } from './parser/document-parser.service';
import { ChunkerService } from './chunker/chunker.service';
import { VectorizationService } from './vectorization/vectorization.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DocumentsProcessor {
  private readonly logger = new Logger(DocumentsProcessor.name);

  constructor(
    private readonly documentParserService: DocumentParserService,
    private readonly chunkerService: ChunkerService,
    private readonly vectorizationService: VectorizationService,
    private readonly prisma: PrismaService,
  ) {}

  async process(fileDetails: any): Promise<any> {
    this.logger.log(`Starting synchronous processing for document ${fileDetails.originalName}`);
    
    const document = await this.prisma.document.create({
      data: {
        title: fileDetails.originalName,
        content: '',
        type: fileDetails.originalName.split('.').pop().toUpperCase() || 'UNKNOWN',
        isIndexed: false,
      }
    });

    this.logger.debug(`Extracting text from: ${fileDetails.originalName}`);
    
    // 1. Parse the file into raw text
    const rawText = await this.documentParserService.parseFile(fileDetails.savedPath);
    this.logger.debug(`Successfully extracted ${rawText.length} characters of text.`);

    // 2. Chunk the text into smaller, overlapping segments
    const chunks = await this.chunkerService.chunkText(rawText, 1000, 200);

    // 3. Convert chunks into vectors using Ollama and store them in Qdrant
    // We use the Prisma document ID as the Qdrant documentId
    await this.vectorizationService.storeChunks(chunks, document.id);

    // Update document status
    await this.prisma.document.update({
      where: { id: document.id },
      data: { isIndexed: true },
    });

    this.logger.log(`Successfully completed processing for ${fileDetails.originalName}`);
    return { success: true, textLength: rawText.length, chunksCount: chunks.length, documentId: document.id };
  }
}
