import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConversationsService {
  constructor(private prisma: PrismaService) {}

  async createConversation(title: string = 'New Chat') {
    return this.prisma.conversation.create({
      data: { title },
    });
  }

  async getConversations() {
    return this.prisma.conversation.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
  }

  async getConversationWithMessages(id: string) {
    return this.prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
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

  async deleteConversation(id: string) {
    return this.prisma.conversation.delete({
      where: { id },
    });
  }
}
