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

  get betterAuthSecret(): string {
    return this.env.BETTER_AUTH_SECRET;
  }

  get googleOAuth(): { clientId: string; clientSecret: string } {
    return {
      clientId: this.env.GOOGLE_CLIENT_ID,
      clientSecret: this.env.GOOGLE_CLIENT_SECRET,
    };
  }

  get redisUrl(): string {
    return this.env.REDIS_URL;
  }

  get objectStorage(): {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
    publicBaseUrl: string;
  } {
    return {
      endpoint: this.env.S3_ENDPOINT,
      region: this.env.S3_REGION,
      bucket: this.env.S3_BUCKET,
      accessKeyId: this.env.S3_ACCESS_KEY_ID,
      secretAccessKey: this.env.S3_SECRET_ACCESS_KEY,
      forcePathStyle: this.env.S3_FORCE_PATH_STYLE,
      publicBaseUrl: this.env.MEDIA_PUBLIC_BASE_URL,
    };
  }
}
