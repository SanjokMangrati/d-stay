"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { AUTH_BASE_PATH } from "./auth-paths";

/**
 * Sign-in, sign-up, sign-out and password reset are Better Auth's own endpoints
 * and are not part of the OpenAPI contract, so they are the one thing the web
 * app does not reach through the generated client. Everything the app *reads*
 * about the signed-in host — including their role — still comes from
 * `GET /users/me`, so there is only one shape for "the current user".
 *
 * No `baseURL`: the auth endpoints are same-origin, proxied to the API by the
 * rewrite in `next.config.ts`, which is what keeps the session cookie
 * first-party.
 *
 * `phone` is declared here because it is the one profile field a host supplies
 * during sign-up. It mirrors `user.additionalFields` in the API's
 * `auth.factory.ts`; the other fields there are server-set and never typed into
 * a request, so they do not belong on the client.
 */
export const authClient = createAuthClient({
  basePath: AUTH_BASE_PATH,
  plugins: [inferAdditionalFields({ user: { phone: { type: "string" } } })],
});
