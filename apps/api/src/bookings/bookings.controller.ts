import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ZodResponse } from 'nestjs-zod';
import { PROPERTY_ID_PARAM } from '../auth/property-access.guard';
import { BookingsService } from './bookings.service';
import {
  BookingDto,
  BookingListDto,
  BookingQueryDto,
  CreateBookingDto,
  UpdateBookingNoteDto,
  UpdateBookingStatusDto,
} from './bookings.schema';

/**
 * Bookings own the guest and the money; the rooms they hold are `RoomStay` rows
 * written through the availability module, so there is still exactly one thing
 * that decides whether a room is free.
 */
@ApiTags('bookings')
@Controller(`properties/:${PROPERTY_ID_PARAM}/bookings`)
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get()
  @ZodResponse({ status: 200, type: BookingListDto })
  list(
    @Param(PROPERTY_ID_PARAM) propertyId: string,
    @Query() query: BookingQueryDto,
  ): Promise<BookingListDto> {
    return this.bookings.list(propertyId, query);
  }

  @Get(':bookingId')
  @ZodResponse({ status: 200, type: BookingDto })
  find(
    @Param(PROPERTY_ID_PARAM) propertyId: string,
    @Param('bookingId') bookingId: string,
  ): Promise<BookingDto> {
    return this.bookings.find(propertyId, bookingId);
  }

  @Post()
  @ZodResponse({ status: 201, type: BookingDto })
  create(
    @Param(PROPERTY_ID_PARAM) propertyId: string,
    @Body() body: CreateBookingDto,
    @Session() session: UserSession,
  ): Promise<BookingDto> {
    return this.bookings.create(propertyId, body, session.user.id);
  }

  /**
   * Confirm, check in, check out, cancel, no-show — every one of them is a move
   * through the same graph, so they are one endpoint rather than five verbs that
   * could each forget to release the rooms.
   */
  @Patch(':bookingId/status')
  @ZodResponse({ status: 200, type: BookingDto })
  changeStatus(
    @Param(PROPERTY_ID_PARAM) propertyId: string,
    @Param('bookingId') bookingId: string,
    @Body() body: UpdateBookingStatusDto,
    @Session() session: UserSession,
  ): Promise<BookingDto> {
    return this.bookings.changeStatus(
      propertyId,
      bookingId,
      body,
      session.user.id,
    );
  }

  @Patch(':bookingId/note')
  @ZodResponse({ status: 200, type: BookingDto })
  updateNote(
    @Param(PROPERTY_ID_PARAM) propertyId: string,
    @Param('bookingId') bookingId: string,
    @Body() body: UpdateBookingNoteDto,
    @Session() session: UserSession,
  ): Promise<BookingDto> {
    return this.bookings.updateNote(
      propertyId,
      bookingId,
      body,
      session.user.id,
    );
  }
}
