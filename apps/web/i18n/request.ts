import { getRequestConfig } from "next-intl/server";

/**
 * One locale ships. The plumbing is here from the first commit so that adding a
 * regional language later is a new catalog rather than a hunt through JSX for
 * hardcoded English — which is why there is no locale in the URL yet either.
 */
export const DEFAULT_LOCALE = "en";

export default getRequestConfig(async () => ({
  locale: DEFAULT_LOCALE,
  messages: (await import(`../messages/${DEFAULT_LOCALE}.json`)).default,
}));
