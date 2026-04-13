const STORAGE_KEY = 'urlaubsplaner_oauth_attempt_ts';
/** Max OAuth start attempts per browser within the window (abuse / misclick protection). */
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

function readTimestamps(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n): n is number => typeof n === 'number' && !Number.isNaN(n));
  } catch {
    return [];
  }
}

function writeTimestamps(ts: number[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ts));
  } catch {
    /* ignore */
  }
}

export function oauthRateLimitStatus(): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const recent = readTimestamps().filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_ATTEMPTS) {
    const oldest = Math.min(...recent);
    const retryAfterMs = WINDOW_MS - (now - oldest);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }
  return { ok: true };
}

export function recordOAuthAttempt(): void {
  const now = Date.now();
  const recent = readTimestamps().filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  writeTimestamps(recent);
}
