import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { PROPERTY_ID_PARAM } from '../auth/property-access.guard';
import {
  CreateRateOverrideDto,
  PricingDto,
  UpdateMealChargeDto,
  UpdateRoomRatesDto,
} from './pricing.schema';
import { PricingService } from './pricing.service';

/**
 * Every route answers with the property's whole rate configuration, because that
 * is what the screen renders and what the live quote reads. A host who changes
 * one room's rate is looking at the same page a moment later.
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

  @Patch()
  @ZodResponse({ status: 200, type: PricingDto })
  updateMealCharge(
    @Param(PROPERTY_ID_PARAM) propertyId: string,
    @Body() body: UpdateMealChargeDto,
  ): Promise<PricingDto> {
    return this.pricing.updateMealCharge(propertyId, body);
  }

  @Patch('rooms/:roomId')
  @ZodResponse({ status: 200, type: PricingDto })
  updateRoomRates(
    @Param(PROPERTY_ID_PARAM) propertyId: string,
    @Param('roomId') roomId: string,
    @Body() body: UpdateRoomRatesDto,
  ): Promise<PricingDto> {
    return this.pricing.updateRoomRates(propertyId, roomId, body);
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
