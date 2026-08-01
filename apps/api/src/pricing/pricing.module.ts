import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';

@Module({
  controllers: [PricingController],
  providers: [PricingService],
  // Bookings will price themselves through this service rather than reading
  // rates out of the database again.
  exports: [PricingService],
})
export class PricingModule {}
