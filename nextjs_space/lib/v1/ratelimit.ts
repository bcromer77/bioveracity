// ==========================================================================
// Developer Platform V1 — lightweight in-memory rate limiter.
//
// A per-key fixed-window counter. This protects a single app instance and is
// intentionally simple and dependency-free so it is trivial to reason about and
// to test deterministically (the clock is injectable). Durable, cross-instance
// limiting can be layered later without changing the call site.
// ==========================================================================

export interface RateLimiter {
  check(key: string): boolean // true = allowed, false = limited
}

export function fixedWindowLimiter(opts: { limit: number; windowMs: number; now?: () => number }): RateLimiter {
  const limit = opts.limit
  const windowMs = opts.windowMs
  const now = opts.now ?? (() => Date.now())
  const buckets = new Map<string, { count: number; resetAt: number }>()
  return {
    check(key: string): boolean {
      const t = now()
      const bucket = buckets.get(key)
      if (!bucket || t >= bucket.resetAt) {
        buckets.set(key, { count: 1, resetAt: t + windowMs })
        return true
      }
      if (bucket.count >= limit) return false
      bucket.count += 1
      return true
    },
  }
}

// Default shared limiter for the live app: 120 write requests per minute per key.
export const defaultLimiter: RateLimiter = fixedWindowLimiter({ limit: 120, windowMs: 60_000 })
