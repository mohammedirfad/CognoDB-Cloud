import { env } from "../config/env";
import { logger } from "./logger";

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  label?: string;
}

/**
 * Free-tier managed databases throttle, cold-start and occasionally drop
 * connections. Retrying with exponential backoff + jitter avoids treating a
 * transient hiccup as a hard benchmark failure while still surfacing
 * genuine errors after the retry budget is exhausted.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const retries = opts.retries ?? env.BENCH_MAX_RETRIES;
  const baseDelay = opts.baseDelayMs ?? env.BENCH_RETRY_BASE_DELAY_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
      const jitter = Math.random() * baseDelay;
      const delay = baseDelay * 2 ** attempt + jitter;
      logger.warn(
        { attempt: attempt + 1, retries, delayMs: Math.round(delay), label: opts.label, err: String(err) },
        "retrying after transient failure",
      );
      await sleep(delay);
    }
  }
  throw lastError;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
