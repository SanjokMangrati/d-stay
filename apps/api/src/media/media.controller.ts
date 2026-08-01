import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { PROPERTY_ID_PARAM } from '../auth/property-access.guard';
import {
  CompleteUploadDto,
  CreateUploadDto,
  MediaAssetDto,
  MediaListDto,
  MediaQueryDto,
  ReorderMediaDto,
  UploadIntentDto,
} from './media.schema';
import { MediaService } from './media.service';

/**
 * Nested under the property because a photo is only ever reached through one, and
 * naming the parameter `propertyId` is what puts every route here behind
 * `PropertyAccessGuard`.
 */
@ApiTags('media')
@Controller(`properties/:${PROPERTY_ID_PARAM}/media`)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /** Without a room, the property's own gallery — never both at once. */
  @Get()
  @ZodResponse({ status: 200, type: MediaListDto })
  list(
    @Param(PROPERTY_ID_PARAM) propertyId: string,
    @Query() query: MediaQueryDto,
  ): Promise<MediaListDto> {
    return this.media.listFor({ propertyId, roomId: query.roomId ?? null });
  }

  /** Hands back a presigned `PUT`; the browser uploads to storage, not to here. */
  @Post('uploads')
  @ZodResponse({ status: 201, type: UploadIntentDto })
  createUpload(
    @Param(PROPERTY_ID_PARAM) propertyId: string,
    @Body() body: CreateUploadDto,
  ): Promise<UploadIntentDto> {
    return this.media.createUploadIntent(propertyId, body);
  }

  @Post(':mediaId/complete')
  @ZodResponse({ status: 200, type: MediaAssetDto })
  completeUpload(
    @Param(PROPERTY_ID_PARAM) propertyId: string,
    @Param('mediaId') mediaId: string,
    @Body() body: CompleteUploadDto,
  ): Promise<MediaAssetDto> {
    return this.media.completeUpload(propertyId, mediaId, body);
  }

  @Patch('order')
  @ZodResponse({ status: 200, type: MediaListDto })
  reorder(
    @Param(PROPERTY_ID_PARAM) propertyId: string,
    @Body() body: ReorderMediaDto,
  ): Promise<MediaListDto> {
    return this.media.reorder(
      { propertyId, roomId: body.roomId },
      body.mediaIds,
    );
  }

  @Post(':mediaId/cover')
  @ZodResponse({ status: 200, type: MediaListDto })
  setCover(
    @Param(PROPERTY_ID_PARAM) propertyId: string,
    @Param('mediaId') mediaId: string,
  ): Promise<MediaListDto> {
    return this.media.setCover(propertyId, mediaId);
  }

  @Delete(':mediaId')
  @ZodResponse({ status: 200, type: MediaListDto })
  remove(
    @Param(PROPERTY_ID_PARAM) propertyId: string,
    @Param('mediaId') mediaId: string,
  ): Promise<MediaListDto> {
    return this.media.remove(propertyId, mediaId);
  }
}
