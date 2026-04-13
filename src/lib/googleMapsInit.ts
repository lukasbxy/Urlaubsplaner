import { setOptions } from '@googlemaps/js-api-loader';

/**
 * Muss vor jedem importLibrary() nur einmal aufgerufen werden (siehe js-api-loader Warnung).
 */
setOptions({
  key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  v: 'weekly',
});
