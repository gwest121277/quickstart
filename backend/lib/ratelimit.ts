const buckets = new Map<string, number[]>();

export function checkRateLimit(
  userId: string,
  windowMs: number,
  maxHits: number
): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const recent = (buckets.get(userId) ?? []).filter((t) => t > cutoff);
  if (recent.length >= maxHits) {
    buckets.set(userId, recent);
    return false;
  }
  recent.push(now);
  buckets.set(userId, recent);
  return true;
}

if (typeof setInterval === "function") {
  const DAY = 24 * 60 * 60 * 1000;
  const interval = setInterval(() => {
    const cutoff = Date.now() - DAY;
    for (const [k, v] of buckets.entries()) {
      const filtered = v.filter((t) => t > cutoff);
      if (filtered.length === 0) buckets.delete(k);
      else buckets.set(k, filtered);
    }
  }, 60 * 60 * 1000);
  interval.unref?.();
}
