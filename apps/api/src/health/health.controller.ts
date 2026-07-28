import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { HealthDto } from './health.schema';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ZodResponse({ status: 200, type: HealthDto })
  check(): HealthDto {
    return { status: 'ok', uptimeSeconds: Math.floor(process.uptime()) };
  }
}
