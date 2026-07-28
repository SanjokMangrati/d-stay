import { isApiError } from "@d-stay/api-client/error";
import { QueryClient, type QueryClientConfig } from "@tanstack/react-query";

/** Long enough that navigating back to the calendar does not refetch instantly. */
const DEFAULT_STALE_TIME_MS = 30_000;

const config: QueryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: DEFAULT_STALE_TIME_MS,
      // Retrying a 4xx just delays a message the host needs now; only transport
      // and server faults are worth a second attempt on a weak connection.
      retry: (failureCount, error) => {
        if (isApiError(error) && error.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
};

export function createQueryClient(): QueryClient {
  return new QueryClient(config);
}
