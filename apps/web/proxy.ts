import { NextResponse, type NextRequest } from "next/server";
import {
  HOME_PATH,
  SESSION_COOKIE_NAME,
  SIGNED_OUT_PATHS,
  SIGN_IN_PATH,
} from "./lib/auth/auth-paths";

/**
 * An optimistic redirect, nothing more. It reads only whether a session cookie
 * exists, never whether it is valid — that answer lives in the API, and every
 * authenticated page still asks for it through `requireHost()`. The point is to
 * spare a signed-out host on a rural connection a page render that would only
 * end in a redirect.
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const isSignedOutPath = SIGNED_OUT_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (hasSessionCookie(request)) {
    return isSignedOutPath
      ? NextResponse.redirect(new URL(HOME_PATH, request.url))
      : NextResponse.next();
  }

  return isSignedOutPath
    ? NextResponse.next()
    : NextResponse.redirect(new URL(SIGN_IN_PATH, request.url));
}

/** Better Auth prefixes the cookie with `__Secure-` when it sets it over HTTPS. */
function hasSessionCookie(request: NextRequest): boolean {
  return (
    request.cookies.has(SESSION_COOKIE_NAME) ||
    request.cookies.has(`__Secure-${SESSION_COOKIE_NAME}`)
  );
}

export const config = {
  // Everything except Next's own assets and the API proxy, which authenticates
  // itself and must not be redirected to an HTML page.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
