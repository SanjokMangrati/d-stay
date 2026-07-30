import { z } from 'zod';

export const LOG_LEVELS = [
  'silent',
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
] as const;

/**
 * The complete set of environment variables this service reads. Anything absent
 * from here is not configuration — it is a magic string, and the process will not
 * see it. Adding a variable means adding it here and to `.env.example`.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  /**
   * Origin the browser loads. Session cookies, OAuth callbacks and email links
   * are all built from it, because every browser request reaches this API
   * through the web app's `/api` proxy rather than hitting it directly.
   */
  WEB_APP_URL: z.url(),
  /** Signs session cookies and verification tokens. */
  BETTER_AUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;
