import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { BOOKINGS_QUEUE, type BookingJobData } from './bookings.jobs';
import { BookingsService } from './bookings.service';

/**
 * A hold that outlives its window is worse than no hold: the room reads as taken
 * and the guest who asked for it never called back. This is what gives it back.
 */
@Processor(BOOKINGS_QUEUE)
export class BookingsProcessor extends WorkerHost {
  constructor(
    private readonly bookings: BookingsService,
    private readonly logger: PinoLogger,
  ) {
    super();
    logger.setContext(BookingsProcessor.name);
  }

  async process(job: Job<BookingJobData>): Promise<void> {
    switch (job.data.kind) {
      case 'release-expired-holds': {
        const released = await this.bookings.releaseExpiredHolds();
        if (released > 0) {
          this.logger.info({ released }, 'Released expired holds');
        }
        return;
      }
    }
  }
}
