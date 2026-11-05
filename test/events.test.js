// The detectors of the scene triggers: once per approach or event, never at
// the first reading, never after a change of the radius or the period.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRIGGERS, detectAsteroids, detectNaturalEvents } from '../src/events.js';
import { NOW, DAY, HOUR } from './helpers/fake-nasa.js';

const approach = (id, { at = NOW + DAY, lunar = 10, hazardous = false } = {}) => ({
  id: `${id}@${at}`,
  name: `A ${id}`,
  at,
  lunar,
  km: lunar * 384400,
  hazardous,
});

test('asteroids: the first reading learns, then once per close or hazardous approach', () => {
  const first = detectAsteroids(undefined, {
    approaches: [approach(1, { lunar: 2 }), approach(2, { hazardous: true })],
    threshold: 5,
    now: NOW,
  });
  assert.deepEqual(first.events, []);
  const second = detectAsteroids(first.next, {
    approaches: [
      approach(1, { lunar: 2 }),
      approach(2, { hazardous: true }),
      approach(3, { lunar: 0.8, hazardous: true }),
      approach(4, { lunar: 20 }),
    ],
    threshold: 5,
    now: NOW + HOUR,
  });
  assert.deepEqual(
    second.events.map((e) => [e.key, e.approach.name]),
    [
      [TRIGGERS.CLOSE_APPROACH, 'A 3'],
      [TRIGGERS.HAZARDOUS_ASTEROID, 'A 3'],
    ],
  );
  const third = detectAsteroids(second.next, {
    approaches: [approach(3, { lunar: 0.8, hazardous: true })],
    threshold: 5,
    now: NOW + 2 * HOUR,
  });
  assert.deepEqual(third.events, []);
});

test('asteroids: a passed approach is not news, and is forgotten a day later', () => {
  const passed = approach(9, { at: NOW - HOUR, lunar: 1 });
  const { events, next } = detectAsteroids(
    { initialized: true, close: [], hazardous: [] },
    { approaches: [passed], threshold: 5, now: NOW },
  );
  assert.deepEqual(events, []);
  const later = detectAsteroids(
    { initialized: true, close: [passed.id, approach(8).id], hazardous: [] },
    { approaches: [], threshold: 5, now: NOW + 2 * DAY },
  );
  assert.deepEqual(later.next.close, [approach(8).id]);
  assert.ok(next.initialized);
});

test('natural events: learn first, then once per new event, learn again on a new scope', () => {
  const a = { id: 'EONET_1' };
  const b = { id: 'EONET_2' };
  const first = detectNaturalEvents(undefined, { events: [a], scope: '500/14' });
  assert.deepEqual(first.events, []);
  const second = detectNaturalEvents(first.next, { events: [a, b], scope: '500/14' });
  assert.deepEqual(second.events, [b]);
  const third = detectNaturalEvents(second.next, { events: [b, a], scope: '500/14' });
  assert.deepEqual(third.events, []);
  // A larger radius brings older events into view: not news.
  const wider = detectNaturalEvents(third.next, {
    events: [a, b, { id: 'EONET_3' }],
    scope: '1000/14',
  });
  assert.deepEqual(wider.events, []);
  // An event gone then back is not new.
  const gone = detectNaturalEvents(wider.next, { events: [b], scope: '1000/14' });
  const back = detectNaturalEvents(gone.next, { events: [a, b], scope: '1000/14' });
  assert.deepEqual(back.events, []);
});
