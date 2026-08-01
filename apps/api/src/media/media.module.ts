import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Module, type OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import { MediaStorageService } from './media-storage.service';
import { MediaController } from './media.controller';
import {
  MEDIA_QUEUE,
  SWEEP_INTERVAL_MS,
  SWEEP_SCHEDULER_ID,
  type MediaJobData,
} from './media.jobs';
import { MediaProcessor } from './media.processor';
import { MediaService } from './media.service';

@Module({
  imports: [BullModule.registerQueue({ name: MEDIA_QUEUE })],
  controllers: [MediaController],
  providers: [MediaService, MediaStorageService, MediaProcessor],
  // The rooms list shows each room's cover, and photo URLs are this module's to
  // build.
  exports: [MediaService],
})
export class MediaModule implements OnApplicationBootstrap {
  constructor(
    @InjectQueue(MEDIA_QUEUE) private readonly queue: Queue<MediaJobData>,
  ) {}

  /**
   * Declared on boot rather than by an operator running something once: a
   * scheduler upsert is idempotent, so every deployment reasserts that the sweep
   * exists and how often it runs.
   */
  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      SWEEP_SCHEDULER_ID,
      { every: SWEEP_INTERVAL_MS },
      { name: 'sweep', data: { kind: 'sweep' } },
    );
  }
}
