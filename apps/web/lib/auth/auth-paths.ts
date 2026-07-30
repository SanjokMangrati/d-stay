/**
 * Better Auth's mount point, as the browser sees it. The API mounts the handler
 * at the same path and builds its OAuth callbacks and email links from this
 * origin, so the value has to be identical on both sides of the proxy — which is
 * why the Next rewrite, the auth client and the proxy all read it from here.
 *
 * It deliberately sits under `/api` alongside the rest of the API surface, even
 * though the rewrite for it is path-preserving and the general one is not.
 */
export const AUTH_BASE_PATH = "/api/auth";

/**
 * Name of the session cookie Better Auth issues. `proxy.ts` reads it to redirect
 * signed-out visitors without a round trip; it is never treated as proof of a
 * valid session, which only the API can decide.
 */
export const SESSION_COOKIE_NAME = "better-auth.session_token";

export const SIGN_IN_PATH = "/sign-in";
export const SIGN_UP_PATH = "/sign-up";
export const FORGOT_PASSWORD_PATH = "/forgot-password";
export const RESET_PASSWORD_PATH = "/reset-password";
export const HOME_PATH = "/";

/** Routes a signed-out visitor may see; everything else redirects to sign-in. */
export const SIGNED_OUT_PATHS = [
  SIGN_IN_PATH,
  SIGN_UP_PATH,
  FORGOT_PASSWORD_PATH,
  RESET_PASSWORD_PATH,
];
