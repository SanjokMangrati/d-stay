import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';
import { ErrorsModule } from './errors/errors.module';
import { HealthModule } from './health/health.module';
import { ApiLoggingModule } from './logging/logging.module';
import { PrismaModule } from './prisma/prisma.module';
import { PropertiesModule } from './properties/properties.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule,
    ApiLoggingModule,
    PrismaModule,
    ErrorsModule,
    // Ahead of every feature module, because it registers the global guards
    // that those modules' routes are protected by.
    AuthModule,
    HealthModule,
    UsersModule,
    PropertiesModule,
  ],
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
