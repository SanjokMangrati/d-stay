/**
 * Runs once when the Next server starts. Configuration is validated and the API
 * client is wired here so a Server Component can call a generated endpoint
 * without each route remembering to set it up first.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { configureApiClient } = await import("@d-stay/api-client/fetcher");
  const { serverEnv } = await import("./lib/env");

  configureApiClient({
    baseUrl: serverEnv.API_URL,
    // Server-side calls act on behalf of the signed-in host, so the incoming
    // session cookie is forwarded rather than the request going out anonymous.
    getHeaders: async () => {
      const { headers } = await import("next/headers");
      const cookie = (await headers()).get("cookie");
      const outgoing = new Headers();
      if (cookie) {
        outgoing.set("cookie", cookie);
      }
      return outgoing;
    },
  });
}
