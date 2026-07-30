import { ApiError, ApiTransportError } from "./api-error";
import type { ApiErrorDto } from "./generated/models";

export interface ApiClientConfig {
  /**
   * Absolute in a server runtime, origin-relative in the browser (where requests
   * go through the app's own proxy so session cookies stay first-party).
   */
  baseUrl: string;
  /** Per-request headers — auth, locale, tracing. Resolved on every call. */
  getHeaders?: () => HeadersInit | Promise<HeadersInit>;
}

/**
 * orval picks this up from the mutator file and uses it as the error type of
 * every generated hook. The union is the honest one: a request either failed at
 * the API or never reached it, and callers must narrow before reading `code`.
 */
export type ErrorType<TPayload> = ApiError | ApiTransportError;

/**
 * Held on `globalThis` rather than in a module variable because a bundler gives
 * the instrumentation entry and the Server Component graph separate instances of
 * this module — a plain `let` would be written in one and read as `undefined` in
 * the other. The process is the runtime, so the process is where it lives.
 */
const CONFIG_KEY = Symbol.for("d-stay.api-client.config");

type ConfigHost = { [CONFIG_KEY]?: ApiClientConfig };

/** Called once per runtime during app startup. */
export function configureApiClient(config: ApiClientConfig): void {
  (globalThis as ConfigHost)[CONFIG_KEY] = config;
}

/**
 * The one place an HTTP response becomes a value or an exception. Every generated
 * hook routes through here, so error shape, credentials and base URL are decided
 * once rather than per call site.
 */
export async function apiFetch<T>(
  url: string,
  options: RequestInit,
): Promise<T> {
  const clientConfig = (globalThis as ConfigHost)[CONFIG_KEY];
  if (!clientConfig) {
    throw new Error(
      "configureApiClient() must be called before any API request is made.",
    );
  }

  const headers = new Headers(await clientConfig.getHeaders?.());
  new Headers(options.headers).forEach((value, key) => headers.set(key, value));
  if (options.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${clientConfig.baseUrl}${url}`, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch (cause) {
    throw new ApiTransportError("The request could not be sent.", undefined, {
      cause,
    });
  }

  const body = await readJson(response);

  if (!response.ok) {
    if (isErrorEnvelope(body)) {
      throw new ApiError(response.status, body.error);
    }
    throw new ApiTransportError(
      `The API returned ${response.status} without an error envelope.`,
      response.status,
    );
  }

  return body as T;
}

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }
  const text = await response.text();
  if (text.length === 0) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (cause) {
    throw new ApiTransportError(
      "The API returned a response that is not JSON.",
      response.status,
      { cause },
    );
  }
}

function isErrorEnvelope(body: unknown): body is ApiErrorDto {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as ApiErrorDto).error?.code === "string"
  );
}
