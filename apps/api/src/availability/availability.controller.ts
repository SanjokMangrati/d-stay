import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { PROPERTY_ID_PARAM } from '../auth/property-access.guard';
import { AvailabilityService } from './availability.service';
import {
  AvailabilityQueryDto,
  CreateBlockDto,
  FreeRoomsDto,
  FreeRoomsQueryDto,
  StayListDto,
} from './availability.schema';

/**
 * Occupancy, and only occupancy. Rates come from the pricing module and rooms
 * from the rooms module; the calendar composes the three. Answering "what does
 * this night cost" from here would be a second place that decides a price.
 */
@ApiTags('availability')
@Controller(`properties/:${PROPERTY_ID_PARAM}/availability`)
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get()
  @ZodResponse({ status: 200, type: StayListDto })
  find(
    @Param(PROPERTY_ID_PARAM) propertyId: string,
    @Query() query: AvailabilityQueryDto,
  ): Promise<StayListDto> {
    return this.availability.window(propertyId, query);
  }

  @Get('free-rooms')
  @ZodResponse({ status: 200, type: FreeRoomsDto })
  freeRooms(
    @Param(PROPERTY_ID_PARAM) propertyId: string,
    @Query() query: FreeRoomsQueryDto,
  ): Promise<FreeRoomsDto> {
    return this.availability.freeRooms(propertyId, query);
  }

  @Post('blocks')
  @ZodResponse({ status: 201, type: StayListDto })
  createBlocks(
    @Param(PROPERTY_ID_PARAM) propertyId: string,
    @Body() body: CreateBlockDto,
  ): Promise<StayListDto> {
    return this.availability.createBlocks(propertyId, body);
  }

  /**
   * No body: the client removed one row it already holds, and re-sending the
   * window would mean this endpoint had to be told which window that was.
   */
  @Delete('blocks/:stayId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeBlock(
    @Param(PROPERTY_ID_PARAM) propertyId: string,
    @Param('stayId') stayId: string,
  ): Promise<void> {
    return this.availability.removeBlock(propertyId, stayId);
  }
}
