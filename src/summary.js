// -----------------------------------------------------------------------------
// What the scenes receive: the outputs of the scene actions, the payloads of
// the scene triggers, and their sentences ready to send (in the language of
// the configuration: Gladys does not give the user's one to scenes).
//
// Every payload is flat (scalars only, 30 keys at most, strings under 1,000
// characters); every key is declared in the manifest.
// -----------------------------------------------------------------------------

import { t, formatNumber } from './i18n.js';
import { formatTime, formatDate } from './time.js';
import { diameterRange } from './neo.js';

const SCENE_ACTIONS = {
  GET_ASTEROIDS: 'get_asteroids',
  GET_NATURAL_EVENTS: 'get_natural_events',
  GET_EARTH_IMAGE: 'get_earth_image',
};
const ASTEROID_OUTPUTS = [
  'approaches',
  'hazardous',
  'closest_name',
  'closest_date',
  'closest_distance_km',
  'closest_distance_lunar',
  'closest_diameter_m',
  'closest_velocity_kms',
  'closest_hazardous',
  'summary',
];
const EVENT_OUTPUTS = [
  'count',
  'house',
  'nearest_title',
  'nearest_category',
  'nearest_distance_km',
  'nearest_date',
  'summary',
];
const EARTH_OUTPUTS = ['image_url', 'date', 'centre_latitude', 'centre_longitude', 'summary'];

const round = (value, decimals = 0) =>
  Number.isFinite(value) ? Math.round(value * 10 ** decimals) / 10 ** decimals : null;

/**
 * @description The texts of an approach, in a language.
 * @param {object} approach - An approach (neo.js).
 * @param {object} options - `{ language, timeZone, now }`.
 * @returns {object} `{ name, date, km, lunar, kms, diameter }` as texts.
 */
function approachTexts(approach, { language, timeZone, now }) {
  return {
    name: approach.name,
    date: formatTime(approach.at, { language, timeZone, now }),
    km: formatNumber(Math.round(approach.km), language, 0),
    lunar: formatNumber(approach.lunar, language, approach.lunar < 10 ? 2 : 1),
    kms: formatNumber(approach.kms, language, 1),
    diameter: diameterRange(approach) || '?',
  };
}

/**
 * @description The outputs of "read the asteroids".
 * @param {object} week - weekOf() (neo.js).
 * @param {object} options - `{ language, timeZone, now }`.
 * @returns {object} The outputs.
 */
function asteroidOutputs(week, options) {
  const closest = week.closest;
  const texts = closest ? approachTexts(closest, options) : null;
  return {
    approaches: week.count,
    hazardous: week.hazardous,
    closest_name: closest?.name ?? '',
    closest_date: texts?.date ?? '',
    closest_distance_km: closest ? Math.round(closest.km) : null,
    closest_distance_lunar: closest ? round(closest.lunar, 2) : null,
    closest_diameter_m: texts?.diameter ?? '',
    closest_velocity_kms: closest ? round(closest.kms, 1) : null,
    closest_hazardous: closest ? closest.hazardous : false,
    summary: closest
      ? t('sentenceAsteroids', options.language, {
          count: week.count,
          hazardous: week.hazardous,
          ...texts,
        })
      : t('sentenceAsteroidsNone', options.language),
  };
}

/**
 * @description The payload of an asteroid trigger.
 * @param {string} key - The trigger.
 * @param {object} approach - The approach.
 * @param {object} options - `{ language, timeZone, now }`.
 * @returns {object} The flat payload.
 */
function asteroidData(key, approach, options) {
  const texts = approachTexts(approach, options);
  return {
    name: approach.name,
    date: texts.date,
    distance_km: Math.round(approach.km),
    distance_lunar: round(approach.lunar, 2),
    diameter_m: diameterRange(approach),
    velocity_kms: round(approach.kms, 1),
    hazardous: approach.hazardous,
    sentry: approach.sentry,
    url: approach.url,
    message: t(
      key === 'hazardous_asteroid' ? 'sentenceHazardous' : 'sentenceCloseApproach',
      options.language,
      texts,
    ).slice(0, 1000),
  };
}

/**
 * @description The label of an EONET category.
 * @param {string} category - The id.
 * @param {string} language - The language.
 * @returns {string} The label.
 */
const categoryLabel = (category, language) => t(`category_${category}`, language);

/**
 * @description The magnitude of an event: "65 kts", "982 acres".
 * @param {object} event - An event.
 * @param {string} language - The language.
 * @returns {string} The text, "" when none.
 */
function magnitudeText(event, language) {
  if (!Number.isFinite(event?.magnitude)) return '';
  const unit = { 'NM^2': 'NM²', kts: 'kt' }[event.unit] ?? event.unit ?? '';
  return `${formatNumber(event.magnitude, language, 1)} ${unit}`.trim();
}

/**
 * @description The outputs of "read the natural events near a house".
 * @param {object} house - The house.
 * @param {object[]} events - The events near it (eventsNear).
 * @param {object} options - `{ language, timeZone, radiusKm, eventDays }`.
 * @returns {object} The outputs.
 */
function eventOutputs(house, events, { language, timeZone, radiusKm, eventDays }) {
  const nearest = events[0] ?? null;
  const values = {
    count: events.length,
    house: house.name,
    radius: formatNumber(radiusKm, language, 0),
    days: eventDays,
  };
  return {
    count: events.length,
    house: house.name ?? '',
    nearest_title: nearest?.title ?? '',
    nearest_category: nearest ? categoryLabel(nearest.category, language) : '',
    nearest_distance_km: nearest ? nearest.distance : null,
    nearest_date: nearest ? formatDate(nearest.at, { language, timeZone }) : '',
    summary: nearest
      ? t('sentenceEvents', language, {
          ...values,
          title: nearest.title,
          category: categoryLabel(nearest.category, language),
          distance: formatNumber(nearest.distance, language, 0),
          date: formatDate(nearest.at, { language, timeZone }),
        })
      : t('sentenceEventsNone', language, values),
  };
}

/**
 * @description The payload of the natural event trigger.
 * @param {object} event - The event (eventsNear, with its distance).
 * @param {object} house - The house.
 * @param {object} options - `{ language, timeZone, device }`.
 * @returns {object} The flat payload.
 */
function naturalEventData(event, house, { language, timeZone, device }) {
  const date = formatDate(event.at, { language, timeZone });
  const category = categoryLabel(event.category, language);
  return {
    device,
    house: house.name ?? '',
    title: event.title,
    category: event.category,
    category_label: category,
    distance_km: event.distance,
    date,
    magnitude: Number.isFinite(event.magnitude) ? event.magnitude : null,
    magnitude_unit: event.unit ?? '',
    source: event.source ?? '',
    url: event.url ?? '',
    message: t('sentenceNaturalEvent', language, {
      category,
      title: event.title,
      distance: formatNumber(event.distance, language, 0),
      house: house.name ?? '',
      date,
    }).slice(0, 1000),
  };
}

/**
 * @description The outputs of "read the latest image of the Earth".
 * @param {object} image - The EPIC image.
 * @param {string} url - Its public URL.
 * @param {object} options - `{ language, timeZone, now }`.
 * @returns {object} The outputs.
 */
function earthOutputs(image, url, { language, timeZone }) {
  const date = `${formatDate(image.at, { language, timeZone })} ${formatTime(image.at, {
    language,
    timeZone,
    now: image.at,
  })}`;
  return {
    image_url: url,
    date,
    centre_latitude: round(image.lat, 2),
    centre_longitude: round(image.lon, 2),
    summary: t('sentenceEarth', language, {
      date,
      lat: formatNumber(image.lat, language, 1),
      lon: formatNumber(image.lon, language, 1),
    }),
  };
}

export {
  SCENE_ACTIONS,
  ASTEROID_OUTPUTS,
  EVENT_OUTPUTS,
  EARTH_OUTPUTS,
  approachTexts,
  asteroidOutputs,
  asteroidData,
  categoryLabel,
  magnitudeText,
  eventOutputs,
  naturalEventData,
  earthOutputs,
};
