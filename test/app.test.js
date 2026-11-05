// The whole integration against the fake Gladys of the SDK
// (`@gladysassistant/integration-sdk/testing`), which checks the discovered
// devices, the states and the scene events like the host API does, and a fake
// NASA serving the real answers of 2026-11-05 (test/helpers/fake-nasa.js), a
// real HTTP server on 127.0.0.1. No test touches the network.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent, validateWidgetImage } from '@gladysassistant/integration-sdk';

import { createApp, ACTIONS, USER_AGENT } from '../src/app.js';
import { WIDGETS } from '../src/widgets.js';
import { TRIGGERS } from '../src/events.js';
import { SCENE_ACTIONS, ASTEROID_OUTPUTS, EVENT_OUTPUTS, EARTH_OUTPUTS } from '../src/summary.js';
import { LANGUAGES } from '../src/i18n.js';
import {
  startFakeNasa,
  dataDir,
  fixture,
  silent,
  NOW,
  TZ,
  MINUTE,
  HOUR,
  DAY,
} from './helpers/fake-nasa.js';

const manifest = JSON.parse(
  readFileSync(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const HOUSES = [
  { id: 'h-besancon', name: 'Maison', selector: 'maison', latitude: 47.24, longitude: 6.02 },
  { id: 'h-la', name: 'Studio', selector: 'studio', latitude: 34.05, longitude: -118.24 },
  { id: 'h-none', name: 'Garage', selector: 'garage', latitude: null, longitude: null },
];
const CONFIG = { language: 'fr', radius_km: '500', event_days: '30', lunar_threshold: '5' };
const PREFIX = 'ext:test-integration';
const ASTEROIDS = `${PREFIX}:asteroids:global`;
const BESANCON = `${PREFIX}:natural-events:h-besancon`;
const LA = `${PREFIX}:natural-events:h-la`;

/**
 * @description The integration, connected to a fake Gladys and a fake NASA.
 * @param {object} t - The test context (closes everything after).
 * @param {object} [options] - `{ config, dir, clock, fake, houses }`.
 * @returns {Promise<object>} `{ gladys, app, fake, clock, dir }`.
 */
async function startApp(
  t,
  { config = CONFIG, dir = dataDir(), clock = { now: NOW }, fake, houses = HOUSES } = {},
) {
  fake ??= await startFakeNasa();
  const gladys = createFakeGladys({ config, houses });
  const app = createApp(gladys, {
    urls: fake.urls,
    dataDir: dir,
    now: () => clock.now,
    timeZone: TZ,
    timers: false,
    logger: silent,
  });
  await gladys.connect();
  await app.whenReady();
  t.after(async () => {
    await gladys.fake.shutdown().catch(() => {});
    await fake.close();
  });
  return { gladys, app, fake, clock, dir };
}
const create = async (gladys, externalId) =>
  gladys.fake.deviceCreated(
    structuredClone(gladys.fake.discoveredDevices.find((d) => d.external_id === externalId)),
  );
const events = (gladys, key) => gladys.fake.sceneEvents.filter((event) => event.key === key);
const declared = (key) => manifest.scene_triggers.find((trigger) => trigger.key === key);

/**
 * @description Check a payload against its trigger: flat, scalar, declared.
 * @param {string} key - The trigger.
 * @param {object} data - The payload.
 */
function assertPayload(key, data) {
  const trigger = declared(key);
  const known = new Set(
    [...(trigger.fields ?? []), ...trigger.variables].map((entry) => entry.key),
  );
  assert.ok(Object.keys(data).length <= 30);
  for (const [name, value] of Object.entries(data)) {
    assert.ok(known.has(name), `${key}.${name} is not declared`);
    assert.ok(
      value === null || ['string', 'number', 'boolean'].includes(typeof value),
      `${key}.${name}`,
    );
    if (typeof value === 'string') assert.ok(value.length <= 1000);
  }
  for (const variable of trigger.variables) {
    assert.ok(variable.key in data, `${key}: the variable ${variable.key} is in the data`);
  }
}

/**
 * @description The real feed with one more approach, close and hazardous.
 * @param {number} lunar - Its distance in lunar distances.
 * @returns {object} The feed.
 */
function feedWithCloseApproach(lunar = 0.6) {
  const feed = structuredClone(fixture('neo-feed'));
  const at = NOW + 2 * DAY;
  feed.near_earth_objects['2026-11-07'].push({
    id: '9999999',
    name: '(2026 VX1)',
    nasa_jpl_url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=9999999',
    is_potentially_hazardous_asteroid: true,
    is_sentry_object: false,
    estimated_diameter: { meters: { estimated_diameter_min: 140, estimated_diameter_max: 310 } },
    close_approach_data: [
      {
        close_approach_date: '2026-11-07',
        epoch_date_close_approach: at,
        miss_distance: { kilometers: String(lunar * 384400), lunar: String(lunar) },
        relative_velocity: { kilometers_per_second: '14.2' },
        orbiting_body: 'Earth',
      },
    ],
  });
  return feed;
}

test('startup: devices offered, no request before the timer, then each service once', async (t) => {
  const { gladys, app, fake } = await startApp(t);
  assert.deepEqual(fake.requests, [], 'no request before the timer');
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((device) => [device.external_id, device.name]),
    [
      [ASTEROIDS, 'Astéroïdes géocroiseurs (NASA)'],
      [BESANCON, 'Événements naturels – Maison'],
      [LA, 'Événements naturels – Studio'],
    ],
    'the unlocated house gets no device',
  );
  await app.tick();
  assert.deepEqual(
    fake.requests.map((request) => request.service),
    ['neows', 'epic', 'eonet', 'eonet'],
  );
  assert.ok(fake.requests.every((request) => request.headers['user-agent'] === USER_AGENT));
  assert.equal(fake.requests[0].url.searchParams.get('api_key'), 'DEMO_KEY');
  assert.deepEqual(gladys.fake.sceneEvents, [], 'the first readings are a baseline');
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.match(
    gladys.fake.connectionStatus.message.fr,
    /passages d’astéroïdes sur 7 jours, 4 événements/,
  );
  assert.deepEqual(gladys.fake.states, [], 'no state for a device not created');
  assert.equal(app.houseEvents(HOUSES[0]).events[0].title, 'Flood in France');
  assert.equal(app.houseEvents(HOUSES[1]).events.length, 3);
});

test('rhythm: EONET every hour, EPIC every 3 hours, NeoWs every 6 hours (DEMO_KEY)', async (t) => {
  const { app, fake, clock } = await startApp(t);
  await app.tick();
  const counted = () => ['neows', 'epic', 'eonet'].map((service) => fake.count(service));
  assert.deepEqual(counted(), [1, 1, 2]);
  clock.now += MINUTE;
  await app.tick();
  assert.deepEqual(counted(), [1, 1, 2]);
  clock.now += HOUR;
  await app.tick();
  assert.deepEqual(counted(), [1, 1, 4]);
  clock.now += 2 * HOUR;
  await app.tick();
  assert.deepEqual(counted(), [1, 2, 6]);
  clock.now += 3 * HOUR;
  await app.tick();
  assert.deepEqual(counted(), [2, 3, 8]);
  // A whole day: 4 NeoWs requests, far below the 10 an hour of DEMO_KEY.
  for (let hour = 0; hour < 24; hour += 1) {
    clock.now += HOUR;
    await app.tick();
  }
  assert.equal(fake.count('neows'), 6);
});

test('devices: states once created, again after a new reading, texts in the language', async (t) => {
  const { gladys, app, clock, fake } = await startApp(t);
  await app.tick();
  await create(gladys, ASTEROIDS);
  await create(gladys, BESANCON);
  const ids = (device, key) => `${device}:${key}`;
  assert.equal(gladys.fake.lastState(ids(ASTEROIDS, 'closest_name')), '2015 VH65');
  assert.ok(Math.abs(gladys.fake.lastState(ids(ASTEROIDS, 'closest_lunar')) - 9.69) < 0.01);
  assert.ok(gladys.fake.lastState(ids(ASTEROIDS, 'closest_distance')) > 3.7e6);
  assert.equal(gladys.fake.lastState(ids(BESANCON, 'events_nearby')), 1);
  assert.match(
    gladys.fake.lastState(ids(BESANCON, 'nearest_event')),
    /^Flood in France \(Inondation, \d+ km\)$/,
  );
  assert.equal(gladys.fake.lastState(ids(LA, 'events_nearby')), undefined, 'not created');
  fake.set('neows', feedWithCloseApproach());
  clock.now += 6 * HOUR;
  await app.tick();
  assert.equal(gladys.fake.lastState(ids(ASTEROIDS, 'closest_name')), '2026 VX1');
  assert.equal(gladys.fake.lastState(ids(ASTEROIDS, 'closest_lunar')), 0.6);
});

test('triggers: a close and hazardous approach, then a new natural event near a house', async (t) => {
  const { gladys, app, clock, fake } = await startApp(t);
  await app.tick();
  fake.set('neows', feedWithCloseApproach());
  clock.now += 6 * HOUR;
  await app.tick();
  const [close] = events(gladys, TRIGGERS.CLOSE_APPROACH);
  const hazardous = events(gladys, TRIGGERS.HAZARDOUS_ASTEROID);
  assert.equal(events(gladys, TRIGGERS.CLOSE_APPROACH).length, 1);
  assert.equal(close.data.name, '2026 VX1');
  assert.equal(close.data.distance_lunar, 0.6);
  assert.equal(close.data.diameter_m, '140–310');
  assert.match(close.data.message, /^L’astéroïde 2026 VX1 passera .* à 0,6 distances lunaires/);
  assertPayload(TRIGGERS.CLOSE_APPROACH, close.data);
  // The 8 hazardous asteroids of the week were known at the first reading.
  assert.deepEqual(
    hazardous.map((event) => event.data.name),
    ['2026 VX1'],
  );
  assertPayload(TRIGGERS.HAZARDOUS_ASTEROID, hazardous[0].data);
  // Read again: no second event.
  clock.now += 6 * HOUR;
  await app.tick();
  assert.equal(events(gladys, TRIGGERS.CLOSE_APPROACH).length, 1);

  const europe = structuredClone(fixture('eonet-europe'));
  europe.events.push({
    id: 'EONET_99999',
    title: 'Wildfire Chaux Forest, Jura',
    closed: null,
    categories: [{ id: 'wildfires', title: 'Wildfires' }],
    sources: [{ id: 'EO', url: 'https://example.org/fire' }],
    geometry: [
      {
        magnitudeValue: 120,
        magnitudeUnit: 'acres',
        date: new Date(clock.now - HOUR).toISOString(),
        type: 'Point',
        coordinates: [5.62, 47.08],
      },
    ],
  });
  fake.set('eonet', europe);
  clock.now += HOUR;
  await app.tick();
  const natural = events(gladys, TRIGGERS.NATURAL_EVENT);
  // The same answer is served for both houses: only Besançon is within 500 km.
  assert.deepEqual(
    natural.map((event) => [event.data.device, event.data.title, event.data.category]),
    [[BESANCON, 'Wildfire Chaux Forest, Jura', 'wildfires']],
  );
  assert.equal(natural[0].data.category_label, 'Feu de forêt');
  assert.ok(natural[0].data.distance_km < 40);
  assert.equal(natural[0].data.magnitude, 120);
  assertPayload(TRIGGERS.NATURAL_EVENT, natural[0].data);
});

test('a larger radius learns the events that come into view, without firing', async (t) => {
  const { gladys, app, clock } = await startApp(t);
  await app.tick();
  await gladys.fake.configUpdated({ ...CONFIG, radius_km: '2000' });
  clock.now += MINUTE;
  await app.tick();
  assert.ok(app.houseEvents(HOUSES[0]).events.length >= 5);
  assert.deepEqual(events(gladys, TRIGGERS.NATURAL_EVENT), []);
});

test('errors: a refused key, an exhausted quota, NASA unreachable then back', async (t) => {
  const { gladys, app, clock, fake } = await startApp(t, {
    config: { ...CONFIG, api_key: 'WRONGKEY0123' },
  });
  await app.tick();
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /refuses the API key/);
  assert.doesNotMatch(JSON.stringify(app.store.data), /WRONGKEY0123/);
  // A refused key waits 6 hours, or a change of the key.
  clock.now += HOUR;
  await app.tick();
  assert.equal(fake.count('neows'), 1);
  await gladys.fake.configUpdated({ ...CONFIG, api_key: '' });
  fake.quota = 0;
  await app.tick();
  assert.equal(fake.count('neows'), 2);
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.match(gladys.fake.connectionStatus.message.fr, /quota horaire .*DEMO_KEY/);
  clock.now += 30 * MINUTE;
  await app.tick();
  assert.equal(fake.count('neows'), 2, 'the quota waits an hour');
  fake.quota = 10;
  clock.now += 31 * MINUTE;
  await app.tick();
  assert.equal(fake.count('neows'), 3);
  assert.equal(app.asteroidWeek().closest.name, '2015 VH65');
  fake.offline = true;
  for (let i = 0; i < 8; i += 1) {
    clock.now += 7 * HOUR;
    await app.tick();
  }
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /do not answer since/);
  fake.offline = false;
  clock.now += 7 * HOUR;
  await app.tick();
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('restart: what was read survives in /data, nothing is read twice, no event fired again', async (t) => {
  const dir = dataDir();
  const clock = { now: NOW };
  const fake = await startFakeNasa();
  const first = await startApp(t, { dir, clock, fake });
  await first.app.tick();
  await first.gladys.fake.shutdown();
  const second = await startApp(t, { dir, clock, fake });
  clock.now += MINUTE;
  await second.app.tick();
  assert.equal(fake.count('neows'), 1);
  assert.equal(second.app.asteroidWeek().closest.name, '2015 VH65');
  assert.deepEqual(second.gladys.fake.sceneEvents, []);
});

test('scene actions: the outputs declared, from what was read', async (t) => {
  const { gladys, app } = await startApp(t);
  await app.tick();
  const asteroids = (await gladys.fake.sceneAction(SCENE_ACTIONS.GET_ASTEROIDS)).data.outputs;
  assert.deepEqual(Object.keys(asteroids), ASTEROID_OUTPUTS);
  assert.equal(asteroids.closest_name, '2015 VH65');
  assert.equal(asteroids.closest_distance_lunar, 9.69);
  assert.match(asteroids.summary, /^\d+ astéroïdes passent près de la Terre/);
  const near = (await gladys.fake.sceneAction(SCENE_ACTIONS.GET_NATURAL_EVENTS, { device: LA }))
    .data.outputs;
  assert.deepEqual(Object.keys(near), EVENT_OUTPUTS);
  assert.equal(near.house, 'Studio');
  assert.equal(near.count, 3);
  assert.equal(near.nearest_category, 'Feu de forêt');
  const first = (await gladys.fake.sceneAction(SCENE_ACTIONS.GET_NATURAL_EVENTS, {})).data.outputs;
  assert.equal(first.house, 'Maison');
  const earth = (await gladys.fake.sceneAction(SCENE_ACTIONS.GET_EARTH_IMAGE, { device: LA })).data
    .outputs;
  assert.deepEqual(Object.keys(earth), EARTH_OUTPUTS);
  assert.match(
    earth.image_url,
    /^https:\/\/epic\.gsfc\.nasa\.gov\/archive\/natural\/2026\/11\/03\/jpg\//,
  );
  // The images of 2026-11-03 go from 157.7° E to -4.4°: 157.7° is the closest to -118.2°.
  assert.equal(earth.centre_longitude, 157.67, 'the image facing Los Angeles best');
  for (const outputs of [asteroids, near, earth]) {
    for (const value of Object.values(outputs)) {
      assert.ok(value === null || ['string', 'number', 'boolean'].includes(typeof value));
    }
  }
});

test('scene actions read what is missing, and fail clearly without data', async (t) => {
  const { gladys, fake } = await startApp(t);
  const asteroids = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_ASTEROIDS);
  assert.equal(asteroids.success, true);
  assert.equal(fake.count('neows'), 1);
  fake.offline = true;
  const earth = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_EARTH_IMAGE);
  assert.equal(earth.success, false);
});

test('widgets: valid contents in every language, the EPIC image read once', async (t) => {
  const { gladys, app, fake } = await startApp(t);
  const waiting = (await gladys.fake.widgetGet(WIDGETS.ASTEROIDS, { language: 'fr' })).data.content;
  assert.match(waiting.components[0].text, /première lecture/);
  await app.tick();
  for (const language of LANGUAGES) {
    for (const [key, settings] of [
      [WIDGETS.ASTEROIDS, { sort: 'date' }],
      [WIDGETS.EARTH, { device: LA }],
      [WIDGETS.NATURAL_EVENTS, { device: BESANCON }],
      [WIDGETS.NATURAL_EVENTS, {}],
    ]) {
      const content = (await gladys.fake.widgetGet(key, { settings, language })).data.content;
      assert.deepEqual(validateWidgetContent(content), [], `${key} ${language}`);
    }
  }
  const earth = (await gladys.fake.widgetGet(WIDGETS.EARTH, { settings: {}, language: 'en' })).data
    .content;
  const key = earth.components[0].key;
  assert.equal(key, 'epic-20261103112447', 'the image facing Besançon');
  const before = fake.count('image');
  const image = await gladys.fake.widgetGetImage(key);
  assert.deepEqual(validateWidgetImage(image.data.image ?? image.data), []);
  await gladys.fake.widgetGetImage(key);
  assert.equal(fake.count('image'), before + 1, 'kept in memory');
  const unknown = await gladys.fake.widgetGetImage('epic-1');
  assert.equal(unknown.success, false);
  assert.ok(gladys.fake.widgetRefreshes.includes(WIDGETS.ASTEROIDS));
});

test('widgets without a located house', async (t) => {
  const { gladys, app } = await startApp(t, { houses: [HOUSES[2]] });
  await app.tick();
  const events = (await gladys.fake.widgetGet(WIDGETS.NATURAL_EVENTS, { language: 'de' })).data
    .content;
  assert.match(events.components[0].text, /Standort/);
  const earth = (await gladys.fake.widgetGet(WIDGETS.EARTH, { language: 'en' })).data.content;
  assert.equal(earth.components[0].key, 'epic-20261103112447', 'the latest image');
  assert.match(gladys.fake.connectionStatus.message.en, /No house of Gladys has a location/);
});

test('configuration: defaults, language, test and diagnostic buttons, a scan', async (t) => {
  const { gladys, app } = await startApp(t, { config: {} });
  assert.deepEqual(app.getConfig(), {
    apiKey: '',
    language: 'auto',
    radiusKm: 500,
    eventDays: 14,
    lunarThreshold: 5,
  });
  assert.equal(
    gladys.fake.discoveredDevices[0].name,
    'Astéroïdes géocroiseurs (NASA)',
    'auto: the timezone of Gladys',
  );
  await gladys.fake.configUpdated({ language: 'de' });
  assert.equal(gladys.fake.discoveredDevices[0].name, 'Erdnahe Asteroiden (NASA)');
  const result = await gladys.fake.action(ACTIONS.TEST_CONNECTION);
  assert.equal(result.success, true);
  assert.match(
    result.data.message.fr,
    /^La NASA répond\. Astéroïdes : \d+ passages sur 7 jours \(DEMO_KEY\)\. Terre : images EPIC du 3 nov\.\. Événements naturels : \d+ près de Maison, Studio\.$/,
  );
  const diagnostic = await gladys.fake.action(ACTIONS.DIAGNOSTIC);
  assert.match(diagnostic.data.message.en, /NASA diagnostic/);
  await gladys.fake.scanRequest();
  assert.equal(gladys.fake.discoveredDevices.length, 3);
});
