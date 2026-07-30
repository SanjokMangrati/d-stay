import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ZodResponse } from 'nestjs-zod';
import { PROPERTY_ID_PARAM } from '../auth/property-access.guard';
import { PropertyListDto, PropertySummaryDto } from './properties.schema';
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

  /**
   * Naming the parameter `propertyId` is what subjects this route to
   * `PropertyAccessGuard` — there is no per-route decorator to forget.
   */
  @Get(`:${PROPERTY_ID_PARAM}`)
  @ZodResponse({ status: 200, type: PropertySummaryDto })
  findOne(
    @Param(PROPERTY_ID_PARAM) propertyId: string,
    @Session() session: UserSession,
  ): Promise<PropertySummaryDto> {
    return this.properties.findById(propertyId, session.user.id);
  }
}
