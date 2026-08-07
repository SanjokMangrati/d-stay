import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Module, type OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AvailabilityModule } from '../availability/availability.module';
import { BookingsController } from './bookings.controller';
import {
  BOOKINGS_QUEUE,
  RELEASE_HOLDS_INTERVAL_MS,
  RELEASE_HOLDS_SCHEDULER_ID,
  type BookingJobData,
} from './bookings.jobs';
import { BookingsProcessor } from './bookings.processor';
import { BookingsService } from './bookings.service';

@Module({
  // Bookings hold rooms, and what "held" means is the availability module's to
  // answer — including which rooms are in the way when a write is refused.
  imports: [
    AvailabilityModule,
    BullModule.registerQueue({ name: BOOKINGS_QUEUE }),
  ],
  controllers: [BookingsController],
  providers: [BookingsService, BookingsProcessor],
})
export class BookingsModule implements OnApplicationBootstrap {
  constructor(
    @InjectQueue(BOOKINGS_QUEUE) private readonly queue: Queue<BookingJobData>,
  ) {}

  /** Idempotent, so every deployment reasserts that holds are still swept. */
  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      RELEASE_HOLDS_SCHEDULER_ID,
      { every: RELEASE_HOLDS_INTERVAL_MS },
      {
        name: 'release-expired-holds',
        data: { kind: 'release-expired-holds' },
      },
    );
  }
}
