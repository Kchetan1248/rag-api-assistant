import { Injectable, Logger } from '@nestjs/common';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

@Injectable()
export class ChunkerService {
  private readonly logger = new Logger(ChunkerService.name);

  /**
   * Splits a massive raw text string into smaller, overlapping chunks.
   * @param text The raw text to chunk
   * @param chunkSize Maximum characters per chunk
   * @param chunkOverlap Overlap between chunks to preserve context
   */
  async chunkText(text: string, chunkSize = 1000, chunkOverlap = 200): Promise<string[]> {
    this.logger.log(`Chunking text of length ${text.length} (Size: ${chunkSize}, Overlap: ${chunkOverlap})`);

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
      // It tries to split at paragraphs first, then sentences, then words, then characters
      separators: ["\n\n", "\n", " ", ""], 
    });

    const output = await splitter.createDocuments([text]);
    
    // We only need the raw string content for now
    const chunks = output.map((doc) => doc.pageContent);
    
    this.logger.debug(`Successfully created ${chunks.length} chunks.`);
    return chunks;
  }
}
