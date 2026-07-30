import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import type { PrismaClient } from '../../generated/prisma/client';
import { AppConfig } from '../config/app-config';

/**
 * How verification and reset links leave the process. `AuthEmails` is the
 * running app's implementation; the seed script supplies its own, because
 * seeding a host account goes through the same sign-up path a browser does.
 */
export interface AuthEmailDelivery {
  sendEmailVerification(userId: string, url: string): void;
  sendPasswordReset(userId: string, url: string): void;
}

/** Hosts take bookings on their phone; re-typing a password weekly is a tax. */
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 90;
const SESSION_REFRESH_SECONDS = 60 * 60 * 24;

/**
 * Better Auth is mounted at its default `/api/auth`, and `baseURL` is the *web*
 * origin rather than this service's. Every browser request reaches the API
 * through the Next.js `/api` proxy, so OAuth callbacks and email links must
 * point at the origin the browser actually loaded — the API is never addressed
 * directly by a browser.
 */
export function createAuth(
  prisma: PrismaClient,
  config: AppConfig,
  emails: AuthEmailDelivery,
) {
  return betterAuth({
    appName: 'd-stay',
    secret: config.betterAuthSecret,
    baseURL: config.webAppUrl,
    trustedOrigins: [config.webAppUrl],
    database: prismaAdapter(prisma, { provider: 'postgresql' }),

    emailAndPassword: {
      enabled: true,
      // A host with an unverified email can still run their property. Blocking
      // sign-in on verification would let a bounced email cost them a booking.
      requireEmailVerification: false,
      sendResetPassword: ({ user, url }) => {
        emails.sendPasswordReset(user.id, url);
        return Promise.resolve();
      },
    },

    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: ({ user, url }) => {
        emails.sendEmailVerification(user.id, url);
        return Promise.resolve();
      },
    },

    socialProviders: { google: config.googleOAuth },

    session: {
      expiresIn: SESSION_LIFETIME_SECONDS,
      updateAge: SESSION_REFRESH_SECONDS,
    },

    user: {
      // These map onto columns d-stay owns on the `users` table. `input: false`
      // is what stops a crafted signup payload from granting itself ADMIN.
      additionalFields: {
        role: {
          type: ['HOST', 'ADMIN'],
          required: true,
          defaultValue: 'HOST',
          input: false,
        },
        phone: { type: 'string', required: false, input: true },
        phoneVerified: {
          type: 'boolean',
          required: true,
          defaultValue: false,
          input: false,
        },
        locale: {
          type: 'string',
          required: true,
          defaultValue: 'en',
          input: false,
        },
      },
    },

    advanced: { useSecureCookies: config.isProduction },
  });
}

export type Auth = ReturnType<typeof createAuth>;
