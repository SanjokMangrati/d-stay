"use client";

import { configureApiClient } from "@d-stay/api-client/fetcher";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { BROWSER_API_BASE_PATH } from "./base-path";
import { createQueryClient } from "./query-client";

// This module is also evaluated while server-rendering, where the API client is
// already configured with an absolute URL by `instrumentation.ts`. Guarding on
// `window` keeps the browser's relative base path from overwriting it.
if (typeof window !== "undefined") {
  configureApiClient({ baseUrl: BROWSER_API_BASE_PATH });
}

export function ApiProvider({ children }: { children: ReactNode }) {
  // Created once per browser session, and once per request on the server, so no
  // two users can ever share a cache.
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
