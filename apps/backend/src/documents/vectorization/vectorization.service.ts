import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OllamaEmbeddings } from '@langchain/ollama';
import { QdrantVectorStore } from '@langchain/qdrant';
import { QdrantClient } from '@qdrant/js-client-rest';

@Injectable()
export class VectorizationService {
  private readonly logger = new Logger(VectorizationService.name);
  private embeddings: OllamaEmbeddings;
  private qdrantUrl: string;
  private qdrantClient: QdrantClient;

  constructor(private configService: ConfigService) {
    this.qdrantUrl = this.configService.get<string>('QDRANT_URL')!;
    
    // Connect to local Ollama instance for FREE embedding generation (or remote if deployed)
    this.embeddings = new OllamaEmbeddings({
      model: "nomic-embed-text",
      baseUrl: process.env.OLLAMA_URL || "http://localhost:11434",
    });

    this.qdrantClient = new QdrantClient({ url: this.qdrantUrl });
  }

  /**
   * Converts text chunks to vectors and stores them in Qdrant
   */
  async storeChunks(chunks: string[], documentId: string): Promise<void> {
    this.logger.log(`Generating embeddings for ${chunks.length} chunks...`);

    // Prepare metadata so we know which chunk belongs to which document
    const metadatas = chunks.map((_, index) => ({
      documentId,
      chunkIndex: index,
    }));

    try {
      // LangChain handles connecting to Qdrant, generating embeddings via Ollama, 
      // and storing both the text and the vectors in one command!
      await QdrantVectorStore.fromTexts(
        chunks,
        metadatas,
        this.embeddings,
        {
          url: this.qdrantUrl,
          collectionName: "api_documents", // The "table" name in Qdrant
        }
      );
      this.logger.log(`Successfully stored ${chunks.length} vectors in Qdrant!`);
    } catch (error) {
      this.logger.error(`Failed to store vectors in Qdrant: ${error.message}`);
      throw error;
    }
  }

  /**
   * Deletes all vector chunks associated with a specific documentId
   */
  async deleteDocumentVectors(documentId: string): Promise<void> {
    this.logger.log(`Deleting all vectors for document ID: ${documentId}`);
    try {
      await this.qdrantClient.delete('api_documents', {
        filter: {
          must: [
            {
              key: 'documentId',
              match: {
                value: documentId,
              },
            },
          ],
        },
      });
      this.logger.log(`Successfully deleted vectors for document ${documentId}`);
    } catch (error) {
      this.logger.error(`Failed to delete vectors for document ${documentId}: ${error.message}`);
      throw error;
    }
  }
}
