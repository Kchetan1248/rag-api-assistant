import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { ConversationsService } from './conversations.service';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  async getConversations() {
    return this.conversationsService.getConversations();
  }

  @Post()
  async createConversation(@Body('title') title?: string) {
    return this.conversationsService.createConversation(title);
  }

  @Get(':id')
  async getConversation(@Param('id') id: string) {
    return this.conversationsService.getConversationWithMessages(id);
  }

  @Delete(':id')
  async deleteConversation(@Param('id') id: string) {
    return this.conversationsService.deleteConversation(id);
  }
}
