const TRIP_SEG = /^\/trip\/([^/]+)\/?$/;

/** Pfad ohne Vite-`base` (z. B. `/Urlaubsplaner`), damit Routing auf GitHub Pages funktioniert. */
function stripViteBase(pathname: string): string {
  const base = import.meta.env.BASE_URL;
  if (base === '/') return pathname;
  const prefix = base.endsWith('/') ? base.slice(0, -1) : base;
  if (pathname === prefix) return '/';
  if (pathname.startsWith(prefix + '/')) {
    return pathname.slice(prefix.length) || '/';
  }
  return pathname;
}

export function parseTripIdFromPath(pathname = typeof window !== 'undefined' ? window.location.pathname : '/'): string | null {
  const local = stripViteBase(pathname);
  const m = local.match(TRIP_SEG);
  return m ? decodeURIComponent(m[1]) : null;
}

export function tripPath(tripId: string): string {
  const base = import.meta.env.BASE_URL;
  const tail = `trip/${encodeURIComponent(tripId)}`;
  return base === '/' ? `/${tail}` : `${base}${tail}`;
}

/** Vollständiger teilbarer Link zur Reise (gleicher Ursprung wie die App). */
export function tripShareUrl(tripId: string): string {
  if (typeof window === 'undefined') return tripPath(tripId);
  return `${window.location.origin}${tripPath(tripId)}`;
}

/** Startseiten-Pfad inkl. Vite-`base` (für History API). */
export function appHomePath(): string {
  const b = import.meta.env.BASE_URL;
  return b.endsWith('/') ? b : `${b}/`;
}
