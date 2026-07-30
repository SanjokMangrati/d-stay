import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { ZodResponse } from 'nestjs-zod';
import { HealthDto } from './health.schema';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  // Uptime probes have no session. Everything else in the API is denied by
  // default, so opting out has to be explicit and visible.
  @AllowAnonymous()
  @ZodResponse({ status: 200, type: HealthDto })
  check(): HealthDto {
    return { status: 'ok', uptimeSeconds: Math.floor(process.uptime()) };
  }
}
