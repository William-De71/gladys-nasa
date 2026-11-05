// The traps of the Gladys core that the fake Gladys does not catch
// (community feedback, thread 11005): should_poll, min / max / read_only /
// has_feedback on every feature, category / type / unit triples the core
// knows (DEVICE_FEATURE_UNITS_BY_CATEGORY of server/utils/constants.js, read
// on the Gladys master of 2026-11-05: km for `distance-sensor`, no unit for
// `counter-sensor`, `unknown` and `text`), a single invalid field rejecting
// the whole discovery batch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import {
  DEVICE_FEATURE_CATEGORIES as C,
  DEVICE_FEATURE_TYPES as T,
  DEVICE_FEATURE_UNITS as U,
} from '@gladysassistant/integration-sdk';
import {
  ASTEROID_FEATURES,
  EVENT_FEATURES,
  asteroidIds,
  eventIds,
  houseOfExternalId,
  buildAsteroidsDevice,
  buildEventsDevice,
  buildAsteroidStates,
  buildEventStates,
} from '../src/device.js';
import { LANGUAGES } from '../src/i18n.js';

const fakeGladys = {
  externalIds: (type, id) => ({
    device: `ext:nasa:${type}:${id}`,
    feature: (key) => `ext:nasa:${type}:${id}:${key}`,
  }),
};
const HOUSE = { id: '6f1c2d3e-0000-4000-8000-000000000001', name: 'Maison', selector: 'maison' };
const TRIPLES = {
  closest_distance: [C.DISTANCE_SENSOR, T.SENSOR.DECIMAL, U.KM],
  closest_lunar: [C.UNKNOWN, T.UNKNOWN.UNKNOWN, undefined],
  approaches: [C.COUNTER_SENSOR, T.SENSOR.INTEGER, undefined],
  hazardous: [C.COUNTER_SENSOR, T.SENSOR.INTEGER, undefined],
  closest_name: [C.TEXT, T.TEXT.TEXT, undefined],
  events_nearby: [C.COUNTER_SENSOR, T.SENSOR.INTEGER, undefined],
  nearest_distance: [C.DISTANCE_SENSOR, T.SENSOR.DECIMAL, U.KM],
  nearest_event: [C.TEXT, T.TEXT.TEXT, undefined],
};
// The units of the core for these categories (none for the others).
const CORE_UNITS = { [C.DISTANCE_SENSOR]: ['mm', 'cm', 'm', 'km', 'inch', 'feet', 'mile'] };
const devices = (language) => [
  buildAsteroidsDevice(fakeGladys, language),
  buildEventsDevice(fakeGladys, HOUSE, language),
];

test('devices are never polled by Gladys: the integration has its own timer', () => {
  for (const device of devices('en')) {
    assert.equal(device.should_poll, false);
    assert.equal(device.poll_frequency, undefined);
  }
});

test('every feature: min, max, read_only, has_feedback, a unique name, in every language', () => {
  for (const language of LANGUAGES) {
    for (const device of devices(language)) {
      for (const feature of device.features) {
        assert.equal(typeof feature.min, 'number', feature.external_id);
        assert.equal(typeof feature.max, 'number', feature.external_id);
        assert.ok(feature.min <= feature.max);
        assert.equal(feature.read_only, true);
        assert.equal(feature.has_feedback, false);
        assert.ok(feature.name.length <= 50, feature.name);
      }
      assert.equal(new Set(device.features.map((f) => f.name)).size, device.features.length);
      assert.ok(device.name.length <= 100);
    }
  }
});

test('category / type / unit triples of the SDK, with a unit the core has', () => {
  for (const device of devices('en')) {
    for (const feature of device.features) {
      const key = feature.external_id.split(':').pop();
      assert.deepEqual([feature.category, feature.type, feature.unit], TRIPLES[key], key);
      if (feature.unit) assert.ok(CORE_UNITS[feature.category].includes(feature.unit), key);
    }
  }
  assert.deepEqual(
    devices('en').flatMap((d) => d.features.map((f) => f.external_id.split(':').pop())),
    Object.keys(TRIPLES),
  );
});

test('names and ids: one asteroids device, one natural events device per house', () => {
  const [asteroids, events] = devices('fr');
  assert.equal(asteroids.name, 'Astéroïdes géocroiseurs (NASA)');
  assert.equal(asteroids.external_id, 'ext:nasa:asteroids:global');
  assert.equal(events.name, 'Événements naturels – Maison');
  assert.equal(events.external_id, `ext:nasa:natural-events:${HOUSE.id}`);
  assert.equal(houseOfExternalId(`${events.external_id}:events_nearby`), HOUSE.id);
  assert.equal(houseOfExternalId(events.external_id), HOUSE.id);
  assert.equal(houseOfExternalId(asteroids.external_id), null);
  assert.equal(houseOfExternalId(undefined), null);
  assert.equal(asteroidIds(fakeGladys).feature('hazardous'), 'ext:nasa:asteroids:global:hazardous');
  assert.equal(eventIds(fakeGladys, 'x').device, 'ext:nasa:natural-events:x');
});

test('states: rounded and bounded, texts, an unknown value left untouched', () => {
  const states = buildAsteroidStates(fakeGladys, {
    closest_distance: 3724833.6,
    closest_lunar: 9.68951,
    approaches: 48,
    hazardous: null,
    closest_name: '2015 VH65',
  });
  assert.deepEqual(
    states.map((s) => [s.device_feature_external_id.split(':').pop(), s.state ?? s.text]),
    [
      ['closest_distance', 3724834],
      ['closest_lunar', 9.69],
      ['approaches', 48],
      ['closest_name', '2015 VH65'],
    ],
  );
  assert.equal(
    buildEventStates(fakeGladys, 'h', { events_nearby: 0, nearest_event: 'Aucun' }).length,
    2,
  );
  assert.equal(ASTEROID_FEATURES.length + EVENT_FEATURES.length, 8);
});

test('the discovery batch and the states pass the checks of the fake host API', async (t) => {
  const gladys = createFakeGladys({});
  t.after(() => gladys.fake.shutdown());
  await gladys.connect();
  for (const language of LANGUAGES) {
    await gladys.publishDiscoveredDevices([
      buildAsteroidsDevice(gladys, language),
      buildEventsDevice(gladys, HOUSE, language),
    ]);
  }
  for (const device of gladys.fake.discoveredDevices) await gladys.fake.deviceCreated(device);
  await gladys.publishStates([
    ...buildAsteroidStates(gladys, {
      closest_distance: 3724833,
      approaches: 48,
      closest_name: 'x',
    }),
    ...buildEventStates(gladys, HOUSE.id, { events_nearby: 1, nearest_distance: 431 }),
  ]);
  assert.equal(gladys.fake.lastState(asteroidIds(gladys).feature('approaches')), 48);
  assert.equal(gladys.fake.lastState(eventIds(gladys, HOUSE.id).feature('nearest_distance')), 431);
});
