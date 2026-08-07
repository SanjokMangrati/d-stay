import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { AuthModule } from './auth/auth.module';
import { AvailabilityModule } from './availability/availability.module';
import { ConfigModule } from './config/config.module';
import { ErrorsModule } from './errors/errors.module';
import { HealthModule } from './health/health.module';
import { ApiLoggingModule } from './logging/logging.module';
import { MediaModule } from './media/media.module';
import { PricingModule } from './pricing/pricing.module';
import { PrismaModule } from './prisma/prisma.module';
import { PropertiesModule } from './properties/properties.module';
import { QueueModule } from './queue/queue.module';
import { RoomsModule } from './rooms/rooms.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule,
    ApiLoggingModule,
    PrismaModule,
    QueueModule,
    ErrorsModule,
    // Ahead of every feature module, because it registers the global guards
    // that those modules' routes are protected by.
    AuthModule,
    HealthModule,
    UsersModule,
    PropertiesModule,
    MediaModule,
    RoomsModule,
    PricingModule,
    AvailabilityModule,
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
