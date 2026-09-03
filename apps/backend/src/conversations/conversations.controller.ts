import { Controller, Get, Post, Body, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  async getConversations(@Request() req) {
    return this.conversationsService.getConversations(req.user.userId);
  }

  @Post()
  async createConversation(@Request() req, @Body('title') title?: string) {
    return this.conversationsService.createConversation(title, req.user.userId);
  }

  @Get(':id')
  async getConversation(@Request() req, @Param('id') id: string) {
    return this.conversationsService.getConversationWithMessages(id, req.user.userId);
  }

  @Delete(':id')
  async deleteConversation(@Request() req, @Param('id') id: string) {
    return this.conversationsService.deleteConversation(id, req.user.userId);
  }
}
