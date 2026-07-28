interface Bucket {
  tokens: number;
  updatedAt: number;
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the next token is available. Zero when `ok`. */
  retryAfter: number;
}

/**
 * A token bucket, held in module memory.
 *
 * The honest caveat: this is per-instance and resets on cold start, so it throttles a
 * casual flood and would not stop a determined distributed one. That is the correct
 * amount of engineering for a contact form on a personal site — the alternative is a
 * Redis dependency for a problem this size. Behind a shared store, the same interface
 * holds and only `buckets` changes.
 */
const buckets = new Map<string, Bucket>();

/** Bound the map so a spray of unique keys cannot grow it without limit. */
const MAX_KEYS = 5_000;

export function rateLimit(
  key: string,
  {
    capacity = 3,
    refillSeconds = 600,
    now = Date.now(),
  }: { capacity?: number; refillSeconds?: number; now?: number } = {},
): RateLimitResult {
  const refillRate = capacity / (refillSeconds * 1000);
  const existing = buckets.get(key);

  if (!existing) {
    if (buckets.size >= MAX_KEYS) buckets.clear();
    buckets.set(key, { tokens: capacity - 1, updatedAt: now });
    return { ok: true, retryAfter: 0 };
  }

  const replenished = Math.min(
    capacity,
    existing.tokens + (now - existing.updatedAt) * refillRate,
  );

  if (replenished < 1) {
    const deficit = 1 - replenished;
    return { ok: false, retryAfter: Math.ceil(deficit / refillRate / 1000) };
  }

  buckets.set(key, { tokens: replenished - 1, updatedAt: now });
  return { ok: true, retryAfter: 0 };
}

/** Test seam. */
export function resetRateLimits(): void {
  buckets.clear();
}
