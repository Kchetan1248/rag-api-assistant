import { Controller, Post, Body, BadRequestException, Sse, Query } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('search')
  async search(@Body('query') query: string) {
    if (!query) throw new BadRequestException('A search query is required.');
    
    // Returns the raw vector search results (an array of chunks) for the Vector Explorer tab
    const results = await this.chatService.semanticSearch(query);
    return results;
  }

  @Sse('stream')
  streamSearch(
    @Query('query') query: string,
    @Query('conversationId') conversationId?: string,
    @Query('documentIds') documentIdsParam?: string
  ): Observable<{ data: string }> {
    if (!query) throw new BadRequestException('A search query is required.');

    const documentIds = documentIdsParam ? documentIdsParam.split(',') : undefined;

    return new Observable((subscriber) => {
      (async () => {
        try {
          const stream = this.chatService.streamAnswer(query, conversationId, documentIds);
          for await (const chunk of stream) {
            // SSE standard requires the payload to be under a 'data' key
            subscriber.next({ data: chunk });
          }
          subscriber.complete();
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }
}
