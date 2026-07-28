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
  /** Origin allowed to call this API with credentials. */
  WEB_APP_URL: z.url(),
});

export type Env = z.infer<typeof envSchema>;
