import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { ConfigModule } from './config/config.module';
import { ErrorsModule } from './errors/errors.module';
import { HealthModule } from './health/health.module';
import { ApiLoggingModule } from './logging/logging.module';

@Module({
  imports: [ConfigModule, ApiLoggingModule, ErrorsModule, HealthModule],
  providers: [
    // Requests are validated once, at the edge, against the same zod schema that
    // produced the OpenAPI document. Services receive parsed data and trust it.
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    // Responses are validated against their declared schema, so the spec cannot
    // silently drift from what the API actually sends.
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
  ],
})
export class AppModule {}
