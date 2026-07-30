import { PinoLogger } from 'nestjs-pino';
import { AppConfig } from '../config/app-config';
import type { AuthEmailDelivery } from './auth.factory';

/**
 * Verification and password-reset links have to reach the host somehow. The
 * notifications module — React Email templates queued through BullMQ — is not
 * built yet, so in development the link goes to the log where a developer can
 * click it, and anywhere else the send fails loudly rather than silently
 * dropping the only way a host can recover their account.
 *
 * When notifications land, these two methods enqueue a job. Nothing else about
 * the auth configuration changes.
 */
export class AuthEmails implements AuthEmailDelivery {
  constructor(
    private readonly logger: PinoLogger,
    private readonly config: AppConfig,
  ) {
    logger.setContext(AuthEmails.name);
  }

  sendEmailVerification(userId: string, url: string): void {
    this.deliver('email verification link', userId, url);
  }

  sendPasswordReset(userId: string, url: string): void {
    this.deliver('password reset link', userId, url);
  }

  private deliver(kind: string, userId: string, url: string): void {
    if (this.config.isProduction) {
      throw new Error(
        `No email transport is configured, so the ${kind} for user ${userId} could not be sent.`,
      );
    }
    this.logger.info({ userId, url }, kind);
  }
}
