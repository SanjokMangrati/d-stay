import { PrismaPg } from '@prisma/adapter-pg';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';
import { AppConfig } from '../config/app-config';

/**
 * The database handle, injected into services directly. There is no repository
 * layer and no `BaseService` over this — Prisma is already the abstraction, and
 * a second one would only hide the query shapes that matter.
 *
 * Nothing connects on boot: Prisma opens the pool on first query. That is what
 * lets `pnpm codegen` build the whole Nest application to read its routes
 * without a database anywhere near it.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: AppConfig) {
    super({ adapter: new PrismaPg({ connectionString: config.databaseUrl }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
