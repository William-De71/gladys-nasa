// -----------------------------------------------------------------------------
// The natural events of EONET v3 (NASA Earth Observatory Natural Event
// Tracker), near a house.
//
// An event has categories (`wildfires`, `severeStorms`…), sources (GDACS,
// IRWIN, JTWC…) and geometries: Points (a fire, the track of a storm, one per
// date) or Polygons (the area of a flood). Its position is the last geometry;
// its date, the last geometry date. Its distance to a house: 0 inside a
// polygon, else the distance to the nearest vertex (a few kilometres of
// error at most on the outline of a flood, enough for a radius of 100 km or
// more). Floods and earthquakes are often `closed` the day they appear: they
// still count while their last date is within the period.
// -----------------------------------------------------------------------------

const CATEGORIES = [
  'drought',
  'dustHaze',
  'earthquakes',
  'floods',
  'landslides',
  'manmade',
  'seaLakeIce',
  'severeStorms',
  'snow',
  'tempExtremes',
  'volcanoes',
  'waterColor',
  'wildfires',
];
const EARTH_RADIUS_KM = 6371;
const KM_PER_DEGREE = (Math.PI * EARTH_RADIUS_KM) / 180;
// Shown and kept per house: the nearest ones.
const MAX_EVENTS = 30;

const rad = (degrees) => (degrees * Math.PI) / 180;

/**
 * @description The great-circle distance between two points.
 * @param {number} lat1 - Latitude.
 * @param {number} lon1 - Longitude.
 * @param {number} lat2 - Latitude.
 * @param {number} lon2 - Longitude.
 * @returns {number} In km.
 */
function distanceKm(lat1, lon1, lat2, lon2) {
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * @description The bounding box of a circle, for the `bbox` of EONET:
 * `[west, north, east, south]`, clamped to the map (a box crossing the
 * antimeridian is cut there: the distance filter does the rest).
 * @param {object} house - `{ latitude, longitude }`.
 * @param {number} radiusKm - The radius.
 * @returns {number[]} The box.
 */
function boundingBox(house, radiusKm) {
  const dLat = radiusKm / KM_PER_DEGREE;
  const north = Math.min(90, house.latitude + dLat);
  const south = Math.max(-90, house.latitude - dLat);
  const widest = Math.max(Math.abs(north), Math.abs(south));
  const cos = Math.cos(rad(Math.min(widest, 89)));
  const dLon = widest >= 89 ? 180 : Math.min(180, radiusKm / (KM_PER_DEGREE * cos));
  return [
    Math.max(-180, house.longitude - dLon),
    north,
    Math.min(180, house.longitude + dLon),
    south,
  ];
}

/**
 * @description Whether a point is inside a ring (ray casting, degrees).
 * @param {number} lat - Latitude.
 * @param {number} lon - Longitude.
 * @param {number[][]} ring - `[[lon, lat], …]`.
 * @returns {boolean} True inside.
 */
function insideRing(lat, lon, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * @description The distance from a house to a geometry.
 * @param {object} house - `{ latitude, longitude }`.
 * @param {object} geometry - `{ type, coordinates }`.
 * @returns {number|null} In km, null when unreadable.
 */
function distanceTo(house, geometry) {
  const points = [];
  if (geometry?.type === 'Point' && Array.isArray(geometry.coordinates)) {
    points.push(geometry.coordinates);
  } else if (geometry?.type === 'Polygon' && Array.isArray(geometry.coordinates)) {
    for (const ring of geometry.coordinates) {
      if (!Array.isArray(ring)) continue;
      const valid = ring.filter(
        (point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]),
      );
      if (valid.length >= 3 && insideRing(house.latitude, house.longitude, valid)) return 0;
      points.push(...valid);
    }
  }
  let best = null;
  for (const [lon, lat] of points) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const distance = distanceKm(house.latitude, house.longitude, lat, lon);
    if (best === null || distance < best) best = distance;
  }
  return best;
}

/**
 * @description Read an EONET answer into events.
 * @param {unknown} raw - The answer.
 * @returns {object[]|null} `[{ id, title, category, at, closed, geometry,
 * magnitude, unit, source, url }]`; null when not an answer.
 */
function parseEvents(raw) {
  if (!Array.isArray(raw?.events)) return null;
  const events = [];
  for (const event of raw.events) {
    const id = String(event?.id ?? '');
    const geometries = (Array.isArray(event?.geometry) ? event.geometry : [])
      .map((geometry) => ({ ...geometry, at: Date.parse(geometry?.date ?? '') }))
      .filter((geometry) => Number.isFinite(geometry.at))
      .sort((a, b) => a.at - b.at);
    const last = geometries[geometries.length - 1];
    if (!/^[\w-]+$/.test(id) || !last) continue;
    const category = (Array.isArray(event.categories) ? event.categories : [])
      .map((item) => String(item?.id ?? ''))
      .find((item) => CATEGORIES.includes(item));
    const source = Array.isArray(event.sources) ? event.sources[0] : null;
    const sourceUrl = String(source?.url ?? '');
    const magnitude = Number(last.magnitudeValue);
    events.push({
      id,
      // The GDACS titles end with their own number: "Flood in France 1104243".
      title: String(event.title ?? id)
        .replace(/\s+\d{6,}$/, '')
        .trim()
        .slice(0, 100),
      category: category ?? 'other',
      at: last.at,
      closed: Boolean(event.closed),
      geometry: { type: last.type, coordinates: last.coordinates },
      // A storm moves: every point of its track counts for the distance.
      track:
        geometries.length > 1
          ? geometries.map(({ type, coordinates }) => ({ type, coordinates }))
          : null,
      magnitude: Number.isFinite(magnitude) && last.magnitudeValue !== null ? magnitude : null,
      unit: last.magnitudeUnit ? String(last.magnitudeUnit).slice(0, 10) : null,
      source: source?.id ? String(source.id).slice(0, 20) : null,
      url: /^https:\/\//.test(sourceUrl) ? sourceUrl.slice(0, 500) : null,
    });
  }
  return events;
}

/**
 * @description The events near a house, the nearest first.
 * @param {object[]} events - parseEvents().
 * @param {object} house - `{ latitude, longitude }`.
 * @param {object} options - `{ radiusKm, since }`.
 * @returns {object[]} The events with `distance` (km), MAX_EVENTS at most.
 */
function eventsNear(events, house, { radiusKm, since }) {
  const near = [];
  for (const event of events ?? []) {
    if (event.at < since) continue;
    const geometries = event.track ?? [event.geometry];
    const distances = geometries
      .map((geometry) => distanceTo(house, geometry))
      .filter((distance) => distance !== null);
    if (!distances.length) continue;
    const distance = Math.min(...distances);
    if (distance <= radiusKm) {
      // Kept in /data: no geometry (a flood outline weighs tens of kilobytes).
      near.push({
        id: event.id,
        title: event.title,
        category: event.category,
        at: event.at,
        closed: event.closed,
        magnitude: event.magnitude,
        unit: event.unit,
        source: event.source,
        url: event.url,
        distance: Math.round(distance),
      });
    }
  }
  return near.sort((a, b) => a.distance - b.distance || b.at - a.at).slice(0, MAX_EVENTS);
}

export { CATEGORIES, MAX_EVENTS, distanceKm, boundingBox, distanceTo, parseEvents, eventsNear };
