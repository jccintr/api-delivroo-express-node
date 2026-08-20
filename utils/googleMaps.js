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

/**
 * Geocodifica um endereço em texto, retornando latitude/longitude (Geocoding API).
 * @param {string} address - endereço completo em texto
 * @param {object} [options]
 * @returns {Promise<{ latitude: number, longitude: number, formattedAddress: string } | null>}
 *          null quando o Google não encontra (ou encontra com baixa confiança)
 *          o endereço informado — nunca lança erro para esse caso, apenas
 *          para falhas de rede/config, para que quem chama possa decidir
 *          como tratar "endereço não encontrado" sem precisar de try/catch.
 */
export async function geocodeAddress(address, options = {}) {
  const { language = 'pt-BR', region = 'br' } = options;

  const params = new URLSearchParams({
    address,
    language,
    region,
    key: process.env.GOOGLE_MAPS_API_KEY,
  });

  const res = await fetch(`${GOOGLE_MAPS_BASE}/geocode/json?${params}`);
  const data = await res.json();

  if (data.status === 'ZERO_RESULTS') {
    return null;
  }

  if (data.status !== 'OK') {
    throw new Error(`Geocoding: ${data.status} ${data.error_message || ''}`.trim());
  }

  const result = data.results?.[0];
  if (!result?.geometry?.location) {
    return null;
  }

  // Endereços muito genéricos (ex: só a cidade) o Google ainda retorna OK,
  // mas com location_type APPROXIMATE — aceitamos, pois é melhor que nada,
  // mas quem chama pode inspecionar `partialMatch` se quiser ser mais rígido.
  return {
    latitude: result.geometry.location.lat,
    longitude: result.geometry.location.lng,
    formattedAddress: result.formatted_address,
    partialMatch: Boolean(result.partial_match),
  };
}