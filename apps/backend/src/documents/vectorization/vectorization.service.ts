import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIEmbeddings } from '@langchain/openai';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { QdrantVectorStore } from '@langchain/qdrant';
import { QdrantClient } from '@qdrant/js-client-rest';

@Injectable()
export class VectorizationService {
  private readonly logger = new Logger(VectorizationService.name);
  private embeddings: OpenAIEmbeddings | GoogleGenerativeAIEmbeddings;
  private qdrantUrl: string;
  private qdrantClient: QdrantClient;

  constructor(private configService: ConfigService) {
    this.qdrantUrl = this.configService.get<string>('QDRANT_URL')!;
    
    const openaiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (openaiKey) {
      this.logger.log('Using OpenAI Embeddings');
      this.embeddings = new OpenAIEmbeddings({
        modelName: "text-embedding-3-small",
        openAIApiKey: openaiKey,
      });
    } else if (geminiKey) {
      this.logger.log('Using Google Gemini Embeddings');
      this.embeddings = new GoogleGenerativeAIEmbeddings({
        model: "gemini-embedding-2",
        apiKey: geminiKey,
      });
    } else {
      throw new Error('No embedding API key provided. Please set OPENAI_API_KEY or GEMINI_API_KEY.');
    }

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
