import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    // Connects lazily; the app can still boot if the DB is unavailable and
    // will connect on the first real query.
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
