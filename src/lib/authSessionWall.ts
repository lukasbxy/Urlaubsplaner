/** Wall-clock session cap: after this duration from first login in this browser, user is signed out. */
export const SESSION_WALL_MS = 24 * 60 * 60 * 1000;

const KEY_USER = 'urlaubsplaner_session_wall_user';
const KEY_START = 'urlaubsplaner_session_wall_start';

export function clearSessionWall(): void {
  try {
    localStorage.removeItem(KEY_USER);
    localStorage.removeItem(KEY_START);
  } catch {
    /* ignore */
  }
}

export function ensureSessionWall(userId: string): void {
  try {
    const storedUser = localStorage.getItem(KEY_USER);
    const startRaw = localStorage.getItem(KEY_START);
    if (storedUser !== userId) {
      localStorage.setItem(KEY_USER, userId);
      localStorage.setItem(KEY_START, String(Date.now()));
      return;
    }
    if (!startRaw || Number.isNaN(Number(startRaw))) {
      localStorage.setItem(KEY_START, String(Date.now()));
    }
  } catch {
    /* ignore */
  }
}

export function isSessionWallExpired(userId: string): boolean {
  try {
    const storedUser = localStorage.getItem(KEY_USER);
    const startRaw = localStorage.getItem(KEY_START);
    if (storedUser !== userId || !startRaw) return false;
    const start = Number(startRaw);
    if (Number.isNaN(start)) return false;
    return Date.now() - start >= SESSION_WALL_MS;
  } catch {
    return false;
  }
}
