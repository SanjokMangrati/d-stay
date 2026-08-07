import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { PROPERTY_ID_PARAM } from '../auth/property-access.guard';
import { CreateRateOverrideDto, PricingDto } from './pricing.schema';
import { PricingService } from './pricing.service';

/**
 * Seasons — prices that belong to dates — and the read model the calendar
 * resolves every cell from. A room's standing rate is a fact about the room and
 * is edited through the rooms module; the meal charge is a fact about the
 * property and is edited through that. There is one place to set each.
 *
 * Every route answers with the whole configuration, because that is what the
 * calendar re-renders from the moment a season changes.
 */
@ApiTags('pricing')
@Controller(`properties/:${PROPERTY_ID_PARAM}/pricing`)
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get()
  @ZodResponse({ status: 200, type: PricingDto })
  find(@Param(PROPERTY_ID_PARAM) propertyId: string): Promise<PricingDto> {
    return this.pricing.forProperty(propertyId);
  }

  @Post('overrides')
  @ZodResponse({ status: 201, type: PricingDto })
  createOverride(
    @Param(PROPERTY_ID_PARAM) propertyId: string,
    @Body() body: CreateRateOverrideDto,
  ): Promise<PricingDto> {
    return this.pricing.createOverride(propertyId, body);
  }

  @Delete('overrides/:overrideId')
  @ZodResponse({ status: 200, type: PricingDto })
  removeOverride(
    @Param(PROPERTY_ID_PARAM) propertyId: string,
    @Param('overrideId') overrideId: string,
  ): Promise<PricingDto> {
    return this.pricing.removeOverride(propertyId, overrideId);
  }
}
