import { defineConfig } from "orval";

const OPENAPI_SPEC = "../../apps/api/openapi.json";

/**
 * Two targets over one spec. They write to separate directories so each can own
 * its `clean` without racing the other.
 */
export default defineConfig({
  client: {
    input: { target: OPENAPI_SPEC },
    output: {
      // Files mirror the backend's module tags, so a Nest module and its client
      // surface stay findable from each other.
      mode: "tags-split",
      target: "./src/generated/endpoints",
      schemas: "./src/generated/models",
      client: "react-query",
      httpClient: "fetch",
      clean: ["./src/generated/endpoints", "./src/generated/models"],
      // Faker-backed MSW handlers: test and Storybook fixtures are derived from
      // the contract instead of being written by hand and drifting from it.
      mock: { generators: [{ type: "msw", useExamples: false }] },
      override: {
        mutator: { path: "./src/fetcher.ts", name: "apiFetch" },
        query: { signal: true },
        fetch: {
          // The mutator resolves to the response body and throws `ApiError` on
          // failure, so hooks deal in domain data rather than in envelopes and
          // status codes.
          includeHttpResponseReturnType: false,
        },
      },
    },
  },
  schemas: {
    input: { target: OPENAPI_SPEC },
    output: {
      mode: "tags-split",
      target: "./src/generated/schemas",
      client: "zod",
      clean: ["./src/generated/schemas"],
    },
  },
});
