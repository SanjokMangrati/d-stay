import { Module } from '@nestjs/common';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';

@Module({
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
  // Bookings write their stays through this service, so that the one translation
  // of the exclusion constraint into `BOOKING_CONFLICT` covers both write paths.
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
