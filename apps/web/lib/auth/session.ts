import "server-only";

import { isApiError } from "@d-stay/api-client/error";
import { usersMe } from "@d-stay/api-client/endpoints/users";
import type { UserProfileDtoOutput } from "@d-stay/api-client/models";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { SIGN_IN_PATH } from "./auth-paths";

/**
 * The signed-in host, or a redirect to sign-in. The API is the only thing that
 * can decide whether a session is valid, so every authenticated page asks it
 * rather than inspecting the cookie — `proxy.ts` exists to make the common
 * signed-out case fast, not to make this check optional.
 */
export async function requireHost(): Promise<UserProfileDtoOutput> {
  // Every page in the authenticated group renders one host's own data from
  // their cookie, so none of it can be prerendered. Declaring that here rather
  // than per route is what stops a new page from being built as static HTML.
  await connection();

  try {
    return await usersMe();
  } catch (error) {
    if (isApiError(error) && error.code === "UNAUTHENTICATED") {
      redirect(SIGN_IN_PATH);
    }
    throw error;
  }
}
