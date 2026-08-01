import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ZodResponse } from 'nestjs-zod';
import { PROPERTY_ID_PARAM } from '../auth/property-access.guard';
import {
  CreatePropertyDto,
  PropertyDetailDto,
  PropertyListDto,
  UpdatePropertyDto,
} from './properties.schema';
import { PropertiesService } from './properties.service';

@ApiTags('properties')
@Controller('properties')
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Get()
  @ZodResponse({ status: 200, type: PropertyListDto })
  list(@Session() session: UserSession): Promise<PropertyListDto> {
    return this.properties.listForUser(session.user.id);
  }

  @Post()
  @ZodResponse({ status: 201, type: PropertyDetailDto })
  create(
    @Session() session: UserSession,
    @Body() body: CreatePropertyDto,
  ): Promise<PropertyDetailDto> {
    return this.properties.create(session.user.id, body.name);
  }

  /**
   * Naming the parameter `propertyId` is what subjects this route to
   * `PropertyAccessGuard` — there is no per-route decorator to forget.
   */
  @Get(`:${PROPERTY_ID_PARAM}`)
  @ZodResponse({ status: 200, type: PropertyDetailDto })
  findOne(
    @Param(PROPERTY_ID_PARAM) propertyId: string,
    @Session() session: UserSession,
  ): Promise<PropertyDetailDto> {
    return this.properties.findById(propertyId, session.user.id);
  }

  @Patch(`:${PROPERTY_ID_PARAM}`)
  @ZodResponse({ status: 200, type: PropertyDetailDto })
  update(
    @Param(PROPERTY_ID_PARAM) propertyId: string,
    @Session() session: UserSession,
    @Body() changes: UpdatePropertyDto,
  ): Promise<PropertyDetailDto> {
    return this.properties.update(propertyId, session.user.id, changes);
  }

  @Post(`:${PROPERTY_ID_PARAM}/submit`)
  @ZodResponse({ status: 200, type: PropertyDetailDto })
  submitForReview(
    @Param(PROPERTY_ID_PARAM) propertyId: string,
    @Session() session: UserSession,
  ): Promise<PropertyDetailDto> {
    return this.properties.submitForReview(propertyId, session.user.id);
  }
}
