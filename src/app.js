// -----------------------------------------------------------------------------
// The NASA integration: every handler, registered on a Gladys client.
//
// Brings three open NASA services into Gladys:
//   - NeoWs (api.nasa.gov, JPL data): the close approaches of near-Earth
//     asteroids in the next 7 days -> the "Asteroids" device, the asteroids
//     widget, the close-approach and hazardous-asteroid triggers;
//   - EPIC (epic.gsfc.nasa.gov): the latest images of the whole Earth taken
//     from DSCOVR -> the earth widget and a scene action;
//   - EONET (eonet.gsfc.nasa.gov): the natural events near each located house
//     -> one "Natural events" device per house, a widget, a trigger.
//
// The integration's own timer (every minute) reads what is due: NeoWs every
// 6 hours (4 requests a day: the shared DEMO_KEY allows 10 an hour per IP
// address), EPIC every 3 hours (a new day of images is published once a day),
// EONET every hour (one request per located house, a box around it). After a
// failure, a service waits twice as long each time (6 hours at most); an
// exhausted quota waits for the next hour, a refused key for a change of the
// configuration or 6 hours. A widget never reads NASA, except the EPIC image
// itself, read once per image and kept in memory. A scene action only reads
// what is too old.
//
// index.js only creates the SDK client; the tests drive this module with the
// fake Gladys of the SDK and a fake NASA (test/helpers/fake-nasa.js).
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { logger as sdkLogger } from '@gladysassistant/integration-sdk';
import {
  normalizeConfig,
  readLanguage,
  guessLanguage,
  INTERNAL_KEYS,
  AUTO_LANGUAGE,
} from './config.js';
import { createNasaClient, redact, DEMO_KEY } from './nasa-api.js';
import { parseFeed, weekOf } from './neo.js';
import { parseEpic, imagesFor, imageKey, imageUrl } from './epic.js';
import { parseEvents, eventsNear, boundingBox } from './eonet.js';
import { createStore, DEFAULT_DIR } from './store.js';
import {
  asteroidIds,
  eventIds,
  houseOfExternalId,
  buildAsteroidsDevice,
  buildEventsDevice,
  buildAsteroidStates,
  buildEventStates,
} from './device.js';
import { TRIGGERS, detectAsteroids, detectNaturalEvents } from './events.js';
import {
  SCENE_ACTIONS,
  asteroidOutputs,
  asteroidData,
  categoryLabel,
  eventOutputs,
  naturalEventData,
  earthOutputs,
} from './summary.js';
import {
  WIDGETS,
  messageContent,
  buildAsteroidsWidget,
  buildEarthWidget,
  buildEventsWidget,
} from './widgets.js';
import { MINUTE_MS, HOUR_MS, DAY_MS, defaultTimeZone, formatTime, formatDate } from './time.js';
import { t, all, formatNumber, LANGUAGES } from './i18n.js';

const ACTIONS = { TEST_CONNECTION: 'test_connection', DIAGNOSTIC: 'diagnostic' };
const TICK_MS = MINUTE_MS;
// No burst at startup: the first readings wait a little.
const STARTUP_DELAY_MS = 10 * 1000;
// The rhythm of each service, and how old its data may be to be shown.
const PRODUCTS = {
  neows: { every: 6 * HOUR_MS, fresh: 2 * DAY_MS },
  epic: { every: 3 * HOUR_MS, fresh: 7 * DAY_MS },
  eonet: { every: HOUR_MS, fresh: DAY_MS },
};
const MAX_BACKOFF_MS = 6 * HOUR_MS;
const HOUSES_EVERY_MS = HOUR_MS;
// EPIC images kept in memory (about 220 kB each).
const IMAGE_CACHE = 4;
const DIAGNOSTIC_CHUNK = 3000;
const { version: VERSION } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);
const USER_AGENT = `gladys-nasa/${VERSION} (+https://github.com/William-De71/gladys-nasa)`;

/**
 * @description Register every handler of the integration on a Gladys client.
 * @param {object} gladys - A GladysIntegration (or the fake Gladys of the SDK).
 * @param {object} [options] - Options.
 * @param {Function} [options.fetch] - HTTP transport (tests).
 * @param {object} [options.urls] - `{ neows, epic, eonet }` roots (tests).
 * @param {string} [options.dataDir] - The writable folder (/data).
 * @param {Function} [options.now] - `() => number` in ms (tests).
 * @param {string} [options.timeZone] - IANA timezone of Gladys (TZ by default).
 * @param {boolean} [options.timers] - Arm the reading timer (false in tests).
 * @param {object} [options.logger] - Logger.
 * @returns {object} Handles for the tests.
 */
function createApp(
  gladys,
  {
    fetch: fetchFn,
    urls,
    dataDir = DEFAULT_DIR,
    now = () => Date.now(),
    timeZone = defaultTimeZone(),
    timers = true,
    logger = sdkLogger,
  } = {},
) {
  let config = normalizeConfig();
  let language = guessLanguage(timeZone);
  let createdDevices = new Set();
  let houses = [];
  let housesAt = 0;
  let lastStatus = null;
  let lastDiscovery = null;
  let timer = null;
  let startTimer = null;
  let running = null;
  let stopped = false;
  const images = new Map();

  const store = createStore({ dir: dataDir, logger });
  const api = createNasaClient({
    userAgent: USER_AGENT,
    ...(fetchFn ? { fetch: fetchFn } : {}),
    ...(urls ? { urls } : {}),
  });

  /**
   * @description Remember the language of a widget request, and store it when it changed.
   * @param {string} next - The language.
   */
  function rememberLanguage(next) {
    if (!LANGUAGES.includes(next) || next === language) {
      return;
    }
    language = next;
    gladys
      .setConfig({ [INTERNAL_KEYS.language]: next })
      .catch((err) => logger.warn(`Unable to store the language: ${err.message}`));
  }

  /**
   * @description Language of the texts Gladys does not ask for in a language.
   * @returns {string} The language.
   */
  const textLanguage = () => (config.language === AUTO_LANGUAGE ? language : config.language);

  /**
   * @description The scope of the natural events: a radius or a period changed means new rules.
   * @returns {string} "<radius>/<days>".
   */
  const eventScope = () => `${config.radiusKm}/${config.eventDays}`;

  // --- What is known ------------------------------------------------------------------

  /**
   * @description The record of a service in the store.
   * @param {string} product - A PRODUCTS key.
   * @returns {object} `{ value, fetchedAt, triedAt, failures, error }`.
   */
  function recordOf(product) {
    store.data.products[product] ??= {};
    return store.data.products[product];
  }

  /**
   * @description The value of a service, null when older than its freshness.
   * @param {string} product - A PRODUCTS key.
   * @returns {unknown} The value.
   */
  function freshValue(product) {
    const record = recordOf(product);
    if (record.value === undefined || record.value === null) return null;
    return Number.isFinite(record.fetchedAt) && now() - record.fetchedAt <= PRODUCTS[product].fresh
      ? record.value
      : null;
  }

  /**
   * @description The asteroids of the next 7 days.
   * @returns {object} weekOf(), plus `updatedAt`.
   */
  function asteroidWeek() {
    const approaches = freshValue('neows');
    return {
      ...weekOf(approaches ?? [], now()),
      updatedAt: approaches ? recordOf('neows').fetchedAt : null,
    };
  }

  /**
   * @description The natural events near a house, as last read.
   * @param {object} house - The house.
   * @returns {{ events: object[], updatedAt: number|null }} The events.
   */
  function houseEvents(house) {
    const record = store.data.houses[house.id];
    const valid =
      record &&
      record.scope === eventScope() &&
      Number.isFinite(record.fetchedAt) &&
      now() - record.fetchedAt <= PRODUCTS.eonet.fresh;
    return valid
      ? { events: Array.isArray(record.events) ? record.events : [], updatedAt: record.fetchedAt }
      : { events: [], updatedAt: null };
  }

  /**
   * @description The values of the features of the asteroids device now.
   * @returns {object} The values, null when unknown.
   */
  function asteroidValues() {
    const week = asteroidWeek();
    if (!week.updatedAt) return {};
    return {
      closest_distance: week.closest?.km ?? null,
      closest_lunar: week.closest?.lunar ?? null,
      approaches: week.count,
      hazardous: week.hazardous,
      closest_name: week.closest?.name ?? t('stateNoApproach', textLanguage()),
    };
  }

  /**
   * @description The values of the features of the natural events device of a house.
   * @param {object} house - The house.
   * @returns {object} The values.
   */
  function eventValues(house) {
    const { events, updatedAt } = houseEvents(house);
    if (!updatedAt) return {};
    const lang = textLanguage();
    const nearest = events[0];
    return {
      events_nearby: events.length,
      nearest_distance: nearest ? nearest.distance : null,
      nearest_event: nearest
        ? t('stateNearestEvent', lang, {
            title: nearest.title,
            category: categoryLabel(nearest.category, lang),
            distance: formatNumber(nearest.distance, lang, 0),
          })
        : t('stateNoEvent', lang, { radius: formatNumber(config.radiusKm, lang, 0) }),
    };
  }

  /**
   * @description The EPIC image for a house (the one facing it), else the latest.
   * @param {object|null} house - The house.
   * @returns {object|null} The image.
   */
  function epicImageFor(house) {
    const list = freshValue('epic');
    return list?.length ? imagesFor(list, house?.longitude ?? null)[0] : null;
  }

  // --- Houses and devices -------------------------------------------------------------

  /**
   * @description Read the houses of Gladys (the located ones only).
   * @returns {Promise<void>}
   */
  async function refreshHouses() {
    try {
      const list = await gladys.getHouses();
      houses = (Array.isArray(list) ? list : []).filter(
        (house) => house?.id && Number.isFinite(house.latitude) && Number.isFinite(house.longitude),
      );
      housesAt = now();
    } catch (err) {
      logger.warn(`Unable to read the houses of Gladys: ${err.message}`);
    }
  }

  /**
   * @description Refresh the list of the devices the user created.
   * @returns {Promise<void>}
   */
  async function refreshCreatedDevices() {
    try {
      const devices = await gladys.getDevices();
      createdDevices = new Set(devices.map((device) => device.external_id));
    } catch (err) {
      logger.warn(`Unable to read the devices: ${err.message}`);
    }
  }

  /**
   * @description Offer the devices on the Discovery screen, when they changed.
   * @param {boolean} [force] - Publish even when unchanged.
   * @returns {Promise<number>} How many devices were offered.
   */
  async function publishDiscoveredDevices(force = false) {
    const lang = textLanguage();
    const devices = [
      buildAsteroidsDevice(gladys, lang),
      ...houses.map((house) => buildEventsDevice(gladys, house, lang)),
    ];
    const signature = JSON.stringify(devices);
    if (force || signature !== lastDiscovery) {
      await gladys.publishDiscoveredDevices(devices);
      lastDiscovery = signature;
    }
    return devices.length;
  }

  /**
   * @description Publish the states of the created devices (only the changed ones).
   * @returns {Promise<void>}
   */
  async function publishStates() {
    const states = [];
    if (createdDevices.has(asteroidIds(gladys).device)) {
      states.push(...buildAsteroidStates(gladys, asteroidValues()));
    }
    for (const house of houses) {
      if (createdDevices.has(eventIds(gladys, house.id).device)) {
        states.push(...buildEventStates(gladys, house.id, eventValues(house)));
      }
    }
    if (states.length) {
      await gladys
        .publishChangedStates(states)
        .catch((err) => logger.warn(`Unable to publish the states: ${err.message}`));
    }
  }

  // --- Status -------------------------------------------------------------------------

  /**
   * @description Report the connection status, only when it changed.
   * @param {boolean} connected - Connected or not.
   * @param {object} message - The multi-language message.
   * @returns {Promise<void>}
   */
  async function reportStatus(connected, message) {
    const clipped = Object.fromEntries(
      Object.entries(message).map(([lang, text]) => [lang, text.slice(0, 200)]),
    );
    const signature = JSON.stringify([connected, clipped]);
    if (signature === lastStatus) {
      return;
    }
    lastStatus = signature;
    try {
      await gladys.setConnectionStatus(connected, clipped);
    } catch (err) {
      lastStatus = null;
      logger.error('Unable to report the connection status', err);
    }
  }

  /**
   * @description Work out the connection status.
   * @returns {Promise<void>}
   */
  async function refreshStatus() {
    const records = Object.keys(PRODUCTS).map(recordOf);
    const neows = recordOf('neows');
    if (neows.error?.kind === 'key') {
      await reportStatus(false, all('statusKey'));
      return;
    }
    const lastSuccess = Math.max(0, ...records.map((record) => record.fetchedAt ?? 0));
    const failing = records.filter((record) => record.failures > 0);
    if (!lastSuccess || failing.length === records.length) {
      if (failing.length) {
        const error = store.data.lastError;
        await reportStatus(
          false,
          all('statusUnreachable', (lang) => ({
            time: formatTime(error?.since ?? now(), { language: lang, timeZone, now: now() }),
            detail: error?.message ?? '',
          })),
        );
      } else {
        await reportStatus(true, all('statusWaiting'));
      }
      return;
    }
    if (neows.error?.kind === 'quota') {
      await reportStatus(
        true,
        all('statusQuota', (lang) => ({ key: t(config.apiKey ? 'keyOwn' : 'keyDemo', lang) })),
      );
      return;
    }
    const week = asteroidWeek();
    const events = houses.reduce((sum, house) => sum + houseEvents(house).events.length, 0);
    await reportStatus(
      true,
      all((lang) =>
        [
          t('statusOk', lang, {
            time: formatTime(lastSuccess, { language: lang, timeZone, now: now() }),
            approaches: week.updatedAt ? week.count : '–',
            events,
          }),
          houses.length ? null : t('statusNoHouse', lang),
        ]
          .filter(Boolean)
          .join(' '),
      ),
    );
  }

  /**
   * @description Ask the open widgets to pull their content again.
   * @param {string[]} [keys] - The widgets (all by default).
   */
  function refreshWidgets(keys = Object.values(WIDGETS)) {
    for (const key of keys) {
      Promise.resolve(gladys.requestWidgetRefresh(key)).catch(() => {});
    }
  }

  // --- Reading ------------------------------------------------------------------------

  /**
   * @description How long a service waits after its last try.
   * @param {string} product - A PRODUCTS key.
   * @returns {number} In ms.
   */
  function waitOf(product) {
    const record = recordOf(product);
    const every = PRODUCTS[product].every;
    if (!record.failures) return every;
    if (record.error?.kind === 'quota') {
      // The quota of api.nasa.gov is a rolling hour.
      return Math.max(HOUR_MS, (record.error.retryAfter ?? 0) * 1000);
    }
    if (record.error?.kind === 'key') return MAX_BACKOFF_MS;
    // A first failure retries after 10 minutes, then twice as long each time.
    return Math.min(MAX_BACKOFF_MS, 10 * MINUTE_MS * 2 ** Math.min(record.failures - 1, 6));
  }

  /**
   * @description Whether a service is due now.
   * @param {string} product - A PRODUCTS key.
   * @returns {boolean} True when due.
   */
  function isDue(product) {
    if (product === 'eonet' && houses.length === 0) return false;
    return now() - (recordOf(product).triedAt ?? 0) >= waitOf(product);
  }

  /**
   * @description Read the natural events near every located house.
   * @returns {Promise<boolean>} True when something changed.
   */
  async function readEonet() {
    let changed = false;
    for (const house of houses) {
      const raw = await api.eonetEvents({
        bbox: boundingBox(house, config.radiusKm),
        days: config.eventDays,
      });
      const parsed = parseEvents(raw);
      if (!parsed) {
        throw Object.assign(new Error('Unexpected content'), { kind: 'invalid' });
      }
      const events = eventsNear(parsed, house, {
        radiusKm: config.radiusKm,
        since: now() - config.eventDays * DAY_MS,
      });
      const before = store.data.houses[house.id];
      changed ||= JSON.stringify(before?.events) !== JSON.stringify(events);
      store.data.houses[house.id] = { events, fetchedAt: now(), scope: eventScope() };
    }
    for (const id of Object.keys(store.data.houses)) {
      if (!houses.some((house) => house.id === id)) delete store.data.houses[id];
    }
    return changed;
  }

  /**
   * @description Read one NASA service and keep what it says.
   * @param {string} product - A PRODUCTS key.
   * @returns {Promise<boolean>} True when its data changed.
   */
  async function read(product) {
    const record = recordOf(product);
    record.triedAt = now();
    try {
      let changed;
      if (product === 'eonet') {
        changed = await readEonet();
      } else {
        const value =
          product === 'neows'
            ? parseFeed(await api.neoFeed({ from: now(), key: config.apiKey }))
            : parseEpic(await api.epicLatest());
        if (!value) {
          throw Object.assign(new Error('Unexpected content'), { kind: 'invalid' });
        }
        // An empty EPIC list (a day without image) keeps the last one.
        if (product === 'epic' && value.length === 0 && record.value?.length) {
          Object.assign(record, { fetchedAt: now(), failures: 0, error: null });
          return false;
        }
        changed = JSON.stringify(record.value) !== JSON.stringify(value);
        record.value = value;
      }
      Object.assign(record, { fetchedAt: now(), failures: 0, error: null });
      return changed;
    } catch (err) {
      record.failures = (record.failures ?? 0) + 1;
      const kind = err.kind ?? 'failed';
      const message = redact(String(err.message), config.apiKey).slice(0, 200);
      record.error = { kind, message, retryAfter: err.retryAfter ?? null };
      const since = store.data.lastError?.since ?? now();
      store.data.lastError = { product, kind, message, at: now(), since };
      logger.warn(`NASA ${product} (${kind}): ${message}`);
      return false;
    }
  }

  /**
   * @description The scene events after the readings, from what is known now.
   * @returns {Array<{ key: string, data: object }>} The events.
   */
  function detectEvents() {
    const seen = store.data.seen;
    const lang = textLanguage();
    const options = { language: lang, timeZone, now: now() };
    const events = [];
    const approaches = freshValue('neows');
    if (approaches) {
      const { events: found, next } = detectAsteroids(seen.asteroids, {
        approaches: weekOf(approaches, now()).list,
        threshold: config.lunarThreshold,
        now: now(),
      });
      seen.asteroids = next;
      found.forEach((event) =>
        events.push({ key: event.key, data: asteroidData(event.key, event.approach, options) }),
      );
    }
    seen.natural ??= {};
    for (const house of houses) {
      const { events: near, updatedAt } = houseEvents(house);
      if (!updatedAt) continue;
      const { events: found, next } = detectNaturalEvents(seen.natural[house.id], {
        events: near,
        scope: eventScope(),
      });
      seen.natural[house.id] = next;
      const device = eventIds(gladys, house.id).device;
      found.forEach((event) =>
        events.push({
          key: TRIGGERS.NATURAL_EVENT,
          data: naturalEventData(event, house, { ...options, device }),
        }),
      );
    }
    for (const id of Object.keys(seen.natural)) {
      if (!houses.some((house) => house.id === id)) delete seen.natural[id];
    }
    return events;
  }

  /**
   * @description Publish scene events, one by one.
   * @param {Array<{ key: string, data: object }>} events - The events.
   * @returns {Promise<void>}
   */
  async function publishEvents(events) {
    for (const { key, data } of events) {
      logger.info(`NASA: ${key} (${data.name ?? data.title})`);
      try {
        await gladys.publishSceneEvent(key, data);
      } catch (err) {
        logger.warn(`Unable to fire ${key}: ${err.message}`);
      }
    }
  }

  /**
   * @description Read what is due, then publish what changed.
   * @returns {Promise<void>}
   */
  async function runReadings() {
    if (now() - housesAt >= HOUSES_EVERY_MS) {
      const before = JSON.stringify(houses);
      await refreshHouses();
      if (JSON.stringify(houses) !== before) {
        await publishDiscoveredDevices().catch((err) =>
          logger.warn(`Unable to offer the devices: ${err.message}`),
        );
      }
    }
    const changed = new Set();
    for (const product of Object.keys(PRODUCTS)) {
      if (stopped) return;
      if (isDue(product) && (await read(product))) changed.add(product);
    }
    if (Object.keys(PRODUCTS).every((product) => !recordOf(product).failures)) {
      store.data.lastError = null;
    }
    const events = detectEvents();
    await store.save();
    await publishEvents(events);
    await publishStates();
    const widgets = {
      neows: WIDGETS.ASTEROIDS,
      epic: WIDGETS.EARTH,
      eonet: WIDGETS.NATURAL_EVENTS,
    };
    refreshWidgets([...changed].map((product) => widgets[product]));
    await refreshStatus();
  }

  /**
   * @description Run the readings (one round at a time).
   * @returns {Promise<void>}
   */
  function tick() {
    if (!running) {
      running = runReadings()
        .catch((err) => logger.error('Readings', err))
        .finally(() => {
          running = null;
        });
    }
    return running;
  }

  /**
   * @description (Re)arm the reading timer.
   */
  function schedule() {
    clearInterval(timer);
    clearTimeout(startTimer);
    if (!timers || stopped) {
      return;
    }
    startTimer = setTimeout(tick, STARTUP_DELAY_MS);
    startTimer.unref?.();
    timer = setInterval(tick, TICK_MS);
    timer.unref?.();
  }

  /**
   * @description Read a service now when its data are too old (scene actions).
   * @param {string} product - A PRODUCTS key.
   * @returns {Promise<void>}
   */
  async function ensureFresh(product) {
    const record = recordOf(product);
    const old = now() - (record.fetchedAt ?? 0) > 2 * PRODUCTS[product].every;
    const resting = record.failures > 0 && now() - (record.triedAt ?? 0) < waitOf(product);
    if (old && !resting) {
      await read(product);
      await store.save();
    }
  }

  /**
   * @description The house a widget or a scene action targets: the house of
   * a natural events device, else the first located house.
   * @param {unknown} externalId - The `source: "devices"` value.
   * @returns {object|null} The house.
   */
  function targetHouse(externalId) {
    const id = houseOfExternalId(externalId);
    return houses.find((house) => house.id === id) ?? houses[0] ?? null;
  }

  /**
   * @description The bytes of an EPIC image, from memory or read once.
   * @param {object} image - The EPIC image.
   * @returns {Promise<Buffer>} A JPEG of at most 300 kB.
   */
  async function imageBytes(image) {
    const key = imageKey(image);
    if (images.has(key)) return images.get(key);
    let bytes;
    try {
      bytes = await api.epicImage(image);
    } catch (err) {
      if (err.kind !== 'too_large') throw err;
      // A 1080 px image over 300 kB (a rare, very detailed one): the 120 px one.
      bytes = await api.epicImage(image, { size: 'thumbs' });
    }
    images.set(key, bytes);
    while (images.size > IMAGE_CACHE) images.delete(images.keys().next().value);
    return bytes;
  }

  // --- Dashboard widgets --------------------------------------------------------------

  gladys.onWidgetGet(WIDGETS.ASTEROIDS, async ({ settings = {}, language: lang }) => {
    rememberLanguage(lang);
    return buildAsteroidsWidget({
      week: asteroidWeek(),
      updatedAt: asteroidWeek().updatedAt,
      threshold: config.lunarThreshold,
      language: lang,
      timeZone,
      now: now(),
      settings,
    });
  });

  gladys.onWidgetGet(WIDGETS.EARTH, async ({ settings = {}, language: lang }) => {
    rememberLanguage(lang);
    const house = targetHouse(settings.device);
    return buildEarthWidget({ image: epicImageFor(house), house, language: lang, timeZone });
  });

  gladys.onWidgetGet(WIDGETS.NATURAL_EVENTS, async ({ settings = {}, language: lang }) => {
    rememberLanguage(lang);
    const house = targetHouse(settings.device);
    if (!house) {
      return messageContent(t('widgetNoHouse', lang));
    }
    const { events, updatedAt } = houseEvents(house);
    return buildEventsWidget({
      house,
      events,
      updatedAt,
      radiusKm: config.radiusKm,
      eventDays: config.eventDays,
      language: lang,
      timeZone,
      now: now(),
    });
  });

  gladys.onWidgetGetImage(async (key) => {
    const image = (recordOf('epic').value ?? []).find((item) => imageKey(item) === key);
    if (!image) {
      throw new Error(`Unknown image ${key}`);
    }
    return (await imageBytes(image)).toString('base64');
  });

  // --- Scene actions ------------------------------------------------------------------
  // They answer from what the timer read, and read again only what is too old.

  gladys.onSceneAction(SCENE_ACTIONS.GET_ASTEROIDS, async () => {
    const lang = textLanguage();
    await ensureFresh('neows');
    const week = asteroidWeek();
    if (!week.updatedAt) {
      throw new Error(t('errNoData', lang, { detail: recordOf('neows').error?.message ?? '–' }));
    }
    return asteroidOutputs(week, { language: lang, timeZone, now: now() });
  });

  gladys.onSceneAction(SCENE_ACTIONS.GET_NATURAL_EVENTS, async (fields = {}) => {
    const lang = textLanguage();
    if (houses.length === 0) await refreshHouses();
    const house = targetHouse(fields.device);
    if (!house) {
      throw new Error(t('errNoHouse', lang));
    }
    if (!houseEvents(house).updatedAt) await ensureFresh('eonet');
    const { events, updatedAt } = houseEvents(house);
    if (!updatedAt) {
      throw new Error(t('errNoData', lang, { detail: recordOf('eonet').error?.message ?? '–' }));
    }
    return eventOutputs(house, events, {
      language: lang,
      timeZone,
      radiusKm: config.radiusKm,
      eventDays: config.eventDays,
    });
  });

  gladys.onSceneAction(SCENE_ACTIONS.GET_EARTH_IMAGE, async (fields = {}) => {
    const lang = textLanguage();
    await ensureFresh('epic');
    if (houses.length === 0) await refreshHouses();
    const image = epicImageFor(targetHouse(fields.device));
    if (!image) {
      throw new Error(t('errNoData', lang, { detail: recordOf('epic').error?.message ?? '–' }));
    }
    return earthOutputs(image, imageUrl(image), { language: lang, timeZone });
  });

  // --- Configuration screen actions ---------------------------------------------------

  gladys.onAction(ACTIONS.TEST_CONNECTION, async () => {
    await refreshHouses();
    // The shared DEMO_KEY is precious: NeoWs only when not read in the last 10 minutes.
    const neows = recordOf('neows');
    const products = ['epic', 'eonet'];
    if (!(neows.fetchedAt && now() - neows.fetchedAt < 10 * MINUTE_MS && !neows.failures)) {
      products.unshift('neows');
    }
    for (const product of products) {
      if (product !== 'eonet' || houses.length) await read(product);
    }
    await store.save();
    await publishDiscoveredDevices().catch(() => {});
    await publishStates();
    await refreshStatus();
    const failed = products.map(recordOf).find((record) => record.failures > 0);
    if (failed) {
      return failed.error?.kind === 'key'
        ? all('statusKey')
        : all('testFailed', { detail: failed.error?.message ?? '–' });
    }
    const week = asteroidWeek();
    const epic = freshValue('epic') ?? [];
    const last = epic[epic.length - 1];
    return all((lang) =>
      t('testOk', lang, {
        approaches: week.count,
        key: t(config.apiKey ? 'keyOwn' : 'keyDemo', lang),
        epic: last ? formatDate(last.at, { language: lang, timeZone }) : '–',
        events: houses.reduce((sum, house) => sum + houseEvents(house).events.length, 0),
        houses: houses.length ? houses.map((house) => house.name).join(', ') : t('none', lang),
      }).slice(0, 1000),
    );
  });

  gladys.onAction(ACTIONS.DIAGNOSTIC, async () => {
    const iso = (value) => (Number.isFinite(value) ? new Date(value).toISOString() : null);
    const week = asteroidWeek();
    const report = {
      version: VERSION,
      timeZone: timeZone ?? null,
      language: config.language,
      key: config.apiKey ? 'own' : DEMO_KEY,
      radiusKm: config.radiusKm,
      eventDays: config.eventDays,
      lunarThreshold: config.lunarThreshold,
      quota: api.quota(),
      houses: houses.map((house) => ({ id: house.id, name: house.name, located: true })),
      created: [...createdDevices],
      lastError: store.data.lastError,
      products: Object.fromEntries(
        Object.keys(PRODUCTS).map((product) => {
          const record = recordOf(product);
          return [
            product,
            {
              fetchedAt: iso(record.fetchedAt),
              triedAt: iso(record.triedAt),
              failures: record.failures ?? 0,
              error: record.error ?? null,
            },
          ];
        }),
      ),
      asteroids: {
        count: week.count,
        hazardous: week.hazardous,
        closest: week.closest ? { name: week.closest.name, lunar: week.closest.lunar } : null,
      },
      epic: (recordOf('epic').value ?? []).map((image) => image.image),
      events: Object.fromEntries(
        houses.map((house) => [house.id, houseEvents(house).events.map((event) => event.id)]),
      ),
      imagesInMemory: [...images.keys()],
      seen: store.data.seen,
    };
    const json = JSON.stringify(report);
    const count = Math.max(1, Math.ceil(json.length / DIAGNOSTIC_CHUNK));
    for (let chunk = 0; chunk < count; chunk += 1) {
      logger.info(
        `NASA diagnostic ${chunk + 1}/${count}: ${json.slice(chunk * DIAGNOSTIC_CHUNK, (chunk + 1) * DIAGNOSTIC_CHUNK)}`,
      );
    }
    return all('diagnosticDone', { count });
  });

  // --- Devices ------------------------------------------------------------------------
  gladys.onScanRequest(async () => {
    await refreshHouses();
    const count = await publishDiscoveredDevices(true);
    logger.info(`Scan: ${count} device(s) offered`);
  });

  gladys.onDeviceCreated(async () => {
    await refreshCreatedDevices();
    // States sent before the device existed were dropped by Gladys, and the SDK
    // forgot what it sent for this device: send everything known again.
    await publishStates();
    refreshWidgets();
  });

  gladys.onDeviceDeleted(refreshCreatedDevices);

  // --- Configuration ------------------------------------------------------------------

  /**
   * @description Reload the whole config (internal keys included).
   * @param {object} [fallback] - Raw values to use when the read fails.
   * @returns {Promise<void>}
   */
  async function loadConfig(fallback) {
    try {
      const raw = await gladys.getConfig();
      config = normalizeConfig(raw);
      language = readLanguage(raw, language);
    } catch (err) {
      if (fallback) {
        config = normalizeConfig(fallback);
      }
      logger.error('Unable to read the configuration', err);
    }
  }

  gladys.onConfigUpdated(async (rawConfig) => {
    const before = config;
    await loadConfig(rawConfig);
    logger.info('Configuration updated');
    // A new key is tried at the next tick; a new radius or period is read at once.
    if (config.apiKey !== before.apiKey) {
      Object.assign(recordOf('neows'), { triedAt: 0, failures: 0, error: null });
    }
    if (config.radiusKm !== before.radiusKm || config.eventDays !== before.eventDays) {
      recordOf('eonet').triedAt = 0;
    }
    lastStatus = null;
    await publishDiscoveredDevices().catch((err) =>
      logger.warn(`Unable to offer the devices: ${err.message}`),
    );
    await publishStates();
    await refreshStatus();
    refreshWidgets();
    if (timers) setTimeout(() => tick(), 1000).unref?.();
  });

  // --- Connection lifecycle -----------------------------------------------------------
  // Each (re)connection resynchronizes; the promise lets the tests wait for it.
  let startup = Promise.resolve();
  gladys.on('connected', () => {
    startup = (async () => {
      await store.load();
      await loadConfig();
      await refreshHouses();
      await refreshCreatedDevices();
      lastStatus = null;
      lastDiscovery = null;
      await publishDiscoveredDevices().catch((err) =>
        logger.warn(`Unable to offer the devices: ${err.message}`),
      );
      await publishStates();
      await refreshStatus();
      schedule();
    })().catch((err) => logger.error('Startup', err));
  });

  // --- Graceful shutdown --------------------------------------------------------------
  gladys.handleShutdown(async (signal) => {
    logger.info(`Received ${signal} -> graceful shutdown`);
    stopped = true;
    clearInterval(timer);
    clearTimeout(startTimer);
    await store.save();
  });

  return {
    store,
    tick,
    isDue,
    waitOf,
    asteroidWeek,
    houseEvents,
    asteroidValues,
    eventValues,
    epicImageFor,
    targetHouse,
    houses: () => houses,
    getConfig: () => config,
    whenReady: () => startup,
  };
}

export { createApp, ACTIONS, PRODUCTS, USER_AGENT, TICK_MS };
