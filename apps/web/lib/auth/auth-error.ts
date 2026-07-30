/**
 * Better Auth reports failures with a stable `code`; the accompanying message is
 * English prose from the library and must never reach a host. This turns a code
 * into a key in the `auth.errors` catalog, so the copy is ours and translatable.
 */
const MESSAGE_KEY_BY_CODE: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "invalidCredentials",
  INVALID_EMAIL: "invalidCredentials",
  USER_ALREADY_EXISTS: "emailTaken",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "emailTaken",
  PASSWORD_TOO_SHORT: "weakPassword",
  PASSWORD_TOO_LONG: "weakPassword",
  INVALID_TOKEN: "invalidToken",
  TOKEN_EXPIRED: "invalidToken",
};

/** `code` is absent when the request never reached the server. */
export function authErrorMessageKey(error: {
  code?: string;
  status?: number;
}): string {
  if (!error.code) {
    return error.status === undefined || error.status === 0
      ? "unreachable"
      : "unexpected";
  }
  return MESSAGE_KEY_BY_CODE[error.code] ?? "unexpected";
}
