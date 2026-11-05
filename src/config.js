// -----------------------------------------------------------------------------
// Configuration of the NASA integration.
//
// Fields of the config_schema:
//   - `api_key`          a free key of api.nasa.gov (secret, optional): without
//                        it, the shared DEMO_KEY (10 requests an hour per IP);
//   - `language`         language of the texts Gladys does not ask for in a
//                        language (device and feature names, scene texts):
//                        `auto` follows the language of the last widget, or
//                        the timezone;
//   - `radius_km`        how far from a house a natural event counts;
//   - `event_days`       how recent a natural event must be to count;
//   - `lunar_threshold`  an asteroid passing closer than this many lunar
//                        distances fires the close-approach trigger.
// The three last ones are selects: a number field may refuse to be typed in
// some versions of the core, and the triggers only compare by equality.
//
// Internal key, outside the config_schema (never shown in the UI):
//   - `last_language` language of the last widget request.
// -----------------------------------------------------------------------------

import { isLanguage } from './i18n.js';

const AUTO_LANGUAGE = 'auto';
const INTERNAL_KEYS = { language: 'last_language' };
const RADII = ['100', '250', '500', '1000', '2000'];
const DEFAULT_RADIUS = '500';
const EVENT_DAYS = ['7', '14', '30'];
const DEFAULT_EVENT_DAYS = '14';
const LUNAR_THRESHOLDS = ['1', '2', '5', '10', '20'];
const DEFAULT_LUNAR_THRESHOLD = '5';

/**
 * @description One of the values of a select, else its default.
 * @param {unknown} value - The raw value.
 * @param {string[]} values - The allowed values.
 * @param {string} fallback - The default.
 * @returns {number} The value, as a number.
 */
function choice(value, values, fallback) {
  const text = String(value ?? '').trim();
  return Number(values.includes(text) ? text : fallback);
}

/**
 * @description Normalize the raw config object from the host API.
 * @param {object} [rawConfig] - The raw config values.
 * @returns {{ apiKey: string, language: string, radiusKm: number, eventDays: number, lunarThreshold: number }} The configuration.
 * @example
 * normalizeConfig({ radius_km: '250' }).radiusKm; // -> 250
 */
function normalizeConfig(rawConfig = {}) {
  const config = rawConfig ?? {};
  const apiKey = typeof config.api_key === 'string' ? config.api_key.trim() : '';
  return {
    apiKey: /^[A-Za-z0-9_-]{8,128}$/.test(apiKey) ? apiKey : '',
    language: isLanguage(config.language) ? config.language : AUTO_LANGUAGE,
    radiusKm: choice(config.radius_km, RADII, DEFAULT_RADIUS),
    eventDays: choice(config.event_days, EVENT_DAYS, DEFAULT_EVENT_DAYS),
    lunarThreshold: choice(config.lunar_threshold, LUNAR_THRESHOLDS, DEFAULT_LUNAR_THRESHOLD),
  };
}

// The timezones of the countries that speak the languages of the integration:
// the automatic language before any widget was shown.
const TIMEZONE_LANGUAGES = {
  fr: [
    'Europe/Paris',
    'Europe/Monaco',
    'Europe/Brussels',
    'Europe/Luxembourg',
    'Indian/Reunion',
    'Indian/Mayotte',
    'America/Guadeloupe',
    'America/Martinique',
    'America/Cayenne',
    'America/Miquelon',
    'Pacific/Noumea',
    'Pacific/Tahiti',
    'America/Montreal',
    'Africa/Abidjan',
    'Africa/Dakar',
    'Africa/Casablanca',
    'Africa/Algiers',
    'Africa/Tunis',
  ],
  de: ['Europe/Berlin', 'Europe/Busingen', 'Europe/Vienna', 'Europe/Zurich', 'Europe/Vaduz'],
  es: [
    'Europe/Madrid',
    'Atlantic/Canary',
    'Africa/Ceuta',
    'America/Mexico_City',
    'America/Bogota',
    'America/Lima',
    'America/Santiago',
    'America/Caracas',
    'America/Montevideo',
    'America/Asuncion',
    'America/La_Paz',
    'America/Guayaquil',
    'America/Havana',
    'America/Costa_Rica',
    'America/Panama',
  ],
};

/**
 * @description The language of the texts guessed from a timezone, before
 * any widget was shown.
 * @param {string} timezone - IANA timezone of Gladys.
 * @returns {string} en, fr, de or es.
 * @example
 * guessLanguage('Europe/Paris'); // -> 'fr'
 */
function guessLanguage(timezone) {
  const zone = String(timezone ?? '');
  if (zone.startsWith('America/Argentina/')) {
    return 'es';
  }
  const found = Object.entries(TIMEZONE_LANGUAGES).find(([, zones]) => zones.includes(zone));
  return found ? found[0] : 'en';
}

/**
 * @description Read the stored language of the last widget request.
 * @param {object} [rawConfig] - The raw config values.
 * @param {string} fallback - The language to keep when nothing valid is stored.
 * @returns {string} The language.
 */
function readLanguage(rawConfig, fallback) {
  const language = (rawConfig ?? {})[INTERNAL_KEYS.language];
  return isLanguage(language) ? language : fallback;
}

export {
  AUTO_LANGUAGE,
  INTERNAL_KEYS,
  RADII,
  DEFAULT_RADIUS,
  EVENT_DAYS,
  DEFAULT_EVENT_DAYS,
  LUNAR_THRESHOLDS,
  DEFAULT_LUNAR_THRESHOLD,
  normalizeConfig,
  guessLanguage,
  readLanguage,
};
