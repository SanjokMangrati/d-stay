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
  CreateRoomDto,
  ReorderRoomsDto,
  RoomDto,
  RoomListDto,
  UpdateRoomDto,
} from './rooms.schema';
import { RoomsService } from './rooms.service';

@ApiTags('rooms')
@Controller(`properties/:${PROPERTY_ID_PARAM}/rooms`)
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  @ZodResponse({ status: 200, type: RoomListDto })
  list(@Param(PROPERTY_ID_PARAM) propertyId: string): Promise<RoomListDto> {
    return this.rooms.listForProperty(propertyId);
  }

  @Post()
  @ZodResponse({ status: 201, type: RoomDto })
  create(
    @Param(PROPERTY_ID_PARAM) propertyId: string,
    @Body() body: CreateRoomDto,
  ): Promise<RoomDto> {
    return this.rooms.create(propertyId, body);
  }

  @Patch('order')
  @ZodResponse({ status: 200, type: RoomListDto })
  reorder(
    @Param(PROPERTY_ID_PARAM) propertyId: string,
    @Body() body: ReorderRoomsDto,
  ): Promise<RoomListDto> {
    return this.rooms.reorder(propertyId, body.roomIds);
  }

  @Patch(':roomId')
  @ZodResponse({ status: 200, type: RoomDto })
  update(
    @Param(PROPERTY_ID_PARAM) propertyId: string,
    @Param('roomId') roomId: string,
    @Body() body: UpdateRoomDto,
  ): Promise<RoomDto> {
    return this.rooms.update(propertyId, roomId, body);
  }

  @Delete(':roomId')
  @ZodResponse({ status: 200, type: RoomListDto })
  remove(
    @Param(PROPERTY_ID_PARAM) propertyId: string,
    @Param('roomId') roomId: string,
  ): Promise<RoomListDto> {
    return this.rooms.remove(propertyId, roomId);
  }
}
