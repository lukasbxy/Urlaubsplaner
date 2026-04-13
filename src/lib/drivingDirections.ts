import './googleMapsInit';
import { importLibrary } from '@googlemaps/js-api-loader';

export type DrivingRouteInfo = {
  path: google.maps.LatLngLiteral[];
  durationText: string;
  durationSeconds: number;
  durationInTrafficText?: string;
  durationInTrafficSeconds?: number;
  distanceText: string;
  copyrights: string;
};

function formatDurationFromSeconds(totalSec: number): string {
  const m = Math.round(totalSec / 60);
  if (m < 60) return `${m} Min.`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} Std. ${rest} Min.` : `${h} Std.`;
}

function formatDistanceMeters(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function pathFromRoutePath(
  path: Array<{ lat?: number | (() => number); lng?: number | (() => number) }> | undefined,
): google.maps.LatLngLiteral[] {
  if (!path?.length) return [];
  return path.map((p) => ({
    lat: typeof p.lat === 'function' ? p.lat() : (p.lat ?? 0),
    lng: typeof p.lng === 'function' ? p.lng() : (p.lng ?? 0),
  }));
}

/** Abfahrtszeit für Verkehr: geplante Zeit in der Zukunft, sonst „jetzt“. */
function pickDepartureTime(scheduled?: Date | null): { departure: Date; useTraffic: boolean } {
  const now = new Date();
  if (scheduled && !Number.isNaN(scheduled.getTime())) {
    if (scheduled.getTime() >= now.getTime()) return { departure: scheduled, useTraffic: true };
    return { departure: now, useTraffic: false };
  }
  return { departure: now, useTraffic: true };
}

type RouteComputeResult = {
  routes?: Array<{
    path?: Array<{ lat?: number | (() => number); lng?: number | (() => number) }>;
    durationMillis?: number;
    staticDurationMillis?: number;
    distanceMeters?: number;
    localizedValues?: {
      duration?: { text?: string };
      staticDuration?: { text?: string };
      distance?: { text?: string };
    };
    warnings?: string[];
  }>;
};

/** Neue Routes API (Route.computeRoutes). Benötigt „Routes API“ + passende Key-Freigabe. */
async function fetchDrivingRouteComputeRoutes(
  origin: google.maps.LatLngLiteral,
  destination: google.maps.LatLngLiteral,
  scheduledStart: Date | null | undefined,
): Promise<DrivingRouteInfo | null> {
  const routesLib = await importLibrary('routes');
  const RL = routesLib as google.maps.RoutesLibrary & {
    Route?: { computeRoutes: (req: unknown) => Promise<RouteComputeResult> };
    RoutingPreference?: { TRAFFIC_AWARE: string; TRAFFIC_UNAWARE: string };
  };
  const Route =
    RL.Route ??
    (google.maps as unknown as { routes?: { Route?: { computeRoutes: (req: unknown) => Promise<RouteComputeResult> } } })
      .routes?.Route;
  if (!Route?.computeRoutes) return null;

  const { departure, useTraffic } = pickDepartureTime(scheduledStart ?? null);

  const trafficPref = RL.RoutingPreference?.TRAFFIC_AWARE ?? 'TRAFFIC_AWARE';
  const unawarePref = RL.RoutingPreference?.TRAFFIC_UNAWARE ?? 'TRAFFIC_UNAWARE';

  const request: Record<string, unknown> = {
    origin,
    destination,
    travelMode: RL.TravelMode.DRIVING,
    fields: [
      'durationMillis',
      'staticDurationMillis',
      'distanceMeters',
      'path',
      'localizedValues',
      'warnings',
    ],
    ...(useTraffic
      ? {
          routingPreference: trafficPref,
          departureTime: departure,
        }
      : {
          routingPreference: unawarePref,
        }),
  };

  const { routes } = await Route.computeRoutes(request);
  const route = routes?.[0];
  if (!route) return null;

  const path = pathFromRoutePath(route.path);
  if (path.length < 2) return null;

  const staticSec = (route.staticDurationMillis ?? route.durationMillis ?? 0) / 1000;
  const trafficSec = (route.durationMillis ?? route.staticDurationMillis ?? 0) / 1000;

  const durationText =
    route.localizedValues?.staticDuration?.text ?? formatDurationFromSeconds(staticSec);
  const distanceText =
    route.localizedValues?.distance?.text ??
    (route.distanceMeters != null ? formatDistanceMeters(route.distanceMeters) : '');

  const durationInTrafficText = useTraffic
    ? (route.localizedValues?.duration?.text ?? formatDurationFromSeconds(trafficSec))
    : undefined;
  const durationInTrafficSeconds = useTraffic ? Math.round(trafficSec) : undefined;

  const copyrights = (route.warnings ?? []).filter(Boolean).join(' ');

  return {
    path,
    durationText,
    durationSeconds: Math.round(staticSec),
    durationInTrafficText,
    durationInTrafficSeconds,
    distanceText,
    copyrights,
  };
}

/** Legacy DirectionsService (Directions API Legacy). Fallback wenn Routes API 403 / nicht freigeschaltet. */
async function fetchDrivingRouteDirectionsLegacy(
  origin: google.maps.LatLngLiteral,
  destination: google.maps.LatLngLiteral,
  scheduledStart: Date | null | undefined,
): Promise<DrivingRouteInfo | null> {
  const routesLib = await importLibrary('routes');
  const DirectionsService = routesLib.DirectionsService;
  const DirectionsStatus = routesLib.DirectionsStatus;
  const TravelMode = routesLib.TravelMode;
  const TrafficModel = routesLib.TrafficModel;

  const svc = new DirectionsService();
  const { departure, useTraffic } = pickDepartureTime(scheduledStart ?? null);

  const request: google.maps.DirectionsRequest = {
    origin,
    destination,
    travelMode: TravelMode.DRIVING,
    ...(useTraffic
      ? {
          drivingOptions: {
            departureTime: departure,
            trafficModel: TrafficModel.BEST_GUESS,
          },
        }
      : {}),
  };

  const result = await new Promise<google.maps.DirectionsResult | null>((resolve) => {
    svc.route(request, (res, status) => {
      if (status === DirectionsStatus.OK && res) resolve(res);
      else resolve(null);
    });
  });
  if (!result?.routes?.length) return null;
  const route = result.routes[0];
  const leg = route.legs?.[0];
  if (!leg) return null;

  const path = (route.overview_path || []).map((p) => ({ lat: p.lat(), lng: p.lng() }));
  if (path.length < 2) return null;

  const duration = leg.duration!;
  const inTraffic = leg.duration_in_traffic;

  return {
    path,
    durationText: duration.text,
    durationSeconds: duration.value,
    durationInTrafficText: inTraffic?.text,
    durationInTrafficSeconds: inTraffic?.value,
    distanceText: leg.distance?.text ?? '',
    copyrights: route.copyrights ?? '',
  };
}

/**
 * Straßenroute: zuerst neue Routes API, bei Fehler (z. B. 403) Fallback auf Legacy Directions.
 *
 * Google Cloud (eines davon muss zum Key passen):
 * - „Routes API“ für computeRoutes, oder
 * - „Directions API“ (Legacy) für den Fallback
 * Zusätzlich: Maps JavaScript API, Abrechnung aktiv, API-Key ggf. um diese APIs erweitern.
 */
export async function fetchDrivingRoute(
  origin: google.maps.LatLngLiteral,
  destination: google.maps.LatLngLiteral,
  scheduledStart?: Date | null,
): Promise<DrivingRouteInfo | null> {
  if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) return null;

  try {
    const primary = await fetchDrivingRouteComputeRoutes(origin, destination, scheduledStart);
    if (primary) return primary;
  } catch {
    /* 403 / Netzwerk: Fallback */
  }

  try {
    return await fetchDrivingRouteDirectionsLegacy(origin, destination, scheduledStart);
  } catch {
    return null;
  }
}

/** Google Maps Navigation (externe App / Web). */
export function buildGoogleMapsNavigationUrl(
  origin: google.maps.LatLngLiteral,
  destination: google.maps.LatLngLiteral,
): string {
  const o = `${origin.lat},${origin.lng}`;
  const d = `${destination.lat},${destination.lng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(o)}&destination=${encodeURIComponent(d)}&travelmode=driving`;
}
