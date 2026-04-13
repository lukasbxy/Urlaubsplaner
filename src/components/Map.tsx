import React, { useEffect, useRef, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { TripItem } from '../types';

// Initialize Google Maps options once outside the component
setOptions({
  key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  v: 'weekly',
});

interface MapProps {
  items: TripItem[];
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
}

export function Map(props: MapProps) {
  const { items = [], selectedItemId = null, onSelectItem = () => {} } = props || {};
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);
  const markersRef = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new (window.Map as any)());
  const polylinesRef = useRef<Map<string, google.maps.Polyline>>(new (window.Map as any)());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  useEffect(() => {
    Promise.all([
      importLibrary('maps'),
      importLibrary('routes'),
      importLibrary('marker'),
      importLibrary('geometry')
    ]).then(([mapsLib]) => {
      if (mapRef.current && !map) {
        const newMap = new mapsLib.Map(mapRef.current, {
          center: { lat: 20, lng: 0 },
          zoom: 2,
          mapTypeId: 'roadmap',
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: false,
          mapId: 'DEMO_MAP_ID', // Required for AdvancedMarkerElement
        });
        setMap(newMap);

        const renderer = new google.maps.DirectionsRenderer({
          map: newMap,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: '#3b82f6',
            strokeWeight: 5,
            strokeOpacity: 0.7
          }
        });
        setDirectionsRenderer(renderer);
      }
    }).catch(e => {
      console.error("Google Maps failed to load", e);
    });
  }, []);

  useEffect(() => {
    if (!map) return;

    // Clear existing markers and polylines
    markersRef.current.forEach(m => m.map = null);
    markersRef.current.clear();
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current.clear();
    if (directionsRenderer) directionsRenderer.setDirections({ routes: [] } as any);

    const bounds = new google.maps.LatLngBounds();
    const directionsService = new google.maps.DirectionsService();

    items.forEach(async (item, index) => {
      if (item.lat !== undefined && item.lng !== undefined) {
        const pos = { lat: item.lat, lng: item.lng };
        bounds.extend(pos);

        // Create custom content for AdvancedMarkerElement
        const pinContent = document.createElement('div');
        pinContent.className = 'w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold border-2 border-white shadow-lg';
        // Use letters A, B, C... based on index
        pinContent.textContent = String.fromCharCode(65 + (index % 26));

        const marker = new google.maps.marker.AdvancedMarkerElement({
          position: pos,
          map,
          title: item.title,
          content: pinContent,
          zIndex: selectedItemId === item.id ? 1000 : 1,
        });

        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="padding: 4px; max-width: 250px; font-size: 12px; line-height: 1.4;">
              <div style="font-weight: bold; font-size: 14px; margin-bottom: 2px;">${item.title}</div>
              <div style="font-size: 10px; color: #666; text-transform: uppercase; margin-bottom: 6px;">${item.type}</div>
              
              ${item.startTime ? `<div style="margin-bottom: 2px;"><strong>Start:</strong> ${new Date(item.startTime).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</div>` : ''}
              ${item.endTime ? `<div style="margin-bottom: 2px;"><strong>Ende:</strong> ${new Date(item.endTime).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</div>` : ''}
              
              ${item.locationName ? `<div style="margin-top: 4px;"><strong>Von:</strong> ${item.locationName}</div>` : ''}
              ${item.endLocationName ? `<div><strong>Nach:</strong> ${item.endLocationName}</div>` : ''}
              
              ${item.description ? `<div style="margin-top: 6px; font-style: italic; color: #555;">${item.description}</div>` : ''}
              
              <div style="margin-top: 6px; display: flex; justify-content: space-between; border-top: 1px solid #eee; padding-top: 4px;">
                ${item.bookingReference ? `<div><strong>Ref:</strong> ${item.bookingReference}</div>` : '<div></div>'}
                ${item.cost ? `<div style="font-weight: bold; color: #10b981;">${item.cost}€</div>` : ''}
              </div>
            </div>
          `
        });

        marker.addListener('click', () => {
          if (infoWindowRef.current) infoWindowRef.current.close();
          infoWindow.open(map, marker);
          infoWindowRef.current = infoWindow;
          onSelectItem(item.id);
        });

        markersRef.current.set(item.id, marker);

        if (selectedItemId === item.id) {
          if (infoWindowRef.current) infoWindowRef.current.close();
          infoWindow.open(map, marker);
          infoWindowRef.current = infoWindow;
        }

        // Handle routes
        if (item.endLat !== undefined && item.endLng !== undefined) {
          const endPos = { lat: item.endLat, lng: item.endLng };
          bounds.extend(endPos);

          const endPin = document.createElement('div');
          endPin.className = 'w-3 h-3 bg-red-500 rounded-full border border-white shadow-sm';

          const endMarker = new google.maps.marker.AdvancedMarkerElement({
            position: endPos,
            map,
            title: `${item.title} (Ziel)`,
            content: endPin,
          });
          markersRef.current.set(item.id + '_end', endMarker);

          if (item.type === 'transport' || item.type === 'train') {
            // Use the new Routes API (computeRoutes) via the routes library
            const routesRequest = {
              origin: { location: { latLng: pos } },
              destination: { location: { latLng: endPos } },
              // @ts-ignore - Using string literals to avoid TS errors with newer API
              travelMode: item.type === 'train' ? 'TRANSIT' : 'DRIVE',
              // @ts-ignore
              polylineQuality: 'OVERVIEW',
            };

            try {
              // @ts-ignore - computeRoutes is the new recommended way
              if (google.maps.RoutesService) {
                // @ts-ignore
                const routesService = new google.maps.RoutesService();
                routesService.computeRoutes(routesRequest, (result: any, status: any) => {
                  if (status === 'OK' && result.routes && result.routes[0]) {
                    const polyline = new google.maps.Polyline({
                      path: google.maps.geometry.encoding.decodePath(result.routes[0].polyline.encodedPolyline),
                      strokeColor: selectedItemId === item.id ? '#3b82f6' : (item.type === 'train' ? '#8b5cf6' : '#10b981'),
                      strokeWeight: selectedItemId === item.id ? 6 : 4,
                      strokeOpacity: selectedItemId === item.id ? 1.0 : 0.8,
                      zIndex: selectedItemId === item.id ? 100 : 1,
                      map
                    });
                    polylinesRef.current.set(item.id + '_route', polyline);
                  }
                });
              } else {
                throw new Error("RoutesService not available");
              }
            } catch (e) {
              // Fallback to simple line if Routes API fails or is not yet fully available
              console.warn("Routes API failed, falling back to simple line", e);
              const fallbackPath = new google.maps.Polyline({
                path: [pos, endPos],
                strokeColor: selectedItemId === item.id ? '#3b82f6' : (item.type === 'train' ? '#8b5cf6' : '#10b981'),
                strokeWeight: selectedItemId === item.id ? 6 : 4,
                strokeOpacity: selectedItemId === item.id ? 1.0 : 0.5,
                zIndex: selectedItemId === item.id ? 100 : 1,
                map
              });
              polylinesRef.current.set(item.id + '_route', fallbackPath);
            }
          } else if (item.type === 'flight') {
            const flightPath = new google.maps.Polyline({
              path: [pos, endPos],
              geodesic: true,
              strokeColor: selectedItemId === item.id ? '#3b82f6' : '#ef4444',
              strokeOpacity: selectedItemId === item.id ? 1.0 : 0.8,
              strokeWeight: selectedItemId === item.id ? 5 : 3,
              zIndex: selectedItemId === item.id ? 100 : 1,
              map
            });
            polylinesRef.current.set(item.id + '_route', flightPath);
          }
        }
      }
    });

    if (items.length > 0 && !bounds.isEmpty()) {
      map.fitBounds(bounds);
    }
  }, [items, map, directionsRenderer, selectedItemId]);

  if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-muted text-muted-foreground p-8 text-center">
        <div>
          <p className="font-bold text-lg mb-2">Google Maps API Key Missing</p>
          <p>Please add VITE_GOOGLE_MAPS_API_KEY to your environment variables to see the interactive map and routes.</p>
        </div>
      </div>
    );
  }

  return <div ref={mapRef} style={{ height: '100%', width: '100%' }} />;
}
