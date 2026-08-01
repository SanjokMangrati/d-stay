import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../config/app-config';

/**
 * The Redis connection every queue shares. Global because a queue is registered
 * by the module that owns its jobs — media derivatives here, hold expiry and the
 * arrivals digest when those modules land — and none of them should have to know
 * how the connection is built.
 *
 * Processors currently run inside the API process. Splitting them into their own
 * entrypoint is a deployment change, not a code change, and is worth making when
 * a second queue exists to justify the second process.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        connection: { url: config.redisUrl },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2_000 },
          // Keep enough history to debug a bad image without the list growing
          // without bound.
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      }),
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
