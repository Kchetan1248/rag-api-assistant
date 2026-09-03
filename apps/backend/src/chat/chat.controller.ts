import { Controller, Post, Body, BadRequestException, Sse, Query, UseGuards, Request } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('search')
  async search(@Request() req: any, @Body('query') query: string) {
    if (!query) throw new BadRequestException('A search query is required.');
    
    // Returns the raw vector search results (an array of chunks) for the Vector Explorer tab
    const results = await this.chatService.semanticSearch(query, req.user.userId);
    return results;
  }

  @Sse('stream')
  streamSearch(
    @Request() req: any,
    @Query('query') query: string,
    @Query('conversationId') conversationId?: string,
    @Query('documentIds') documentIdsParam?: string
  ): Observable<{ data: string }> {
    if (!query) throw new BadRequestException('A search query is required.');

    const documentIds = documentIdsParam ? documentIdsParam.split(',') : undefined;

    return new Observable((subscriber) => {
      (async () => {
        try {
          const stream = this.chatService.streamAnswer(query, req.user.userId, conversationId, documentIds);
          for await (const chunk of stream) {
            // Wrap in JSON to safely transmit newlines over SSE
            subscriber.next({ data: JSON.stringify({ text: chunk }) } as any);
          }
          subscriber.complete();
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }
}
