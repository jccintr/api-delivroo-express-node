const GOOGLE_MAPS_BASE = 'https://maps.googleapis.com/maps/api';

/**
 * Distância e duração entre dois pontos (Distance Matrix API).
 * @param {string} origin - endereço, "lat,lng" ou place_id:xxx
 * @param {string} destination
 * @param {object} [options]
 * @returns {Promise<{ meters: number, seconds: number, distanceText: string, durationText: string }>}
 */
export async function distanceBetween(origin, destination, options = {}) {
  const {
    mode = 'driving',
    language = 'pt-BR',
    units = 'metric',
    departureTime, // 'now' ou timestamp
    avoid,
  } = options;

  const params = new URLSearchParams({
    origins: origin,
    destinations: destination,
    mode,
    language,
    units,
    key: process.env.GOOGLE_MAPS_API_KEY,
  });

  if (departureTime) params.set('departure_time', String(departureTime));
  if (avoid) params.set('avoid', avoid);

  const res = await fetch(`${GOOGLE_MAPS_BASE}/distancematrix/json?${params}`);
  const data = await res.json();

  if (data.status !== 'OK') {
    throw new Error(`Distance Matrix: ${data.status} ${data.error_message || ''}`.trim());
  }

  const element = data.rows?.[0]?.elements?.[0];
  if (!element || element.status !== 'OK') {
    throw new Error(`Distance Matrix element: ${element?.status || 'UNKNOWN'}`);
  }

  return {
    meters: element.distance.value,
    seconds: element.duration_in_traffic?.value ?? element.duration.value,
    distanceText: element.distance.text,
    durationText: (element.duration_in_traffic ?? element.duration).text,
    //meters: el.distance.value,
    //seconds: el.duration.value,
  };
}