import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { PinoLogger } from 'nestjs-pino';
import { AppConfig } from '../config/app-config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthEmails } from './auth-emails';
import { createAuth } from './auth.factory';
import { PropertyAccessGuard } from './property-access.guard';

/**
 * Two global guards, in this order:
 *
 * 1. Better Auth's `AuthGuard`, registered by `BetterAuthModule`, which denies
 *    every request without a session unless the route carries `@AllowAnonymous`.
 *    Default-deny is the point: forgetting a decorator locks a route down
 *    rather than opening it.
 * 2. `PropertyAccessGuard`, which authorizes any route carrying a `:propertyId`.
 *
 * Order follows module resolution — the import below is processed before this
 * module's own providers, so the session is on the request by the time the
 * second guard reads it.
 */
@Module({
  imports: [
    BetterAuthModule.forRootAsync({
      inject: [PrismaService, AppConfig, PinoLogger],
      useFactory: (
        prisma: PrismaService,
        config: AppConfig,
        logger: PinoLogger,
      ) => ({
        auth: createAuth(prisma, config, new AuthEmails(logger, config)),
      }),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: PropertyAccessGuard }],
})
export class AuthModule {}
