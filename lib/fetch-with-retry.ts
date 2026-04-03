/**
 * Retries fetch on transient HTTP statuses and network errors (exponential backoff).
 */

/** Total attempts: first request + (value − 1) retries. Default ≈ 4 retries after first failure. */
export const STUDIO_FETCH_MAX_ATTEMPTS = 5;

const DEFAULT_RETRY_STATUSES = new Set([
  408, 429, 500, 502, 503, 504, 522, 524,
]);

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export interface FetchWithRetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  /** If true, retry this non-OK response (when attempts remain). */
  shouldRetryResponse?: (response: Response) => boolean;
}

/**
 * Like `fetch`, but repeats on network failure or retryable HTTP status codes.
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  options?: FetchWithRetryOptions
): Promise<Response> {
  const maxAttempts = Math.max(
    1,
    options?.maxAttempts ?? STUDIO_FETCH_MAX_ATTEMPTS
  );
  const baseDelayMs = options?.baseDelayMs ?? 1000;
  const shouldRetryResponse =
    options?.shouldRetryResponse ??
    ((r: Response) => DEFAULT_RETRY_STATUSES.has(r.status));

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(input, init);
      if (res.ok) return res;
      if (shouldRetryResponse(res) && attempt < maxAttempts - 1) {
        await sleep(baseDelayMs * 2 ** attempt);
        continue;
      }
      return res;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < maxAttempts - 1) {
        await sleep(baseDelayMs * 2 ** attempt);
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new Error("fetchWithRetry: exhausted attempts");
}
