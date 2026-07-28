/**
 * Browser requests are same-origin and proxied by the Next rewrite configured in
 * `next.config.ts`, so the session cookie stays first-party. The rewrite and this
 * value must agree — that is why it is a shared constant rather than two strings.
 */
export const BROWSER_API_BASE_PATH = "/api";
