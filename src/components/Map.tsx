import React, { useEffect, useMemo, useRef, useState } from 'react';
import { importLibrary } from '@googlemaps/js-api-loader';
import '../lib/googleMapsInit';
import { TripItem } from '../lib/supabase';
import { type DrivingRouteInfo, buildGoogleMapsNavigationUrl } from '../lib/drivingDirections';

interface MapProps {
  items: TripItem[];
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
  /** Berechnete Straßenrouten für Transport (Auto), Keys = item.id */
  transportRoutes?: Record<string, DrivingRouteInfo | undefined>;
}

/* ── Design tokens (hex approximations of the app's palette) ── */
const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  location:      { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
  flight:        { bg: '#ede9fe', text: '#6d28d9', border: '#c4b5fd' },
  accommodation: { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
  activity:      { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  transport:     { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' },
  train:         { bg: '#dcfce7', text: '#166534', border: '#86efac' },
};
const TYPE_ICONS: Record<string, string> = {
  location:      `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
  flight:        `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>`,
  accommodation: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2H6a2 2 0 0 0-2 2v18"/><path d="M9 16v5"/><path d="M15 16v5"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/><path d="M2 22h20"/></svg>`,
  activity:      `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
  transport:     `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A1.7 1.7 0 0 0 2 12c0 1 .8 1.8 1.8 1.8h1.5"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>`,
  train:         `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="m8 19-2 3"/><path d="m18 22-2-3"/><path d="M8 15h.01"/><path d="M16 15h.01"/></svg>`,
};

/** Farbe pro Spur: Farbwinkel per goldenem Winkel (~137,5°), damit benachbarte Routen klar unterscheidbar sind. */
function transportStrokeColorForLane(lane: number): string {
  const hue = (lane * 137.508) % 360;
  return `hsl(${Math.round(hue)}, 76%, 43%)`;
}

/** Abstand zwischen zwei „Spuren“ in Metern (sichtbar auch bei gemeinsamen Straßenabschnitten). */
const TRANSPORT_LANE_OFFSET_METERS = 7;

function ll(p: google.maps.LatLngLiteral): google.maps.LatLng {
  return new google.maps.LatLng(p.lat, p.lng);
}

/** Mittlerer Kurs zweier Richtungen (Grad), für stabilere Querrichtung in Kurven. */
function averageHeadingDeg(a: number, b: number): number {
  const r1 = (a * Math.PI) / 180;
  const r2 = (b * Math.PI) / 180;
  const x = Math.cos(r1) + Math.cos(r2);
  const y = Math.sin(r1) + Math.sin(r2);
  const ang = Math.atan2(y, x) * (180 / Math.PI);
  return ang < 0 ? ang + 360 : ang;
}

/** Polylinie senkrecht zur Fahrtrichtung verschieben (Innenpunkte: Mittel aus Ein-/Ausfahrtsrichtung). */
function offsetPolylineMeters(
  path: google.maps.LatLngLiteral[],
  offsetMeters: number,
): google.maps.LatLngLiteral[] {
  if (path.length < 2 || offsetMeters === 0) return path;
  const spherical = google.maps.geometry.spherical;
  const n = path.length;
  const out: google.maps.LatLngLiteral[] = [];

  for (let i = 0; i < n; i++) {
    let headingDeg: number;
    if (n === 2) {
      headingDeg = spherical.computeHeading(ll(path[0]), ll(path[1]));
    } else if (i === 0) {
      headingDeg = spherical.computeHeading(ll(path[0]), ll(path[1]));
    } else if (i === n - 1) {
      headingDeg = spherical.computeHeading(ll(path[i - 1]), ll(path[i]));
    } else {
      const hIn = spherical.computeHeading(ll(path[i - 1]), ll(path[i]));
      const hOut = spherical.computeHeading(ll(path[i]), ll(path[i + 1]));
      headingDeg = averageHeadingDeg(hIn, hOut);
    }
    const perp = headingDeg + (offsetMeters >= 0 ? 90 : -90);
    const o = spherical.computeOffset(ll(path[i]), Math.abs(offsetMeters), perp);
    out.push({ lat: o.lat(), lng: o.lng() });
  }
  return out;
}

/** Slightly offset markers that share the same lat/lng so they don't stack invisibly */
/** 
 * No longer used for exact overlaps as we now group markers into a single container.
 * Still kept for very minor adjustments if needed in future.
 */
function jitterPosition(lat: number, lng: number): { lat: number; lng: number } {
  return { lat, lng };
}

/** Build a clean, styled marker pin element */
function buildPinEl(
  type: string,
  isSelected: boolean,
  isEndPoint = false,
  seq?: number,
): HTMLElement {
  if (isEndPoint) {
    const el = document.createElement('div');
    el.style.cssText = `
      width:10px; height:10px; border-radius:50%;
      background:#64748b; border:2px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,0.25);
      transition: transform 0.15s;
    `;
    return el;
  }

  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    display:flex; flex-direction:column; align-items:center;
    cursor:pointer; transition:transform 0.15s;
    ${isSelected ? 'transform:scale(1.15)' : ''}
  `;

  const bubble = document.createElement('div');
  bubble.style.cssText = `
    display:flex; align-items:center; justify-content:center;
    width:28px; height:28px; border-radius:50%;
    background:${isSelected ? '#1e293b' : 'white'};
    color:${isSelected ? 'white' : '#1e293b'};
    font-size:14px;
    box-shadow:${isSelected
      ? '0 4px 16px rgba(0,0,0,0.25), 0 0 0 2px #1e293b'
      : '0 2px 8px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)'
    };
    transition:all 0.15s;
    position: relative;
  `;
  bubble.innerHTML = TYPE_ICONS[type] || TYPE_ICONS.location;

  // Add sequence badge if provided
  if (seq != null && !isEndPoint) {
    const colors = TYPE_COLORS[type] || TYPE_COLORS.location;
    const badge = document.createElement('div');
    badge.style.cssText = `
      position:absolute; top:-4px; right:-4px;
      width:14px; height:14px; border-radius:50%;
      background:${isSelected ? colors.border : '#64748b'}; color:white;
      font-size:8px; font-weight:800;
      display:flex; align-items:center; justify-content:center;
      border:1.5px solid white;
    `;
    badge.textContent = seq.toString();
    bubble.appendChild(badge);
  }

  wrapper.appendChild(bubble);

  // Tail
  const tail = document.createElement('div');
  tail.style.cssText = `
    width:0; height:0;
    border-left:5px solid transparent;
    border-right:5px solid transparent;
    border-top:5px solid ${isSelected ? '#1e293b' : 'white'};
    margin-top:-1px;
    filter:drop-shadow(0 1px 1px rgba(0,0,0,0.10));
  `;
  wrapper.appendChild(tail);

  return wrapper;
}

/** Build a container for multiple icons at the same spot */
function buildGroupedPinEl(
  group: { item: TripItem; isSelected: boolean; seq: number }[],
  onSelect: (id: string) => void,
): HTMLElement {
  const container = document.createElement('div');
  container.style.cssText = `
    display:flex; flex-direction:column; align-items:center;
    cursor:pointer; transition:transform 0.15s;
    transform: translateY(-5px);
  `;

  const row = document.createElement('div');
  row.style.cssText = `
    display:flex; gap:3px; padding:3px;
    background:white; border-radius:20px;
    box-shadow:0 4px 12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05);
  `;

  group.forEach(({ item, isSelected, seq }) => {
    const iconBtn = document.createElement('div');
    const colors = TYPE_COLORS[item.type] || TYPE_COLORS.location;
    iconBtn.style.cssText = `
      width:28px; height:28px; border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      background:${isSelected ? '#1e293b' : 'white'};
      color:${isSelected ? 'white' : colors.text};
      box-shadow:${isSelected ? '0 0 0 2px #1e293b' : 'none'};
      transition: all 0.15s;
      position: relative;
    `;
    iconBtn.innerHTML = TYPE_ICONS[item.type] || TYPE_ICONS.location;
    
    // Add sequence number badge for clarity
    const badge = document.createElement('div');
    badge.style.cssText = `
      position:absolute; top:-4px; right:-4px;
      width:14px; height:14px; border-radius:50%;
      background:${isSelected ? colors.border : '#64748b'}; color:white;
      font-size:8px; font-weight:800;
      display:flex; align-items:center; justify-content:center;
      border:1.5px solid white;
    `;
    badge.textContent = seq.toString();
    iconBtn.appendChild(badge);

    iconBtn.onclick = (e) => {
      e.stopPropagation();
      onSelect(item.id);
    };
    row.appendChild(iconBtn);
  });

  container.appendChild(row);

  const tail = document.createElement('div');
  tail.style.cssText = `
    width:0; height:0;
    border-left:6px solid transparent;
    border-right:6px solid transparent;
    border-top:6px solid white;
    margin-top:-1px;
    filter:drop-shadow(0 2px 2px rgba(0,0,0,0.1));
  `;
  container.appendChild(tail);

  return container;
}

/** Build the HTML content for an InfoWindow */
function buildInfoWindowContent(item: TripItem, sequenceNumber: number): string {
  const colors = TYPE_COLORS[item.type] || TYPE_COLORS.location;
  const iconSvg = TYPE_ICONS[item.type] || TYPE_ICONS.location;

  const formatDT = (dt: string) =>
    new Date(dt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
  const formatD = (dt: string) =>
    new Date(dt).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

  const dateStr = item.is_all_day
    ? (item.start_time ? formatD(item.start_time) : '')
    : item.start_time ? formatDT(item.start_time) : '';
  const dateEndStr = item.is_all_day
    ? (item.end_time ? formatD(item.end_time) : '')
    : item.end_time ? formatDT(item.end_time) : '';

  const rows: string[] = [];
  if (dateStr) rows.push(`
    <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:2px">
      <span style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.05em;width:30px;flex-shrink:0">Start</span>
      <span style="color:#0f172a;font-size:11px">${dateStr}</span>
    </div>`);
  if (dateEndStr && dateEndStr !== dateStr) rows.push(`
    <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:2px">
      <span style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.05em;width:30px;flex-shrink:0">Ende</span>
      <span style="color:#0f172a;font-size:11px">${dateEndStr}</span>
    </div>`);
  if (item.location_name) rows.push(`
    <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:2px">
      <span style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.05em;width:30px;flex-shrink:0">Von</span>
      <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location_name)}" target="_blank" style="color:#0f172a;font-size:11px;text-decoration:none;border-bottom:1px solid rgba(15,23,42,0.15)">${item.location_name}</a>
    </div>`);
  if (item.end_location_name) rows.push(`
    <div style="display:flex;align-items:baseline;gap:6px">
      <span style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.05em;width:30px;flex-shrink:0">Nach</span>
      <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.end_location_name)}" target="_blank" style="color:#0f172a;font-size:11px;text-decoration:none;border-bottom:1px solid rgba(15,23,42,0.15)">${item.end_location_name}</a>
    </div>`);

  if (
    item.type === 'transport' &&
    typeof item.lat === 'number' &&
    typeof item.lng === 'number' &&
    typeof item.end_lat === 'number' &&
    typeof item.end_lng === 'number'
  ) {
    const navUrl = buildGoogleMapsNavigationUrl(
      { lat: item.lat, lng: item.lng },
      { lat: item.end_lat, lng: item.end_lng },
    );
    rows.push(`
    <div style="margin-top:8px;padding-top:8px;border-top:1px solid #f1f5f9">
      <a href="${navUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:4px;color:#9d174d;font-size:11px;font-weight:600;text-decoration:none">
        Navigation in Google Maps
      </a>
    </div>`);
  }

  const footer: string[] = [];
  if (item.booking_reference) footer.push(`<span style="color:#475569;font-size:10px">Ref: ${item.booking_reference}</span>`);
  if (item.cost) footer.push(`<span style="font-weight:700;color:#059669;font-size:11px">${item.cost.toFixed(2)} €</span>`);

  return `
    <div style="
      font-family:-apple-system,system-ui,sans-serif;
      min-width:200px; max-width:260px;
      padding:0; border-radius:12px; overflow:hidden;
    ">
      <!-- Header -->
      <div style="
        background:${colors.bg};
        padding:10px 12px 8px;
        border-bottom:1px solid ${colors.border};
      ">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
          <div style="
            width:18px; height:18px; border-radius:50%;
            background:${colors.text}; color:white;
            display:flex;align-items:center;justify-content:center;
            font-size:9px;font-weight:800;flex-shrink:0
          ">${sequenceNumber}</div>
          <div style="color:${colors.text};display:flex;align-items:center">${iconSvg}</div>
        </div>
        <div style="font-size:13px;font-weight:700;color:#0f172a;line-height:1.3">${item.title}</div>
      </div>
      <!-- Body -->
      ${rows.length ? `<div style="padding:10px 12px 8px;background:#ffffff">${rows.join('')}</div>` : ''}
      <!-- Footer -->
      ${footer.length ? `
        <div style="
          padding:6px 12px;background:#f8fafc;
          border-top:1px solid #f1f5f9;
          display:flex;justify-content:space-between;align-items:center;
        ">${footer.join('')}</div>
      ` : ''}
    </div>
  `;
}

export function Map(props: MapProps) {
  const { items = [], selectedItemId = null, onSelectItem = () => {}, transportRoutes = {} } = props || {};
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const markersRef = useRef<globalThis.Map<string, google.maps.marker.AdvancedMarkerElement>>(new globalThis.Map());
  const polylinesRef = useRef<globalThis.Map<string, google.maps.Polyline>>(new globalThis.Map());
  const activeInfoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  /* ── Init map ── */
  useEffect(() => {
    Promise.all([
      importLibrary('maps'),
      importLibrary('marker'),
      importLibrary('geometry'),
    ]).then(([mapsLib]) => {
      if (!mapRef.current || map) return;
      const newMap = new mapsLib.Map(mapRef.current, {
        center: { lat: 48, lng: 14 },
        zoom: 5,
        mapId: 'DEMO_MAP_ID',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
      });
      setMap(newMap);
    }).catch(e => console.error('Google Maps failed to load', e));
  }, []);

  const directionsCopyrights = useMemo(() => {
    const parts = new Set<string>();
    for (const item of items) {
      if (item.type !== 'transport') continue;
      const c = transportRoutes[item.id]?.copyrights;
      if (c) parts.add(c);
    }
    return [...parts].join(' ');
  }, [items, transportRoutes]);

  /* ── Draw markers + lines ── */
  useEffect(() => {
    if (!map) return;

    // Clear
    markersRef.current.forEach(m => (m.map = null));
    markersRef.current.clear();
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current.clear();
    if (activeInfoWindowRef.current) { activeInfoWindowRef.current.close(); activeInfoWindowRef.current = null; }

    const bounds = new google.maps.LatLngBounds();

    const transportLane = new globalThis.Map<string, number>();
    const transportOrdered = items.filter(
      (i) =>
        i.type === 'transport' &&
        typeof i.lat === 'number' &&
        typeof i.lng === 'number' &&
        typeof i.end_lat === 'number' &&
        typeof i.end_lng === 'number' &&
        !Number.isNaN(i.lat) &&
        !Number.isNaN(i.lng) &&
        !Number.isNaN(i.end_lat) &&
        !Number.isNaN(i.end_lng),
    );
    transportOrdered.forEach((it, lane) => transportLane.set(it.id, lane));
    const nTransport = transportOrdered.length;
    
    // ── Group markers by location ──
    const groups = new globalThis.Map<string, { item: TripItem; seq: number }[]>();
    items.forEach((item, index) => {
      const lat = item.lat, lng = item.lng;
      if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
        const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push({ item, seq: index + 1 });
      }
    });

    // ── Process Groups ──
    const allPositioned: { item: TripItem; pos: { lat: number; lng: number } }[] = [];
    
    groups.forEach((groupItems, key) => {
      const [latStr, lngStr] = key.split(',');
      const pos = { lat: parseFloat(latStr), lng: parseFloat(lngStr) };
      bounds.extend(pos);

      const hasSelected = groupItems.some(g => g.item.id === selectedItemId);
      const isSingle = groupItems.length === 1;

      // Build Marker (Shared for the location)
      const pinEl = isSingle 
        ? buildPinEl(groupItems[0].item.type, groupItems[0].item.id === selectedItemId, false, groupItems[0].seq)
        : buildGroupedPinEl(groupItems.map(g => ({ ...g, isSelected: g.item.id === selectedItemId })), onSelectItem);

      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: pos,
        map,
        title: isSingle ? groupItems[0].item.title : `${groupItems.length} Einträge`,
        content: pinEl,
        zIndex: hasSelected ? 1000 : groupItems[0].seq,
      });

      // Handle items in this group
      groupItems.forEach(({ item, seq }) => {
        allPositioned.push({ item, pos });
        const isItemSelected = selectedItemId === item.id;
        
        const infoWindow = new google.maps.InfoWindow({
          content: buildInfoWindowContent(item, seq),
          pixelOffset: new google.maps.Size(0, isSingle ? -8 : -12),
          disableAutoPan: false,
        });

        if (isSingle) {
          marker.addListener('gmp-click', () => {
            if (activeInfoWindowRef.current) activeInfoWindowRef.current.close();
            infoWindow.open({ map, anchor: marker });
            activeInfoWindowRef.current = infoWindow;
            onSelectItem(item.id);
          });
        }

        markersRef.current.set(item.id, marker);

        if (isItemSelected) {
          if (activeInfoWindowRef.current) activeInfoWindowRef.current.close();
          infoWindow.open({ map, anchor: marker });
          activeInfoWindowRef.current = infoWindow;
        }

        // ── Route / end-point rendering ──
        const endLat = item.end_lat, endLng = item.end_lng;
        if (typeof endLat === 'number' && typeof endLng === 'number' && !isNaN(endLat) && !isNaN(endLng)) {
          const rawEnd = { lat: endLat, lng: endLng };
          bounds.extend(rawEnd);

          const endEl = buildPinEl(item.type, false, true);
          const endMarker = new google.maps.marker.AdvancedMarkerElement({
            position: rawEnd,
            map,
            title: `${item.title} → Ziel`,
            content: endEl,
            zIndex: 0,
          });
          markersRef.current.set(item.id + '_end', endMarker);

          if (item.type === 'flight') {
            const arc = new google.maps.Polyline({
              path: [pos, rawEnd],
              geodesic: true,
              strokeColor: isItemSelected ? '#4c1d95' : '#7c3aed',
              strokeWeight: isItemSelected ? 3.5 : 2,
              strokeOpacity: 0.35,
              icons: [
                {
                  icon: {
                    path: 'M 0,-1 0,1',
                    strokeOpacity: 1,
                    strokeWeight: isItemSelected ? 5 : 3.5,
                    scale: 3,
                    strokeColor: isItemSelected ? '#4c1d95' : '#7c3aed',
                  },
                  offset: '0',
                  repeat: '16px',
                },
                {
                  icon: { 
                    path: google.maps.SymbolPath.FORWARD_OPEN_ARROW, 
                    strokeColor: isItemSelected ? '#4c1d95' : '#7c3aed', 
                    scale: 3, 
                    strokeWeight: 2 
                  },
                  repeat: '120px',
                  offset: '50%',
                }
              ],
              zIndex: isItemSelected ? 50 : 5,
              map,
            });
            polylinesRef.current.set(item.id + '_route', arc);

          } else if (item.type === 'train') {
            const line = new google.maps.Polyline({
              path: [pos, rawEnd],
              strokeColor: isItemSelected ? '#166534' : '#15803d',
              strokeWeight: isItemSelected ? 5 : 3.5,
              strokeOpacity: 0.85,
              zIndex: isItemSelected ? 50 : 5,
              icons: [{
                icon: { 
                  path: google.maps.SymbolPath.FORWARD_OPEN_ARROW, 
                  strokeColor: isItemSelected ? '#166534' : '#15803d', 
                  scale: 2.5, 
                  strokeWeight: 2 
                },
                repeat: '60px',
                offset: '50%',
              }],
              map,
            });
            polylinesRef.current.set(item.id + '_route', line);

          } else if (item.type === 'transport') {
            const lane = transportLane.get(item.id) ?? 0;
            const offsetMeters =
              nTransport > 1 ? (lane - (nTransport - 1) / 2) * TRANSPORT_LANE_OFFSET_METERS : 0;
            const baseColor = transportStrokeColorForLane(lane);
            const roadPath = transportRoutes[item.id]?.path;
            if (roadPath && roadPath.length >= 2) {
              const drawPath = offsetMeters !== 0 ? offsetPolylineMeters(roadPath, offsetMeters) : roadPath;
              drawPath.forEach((p) => bounds.extend(p));
              const line = new google.maps.Polyline({
                path: drawPath,
                strokeColor: baseColor,
                strokeWeight: isItemSelected ? 6 : 4,
                strokeOpacity: isItemSelected ? 0.98 : 0.9,
                zIndex: isItemSelected ? 50 + lane : 5 + lane,
                map,
              });
              polylinesRef.current.set(item.id + '_route', line);
            } else {
              const rawPath = [pos, rawEnd];
              const drawPath = offsetMeters !== 0 ? offsetPolylineMeters(rawPath, offsetMeters) : rawPath;
              const line = new google.maps.Polyline({
                path: drawPath,
                strokeColor: baseColor,
                strokeWeight: isItemSelected ? 6 : 4,
                strokeOpacity: 0.88,
                zIndex: isItemSelected ? 50 + lane : 5 + lane,
                icons: [{
                  icon: {
                    path: google.maps.SymbolPath.FORWARD_OPEN_ARROW,
                    strokeColor: baseColor,
                    scale: 2.5,
                    strokeWeight: 2,
                  },
                  repeat: '60px',
                  offset: '50%',
                }],
                map,
              });
              polylinesRef.current.set(item.id + '_route', line);
            }
          }
        }
      });
    });

    if (!bounds.isEmpty()) {
      const singlePoint = allPositioned.length === 1 && !allPositioned[0].item.end_lat;
      if (singlePoint) {
        map.setCenter(bounds.getCenter());
        map.setZoom(12);
      } else {
        map.fitBounds(bounds, { top: 60, right: 32, bottom: 32, left: 32 });
      }
    }
  }, [items, map, selectedItemId, transportRoutes]);

  if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-muted text-muted-foreground p-8 text-center">
        <div>
          <p className="font-semibold mb-1">Google Maps API Key fehlt</p>
          <p className="text-sm">VITE_GOOGLE_MAPS_API_KEY in .env hinzufügen.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
      {directionsCopyrights ? (
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 max-h-16 overflow-hidden px-2 py-1.5 text-center text-[9px] leading-tight text-foreground/50 bg-gradient-to-t from-background/90 to-transparent"
          title={directionsCopyrights}
        >
          {directionsCopyrights}
        </div>
      ) : null}
    </div>
  );
}
