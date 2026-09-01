import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { QdrantClient } from '@qdrant/js-client-rest';
import { ConfigService } from '@nestjs/config';

@Controller()
export class AppController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  @Get()
  getHello(): string {
    return 'Backend is running!';
  }

  @Get('health')
  async getHealth() {
    const health = {
      status: 'ok',
      postgres: 'checking...',
      qdrant: 'checking...',
      geminiKey: 'checking...',
      openAiKey: 'checking...',
      qdrantUrl: this.configService.get<string>('QDRANT_URL') || 'missing',
    };

    // 1. Check Postgres
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      health.postgres = 'connected';
    } catch (e) {
      health.postgres = `failed: ${e.message}`;
      health.status = 'error';
    }

    // 2. Check Qdrant
    try {
      const qdrantClient = new QdrantClient({ url: health.qdrantUrl });
      const collections = await qdrantClient.getCollections();
      health.qdrant = `connected (${collections.collections.length} collections)`;
    } catch (e) {
      health.qdrant = `failed: ${e.message}`;
      health.status = 'error';
    }

    // 3. Check Keys
    const openAiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (openAiKey) {
      health.openAiKey = `present (starts with ${openAiKey.substring(0, 4)}...)`;
    } else {
      health.openAiKey = 'MISSING';
    }

    if (geminiKey) {
      health.geminiKey = `present (starts with ${geminiKey.substring(0, 4)}...)`;
    } else {
      health.geminiKey = 'MISSING';
    }

    if (!openAiKey && !geminiKey) {
      health.status = 'error';
    }

    return health;
  }
}
