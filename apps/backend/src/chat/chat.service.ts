import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { QdrantVectorStore } from '@langchain/qdrant';
import { PromptTemplate } from '@langchain/core/prompts';
import { ConversationsService } from '../conversations/conversations.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private embeddings: OpenAIEmbeddings | GoogleGenerativeAIEmbeddings;
  private llm: ChatOpenAI;
  private qdrantUrl: string;

  constructor(
    private configService: ConfigService,
    private conversationsService: ConversationsService
  ) {
    this.qdrantUrl = this.configService.get<string>('QDRANT_URL')!;
    
    // We use the EXACT same embedding model as the ingestion phase.
    // The query must be translated using the same mathematical vocabulary as the documents.
    const openaiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (openaiKey) {
      this.embeddings = new OpenAIEmbeddings({
        modelName: 'text-embedding-3-small',
        openAIApiKey: openaiKey,
      });
    } else if (geminiKey) {
      this.embeddings = new GoogleGenerativeAIEmbeddings({
        model: 'gemini-embedding-2',
        apiKey: geminiKey,
      });
    } else {
      throw new Error('No embedding API key provided.');
    }

    // Configure the specific language model we want to use for generating the final response.
    // We are using Sarvam AI's API via OpenAI-compatible endpoints!
    this.llm = new ChatOpenAI({
      modelName: 'sarvam-105b',
      temperature: 0.2, // Keep it low (0.2) to prevent the model from "hallucinating"
      apiKey: this.configService.get<string>('SARVAM_API_KEY') || 'missing_key',
      configuration: {
        baseURL: 'https://api.sarvam.ai/v1',
        defaultHeaders: {
          'api-subscription-key': this.configService.get<string>('SARVAM_API_KEY'),
        }
      }
    });
  }

  /**
   * Performs a Semantic Similarity Search against Qdrant
   */
  async semanticSearch(query: string, documentIds?: string[]) {
    this.logger.log(`Performing semantic search for: "${query}"${documentIds ? ` [Filtered by ${documentIds.length} docs]` : ''}`);

    try {
      // Connect to our existing Qdrant collection
      const vectorStore = await QdrantVectorStore.fromExistingCollection(
        this.embeddings,
        {
          url: this.qdrantUrl,
          collectionName: "api_documents",
        }
      );

      let filter = undefined;
      if (documentIds && documentIds.length > 0) {
        filter = {
          must: [
            {
              key: 'metadata.documentId',
              match: {
                any: documentIds
              }
            }
          ]
        };
      }

      // Search for the top 3 most similar chunks of text
      const searchResults = await vectorStore.similaritySearch(query, 3, filter);
      
      this.logger.log(`Found ${searchResults.length} matching chunks in the database.`);
      
      // Clean up the output to send back to the controller
      return searchResults.map((result) => ({
        content: result.pageContent,
        metadata: result.metadata, // Contains our documentId!
      }));
    } catch (error) {
      this.logger.error(`Search failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Complete RAG Pipeline: Retrieves documents AND generates an answer
   */
  async generateAnswer(query: string, documentIds?: string[]) {
    // 1. Retrieve the context (The 'R' in RAG)
    const contextDocs = await this.semanticSearch(query, documentIds);
    
    if (contextDocs.length === 0) {
      return { answer: "I'm sorry, I couldn't find any documentation related to your question.", sources: [] };
    }

    // Combine all retrieved chunks into a single text block
    const contextString = contextDocs.map(doc => doc.content).join('\n\n---\n\n');

    // 2. Build the Prompt
    const promptTemplate = PromptTemplate.fromTemplate(`
      You are an expert Enterprise API Support Engineer.
      Use the following context from our API documentation to answer the user's question accurately.
      If the answer is not contained in the context, say "I don't have enough information in the documentation to answer this." Do not make up information.
      
      CONTEXT:
      {context}
      
      USER QUESTION:
      {question}
      
      ANSWER:
    `);

    const formattedPrompt = await promptTemplate.format({
      context: contextString,
      question: query,
    });

    this.logger.log('Sending prompt to LLM...');

    // 3. Generate the Answer (The 'G' in RAG)
    const response = await this.llm.invoke(formattedPrompt);

    return {
      answer: response.content,
      sources: contextDocs.map(doc => doc.metadata.documentId), // Provide source citations!
    };
  }

  /**
   * Streams the answer back token-by-token for a ChatGPT-like experience
   */
  async *streamAnswer(query: string, conversationId?: string, documentIds?: string[]): AsyncGenerator<string, void, unknown> {
    const contextDocs = await this.semanticSearch(query, documentIds);
    
    if (contextDocs.length === 0) {
      yield "I'm sorry, I couldn't find any documentation related to your question.";
      return;
    }

    const contextString = contextDocs.map(doc => doc.content).join('\n\n---\n\n');

    let historyString = "No previous history.";
    if (conversationId) {
      const convo = await this.conversationsService.getConversationWithMessages(conversationId);
      if (convo && convo.messages.length > 0) {
        historyString = convo.messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
      }
    }

    const promptTemplate = PromptTemplate.fromTemplate(`
      You are an expert Enterprise API Support Engineer.
      Use the following context to answer the user's question.
      
      CONTEXT:
      {context}
      
      PREVIOUS CONVERSATION HISTORY:
      {history}
      
      QUESTION:
      {question}
      
      ANSWER:
    `);

    const formattedPrompt = await promptTemplate.format({
      context: contextString,
      history: historyString,
      question: query,
    });

    const sources = contextDocs.map(doc => doc.metadata.documentId || doc.metadata.source || 'Unknown');
    const sourcesJson = JSON.stringify({ sources });
    yield `[SOURCES]${sourcesJson}[/SOURCES]`;

    const stream = await this.llm.stream(formattedPrompt);
    let fullAnswer = "";

    for await (const chunk of stream) {
      fullAnswer += chunk.content as string;
      yield chunk.content as string;
    }

    if (conversationId) {
      // Background save without blocking the generator end
      this.conversationsService.addMessage(conversationId, 'user', query, []).then(() => {
        this.conversationsService.addMessage(conversationId, 'ai', fullAnswer, sources);
      }).catch(err => this.logger.error('Failed to save messages', err));
    }
  }
}
