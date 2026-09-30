// Per-IP request rate limiting. Each createRateLimiter() call gets its own
// counter bucket, so unrelated routes (e.g. the paid screenshot analysis
// endpoint and the free voice-members endpoint) don't share a budget.

export function createRateLimiter(limit, windowMs, now = Date.now) {
  const buckets = new Map();

  function check(ip) {
    const nowMs = now();
    const entry = buckets.get(ip);
    if (!entry) {
      buckets.set(ip, { count: 1, windowStart: nowMs });
      return true;
    }
    if (nowMs - entry.windowStart > windowMs) {
      entry.count = 1;
      entry.windowStart = nowMs;
      return true;
    }
    entry.count++;
    return entry.count <= limit;
  }

  function cleanup() {
    const nowMs = now();
    for (const [ip, entry] of buckets) {
      if (nowMs - entry.windowStart > windowMs) {
        buckets.delete(ip);
      }
    }
  }

  return { check, cleanup };
}

// Shared IP-extraction + 429 response used by every rate-limited route.
// Returns true when the request may proceed.
export function enforceRateLimit(limiter, req, res) {
  const ip = req.headers["x-real-ip"] || req.ip;
  if (!limiter.check(ip)) {
    res.status(429).json({ error: "Te veel verzoeken. Probeer het over een minuut opnieuw." });
    return false;
  }
  return true;
}
