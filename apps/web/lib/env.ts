import { z } from "zod";

const LOG_LEVELS = [
  "silent",
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
] as const;

/**
 * Server-side configuration only. Nothing here is ever sent to the browser —
 * anything the client genuinely needs is a `NEXT_PUBLIC_` variable and belongs in
 * its own module, not here.
 *
 * This module deliberately has no `server-only` guard: `next.config.ts` reads it
 * to build the API proxy rewrite, and that file is loaded outside the React
 * bundles. Importing it from a Client Component still fails immediately and
 * loudly, because none of these variables exist in a browser.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  /** Where this Next server, and its `/api` proxy, reach the NestJS API. */
  API_URL: z.url(),
  LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
});

function readServerEnv() {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return parsed.data;
}

export const serverEnv = readServerEnv();
