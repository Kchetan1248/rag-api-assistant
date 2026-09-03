import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConversationsService {
  constructor(private prisma: PrismaService) {}

  async createConversation(title: string = 'New Chat', userId: string) {
    return this.prisma.conversation.create({
      data: { title, userId },
    });
  }

  async getConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
  }

  async getConversationWithMessages(id: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  async addMessage(conversationId: string, role: string, content: string, sources: string[] = []) {
    return this.prisma.message.create({
      data: {
        conversationId,
        role,
        content,
        sources,
      },
    });
  }

  async deleteConversation(id: string, userId: string) {
    return this.prisma.conversation.delete({
      where: { id, userId },
    });
  }
}
