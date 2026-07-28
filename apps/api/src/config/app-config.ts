import { Injectable } from '@nestjs/common';
import { Env, envSchema } from './env.schema';

/**
 * Configuration is read once, validated once, and injected as a typed object.
 * There is deliberately no `get('SOME.KEY')` accessor: a typo in a key should be
 * a compile error, not a `undefined` discovered in production.
 */
@Injectable()
export class AppConfig {
  private readonly env: Env;

  constructor() {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const problems = parsed.error.issues
        .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
        .join('\n');
      throw new Error(`Invalid environment configuration:\n${problems}`);
    }
    this.env = parsed.data;
  }

  get nodeEnv(): Env['NODE_ENV'] {
    return this.env.NODE_ENV;
  }

  get isDevelopment(): boolean {
    return this.env.NODE_ENV === 'development';
  }

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  get port(): number {
    return this.env.PORT;
  }

  get databaseUrl(): string {
    return this.env.DATABASE_URL;
  }

  get logLevel(): Env['LOG_LEVEL'] {
    return this.env.LOG_LEVEL;
  }

  get webAppUrl(): string {
    return this.env.WEB_APP_URL;
  }
}
