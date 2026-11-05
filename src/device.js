// -----------------------------------------------------------------------------
// The devices of the integration, offered on the Discovery screen.
//
// 1. "Asteroids" (`ext:<selector>:asteroids:global`), one per instance: the
//    close approaches of the next 7 days (NeoWs), read-only features in a
//    stable order:
//      closest_distance  distance of the closest approach, km
//      closest_lunar     the same in lunar distances (384,400 km)
//      approaches        number of approaches in the next 7 days
//      hazardous         of which potentially hazardous asteroids
//      closest_name      name of the closest asteroid, a text
// 2. "Natural events" (`ext:<selector>:natural-events:<house id>`), one per
//    house of Gladys with a location (the user creates the ones wanted): the
//    EONET events within the radius and the period of the configuration:
//      events_nearby     number of events
//      nearest_distance  distance of the nearest one, km (left as it was when
//                        there is none: the count says 0)
//      nearest_event     its title and category, a text
//
// Units: a distance is a `distance-sensor` in km (a unit of the core for that
// category); a count is a `counter-sensor` without unit; the lunar distance
// has no unit in Gladys: an `unknown` feature whose name says "(LD)". Several
// features share a category on each device, so the dashboard shows their
// names. `should_poll` stays false: the integration reads NASA on its own
// timer.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as C,
  DEVICE_FEATURE_TYPES as T,
  DEVICE_FEATURE_UNITS as U,
} from '@gladysassistant/integration-sdk';
import { t } from './i18n.js';

const ASTEROIDS_TYPE = 'asteroids';
const ASTEROIDS_ID = 'global';
const EVENTS_TYPE = 'natural-events';

const count = { category: C.COUNTER_SENSOR, type: T.SENSOR.INTEGER, min: 0, decimals: 0 };
const km = (max) => ({
  category: C.DISTANCE_SENSOR,
  type: T.SENSOR.DECIMAL,
  unit: U.KM,
  min: 0,
  max,
  decimals: 0,
});
const text = { category: C.TEXT, type: T.TEXT.TEXT, min: 0, max: 0, text: true };

const ASTEROID_FEATURES = [
  // NeoWs lists approaches up to about 0.5 AU (75 million km).
  { key: 'closest_distance', ...km(200000000) },
  {
    key: 'closest_lunar',
    category: C.UNKNOWN,
    type: T.UNKNOWN.UNKNOWN,
    min: 0,
    max: 600,
    decimals: 2,
  },
  { key: 'approaches', ...count, max: 10000 },
  { key: 'hazardous', ...count, max: 10000 },
  { key: 'closest_name', ...text },
];

const EVENT_FEATURES = [
  { key: 'events_nearby', ...count, max: 1000 },
  // Half the circumference of the Earth.
  { key: 'nearest_distance', ...km(20040) },
  { key: 'nearest_event', ...text },
];

/**
 * @description The external ids of the asteroids device.
 * @param {object} gladys - The GladysIntegration instance.
 * @returns {{ device: string, feature: Function }} The ids.
 */
const asteroidIds = (gladys) => gladys.externalIds(ASTEROIDS_TYPE, ASTEROIDS_ID);

/**
 * @description The external ids of the natural events device of a house.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} houseId - The id of the house (GET /house).
 * @returns {{ device: string, feature: Function }} The ids.
 */
const eventIds = (gladys, houseId) => gladys.externalIds(EVENTS_TYPE, String(houseId));

/**
 * @description The house id of a natural events device (or feature) external id.
 * @param {unknown} externalId - The id.
 * @returns {string|null} The house id.
 * @example
 * houseOfExternalId('ext:nasa:natural-events:6f1c…:events_nearby'); // -> '6f1c…'
 */
function houseOfExternalId(externalId) {
  const match = /:natural-events:([^:]+)(?::[a-z_]+)?$/.exec(String(externalId ?? ''));
  return match ? match[1] : null;
}

/**
 * @description A feature of a device.
 * @param {object} feature - The feature definition.
 * @param {Function} ids - The feature id factory.
 * @param {string} language - The language of the names.
 * @returns {object} The discovered feature.
 */
function featureOf(feature, ids, language) {
  return {
    name: t(`feature_${feature.key}`, language),
    external_id: ids(feature.key),
    category: feature.category,
    type: feature.type,
    ...(feature.unit ? { unit: feature.unit } : {}),
    min: feature.min,
    max: feature.max,
    read_only: true,
    has_feedback: false,
    keep_history: !feature.text,
  };
}

/**
 * @description The "Asteroids" device.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} [language] - The language of the names.
 * @returns {object} The discovered device.
 */
function buildAsteroidsDevice(gladys, language = 'en') {
  const ids = asteroidIds(gladys);
  return {
    name: t('deviceAsteroids', language),
    external_id: ids.device,
    model: 'NASA NeoWs',
    should_poll: false,
    features: ASTEROID_FEATURES.map((feature) => featureOf(feature, ids.feature, language)),
  };
}

/**
 * @description The "Natural events" device of a house.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} house - `{ id, name }`.
 * @param {string} [language] - The language of the names.
 * @returns {object} The discovered device.
 */
function buildEventsDevice(gladys, house, language = 'en') {
  const ids = eventIds(gladys, house.id);
  return {
    name: t('deviceEvents', language, { house: house.name || house.id }).slice(0, 100),
    external_id: ids.device,
    model: 'NASA EONET',
    should_poll: false,
    features: EVENT_FEATURES.map((feature) => featureOf(feature, ids.feature, language)),
  };
}

/**
 * @description The states of a device, from its values now: a value left
 * out (null) is left untouched.
 * @param {object[]} features - ASTEROID_FEATURES or EVENT_FEATURES.
 * @param {Function} ids - The feature id factory.
 * @param {object} values - `{ key: number|string|null }`.
 * @returns {object[]} `{ device_feature_external_id, state }` or `{ …, text }`.
 */
function statesOf(features, ids, values) {
  const states = [];
  for (const feature of features) {
    const value = values?.[feature.key];
    if (feature.text) {
      if (typeof value === 'string' && value) {
        states.push({ device_feature_external_id: ids(feature.key), text: value.slice(0, 100) });
      }
    } else if (Number.isFinite(value)) {
      const factor = 10 ** feature.decimals;
      const bounded = Math.min(feature.max, Math.max(feature.min, value));
      states.push({
        device_feature_external_id: ids(feature.key),
        state: Math.round(bounded * factor) / factor,
      });
    }
  }
  return states;
}

const buildAsteroidStates = (gladys, values) =>
  statesOf(ASTEROID_FEATURES, asteroidIds(gladys).feature, values);
const buildEventStates = (gladys, houseId, values) =>
  statesOf(EVENT_FEATURES, eventIds(gladys, houseId).feature, values);

export {
  ASTEROIDS_TYPE,
  EVENTS_TYPE,
  ASTEROID_FEATURES,
  EVENT_FEATURES,
  asteroidIds,
  eventIds,
  houseOfExternalId,
  buildAsteroidsDevice,
  buildEventsDevice,
  buildAsteroidStates,
  buildEventStates,
};
