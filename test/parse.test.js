// The readers of the three services, on the real answers of 2026-11-05.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, weekOf, upcoming, diameterRange, cleanName } from '../src/neo.js';
import { parseEpic, imagesFor, imageKey, imageUrl, longitudeGap } from '../src/epic.js';
import {
  parseEvents,
  eventsNear,
  boundingBox,
  distanceKm,
  distanceTo,
  CATEGORIES,
} from '../src/eonet.js';
import { fixture, NOW, DAY } from './helpers/fake-nasa.js';

const BESANCON = { latitude: 47.24, longitude: 6.02 };

test('NeoWs: every approach to the Earth, by instant, with numbers', () => {
  const approaches = parseFeed(fixture('neo-feed'));
  assert.equal(approaches.length, 51);
  assert.deepEqual(
    approaches.map((a) => a.at),
    [...approaches.map((a) => a.at)].sort((a, b) => a - b),
  );
  const vh65 = approaches.find((a) => a.name === '2015 VH65');
  assert.ok(vh65.lunar > 9.68 && vh65.lunar < 9.7);
  assert.ok(Number.isFinite(vh65.km) && Number.isFinite(vh65.kms));
  assert.match(vh65.id, /^\d+@\d+$/);
  assert.match(vh65.url, /^https:\/\/ssd\.jpl\.nasa\.gov\//);
  assert.equal(approaches.filter((a) => a.hazardous).length, 8);
  assert.equal(parseFeed({}), null);
  assert.equal(parseFeed(null), null);
});

test('NeoWs: the date without epoch, other bodies skipped, names cleaned', () => {
  const feed = {
    near_earth_objects: {
      '2026-11-07': [
        {
          id: '123',
          name: '(2007 VV83)',
          estimated_diameter: {
            meters: { estimated_diameter_min: 30.5, estimated_diameter_max: 68.2 },
          },
          close_approach_data: [
            {
              close_approach_date: '2026-11-07',
              close_approach_date_full: '2026-Nov-07 00:21',
              miss_distance: { kilometers: '384400', lunar: '1' },
              orbiting_body: 'Earth',
            },
            {
              close_approach_date: '2026-11-08',
              miss_distance: { kilometers: '1' },
              orbiting_body: 'Mars',
            },
          ],
        },
      ],
    },
  };
  const [approach, ...rest] = parseFeed(feed);
  assert.equal(rest.length, 0);
  assert.equal(approach.at, Date.parse('2026-11-07T00:21:00Z'));
  assert.equal(approach.name, '2007 VV83');
  assert.equal(diameterRange(approach), '31–68');
  assert.equal(cleanName('433 Eros (A898 PA)'), '433 Eros (A898 PA)');
});

test('NeoWs: the week to come, its closest approach and its counts', () => {
  const approaches = parseFeed(fixture('neo-feed'));
  const week = weekOf(approaches, NOW);
  assert.ok(week.list.every((a) => a.at >= NOW && a.at <= NOW + 7 * DAY));
  assert.equal(week.closest.name, '2015 VH65');
  assert.equal(week.count, upcoming(approaches, NOW).length);
  assert.ok(week.hazardous >= 1);
  assert.equal(weekOf([], NOW).closest, null);
});

test('EPIC: the images, the one facing a longitude, a stable key, the public URL', () => {
  const images = parseEpic(fixture('epic-natural'));
  assert.equal(images.length, 7);
  assert.equal(images[0].at, Date.parse('2026-11-03T00:31:45Z'));
  // Besançon (6° E): the image centred on -4.4° E, then 22.6°.
  assert.equal(imagesFor(images, 6.02)[0].image, 'epic_1b_20261103112447');
  // No house: the latest.
  assert.equal(imagesFor(images, null)[0].image, 'epic_1b_20261103112447');
  // Tokyo (139.7° E): the image centred on 130.6°.
  assert.equal(imagesFor(images, 139.7)[0].image, 'epic_1b_20261103022436');
  assert.equal(longitudeGap(170, -170), 20);
  assert.equal(imageKey(images[0]), 'epic-20261103003634');
  assert.match(imageKey(images[0]), /^[a-z0-9][a-z0-9-]{0,63}$/);
  assert.equal(
    imageUrl(images[0]),
    'https://epic.gsfc.nasa.gov/archive/natural/2026/11/03/jpg/epic_1b_20261103003634.jpg',
  );
  assert.equal(parseEpic({}), null);
  assert.deepEqual(parseEpic([{ image: 'x' }]), []);
});

test('EONET: events, their last date and position, the number of GDACS cut from the title', () => {
  const events = parseEvents(fixture('eonet-europe'));
  assert.ok(events.length >= 6);
  const france = events.find((e) => e.title === 'Flood in France');
  assert.equal(france.category, 'floods');
  assert.equal(france.geometry.type, 'Polygon');
  assert.match(france.url, /^https:\/\/www\.gdacs\.org\//);
  const world = parseEvents(fixture('eonet-open-30d'));
  const storm = world.find((e) => e.category === 'severeStorms');
  assert.equal(storm.unit, 'kts');
  assert.ok(Number.isFinite(storm.magnitude));
  assert.ok(storm.track.length > 1);
  assert.ok(world.every((e) => CATEGORIES.includes(e.category) || e.category === 'other'));
  assert.equal(parseEvents({}), null);
});

test('EONET: distances, polygons, the events within a radius and a period', () => {
  assert.ok(Math.abs(distanceKm(48.8566, 2.3522, 51.5074, -0.1278) - 344) < 2);
  const square = {
    type: 'Polygon',
    coordinates: [
      [
        [5, 46],
        [7, 46],
        [7, 48],
        [5, 48],
        [5, 46],
      ],
    ],
  };
  assert.equal(distanceTo(BESANCON, square), 0);
  assert.ok(distanceTo(BESANCON, { type: 'Point', coordinates: [6.02, 48.24] }) > 110);
  const events = parseEvents(fixture('eonet-europe'));
  const near = eventsNear(events, BESANCON, { radiusKm: 500, since: NOW - 30 * DAY });
  assert.deepEqual(
    near.map((e) => e.title),
    ['Flood in France'],
  );
  assert.ok(near[0].distance > 300 && near[0].distance < 500);
  assert.equal(near[0].geometry, undefined, 'no geometry kept');
  assert.deepEqual(eventsNear(events, BESANCON, { radiusKm: 500, since: NOW - 7 * DAY }), []);
  assert.ok(eventsNear(events, BESANCON, { radiusKm: 2000, since: NOW - 30 * DAY }).length >= 5);
});

test('EONET: the box of a radius, clamped to the map', () => {
  const [west, north, east, south] = boundingBox(BESANCON, 500);
  assert.ok(Math.abs(north - 51.74) < 0.05 && Math.abs(south - 42.74) < 0.05);
  assert.ok(west < -0.5 && east > 12.5);
  assert.deepEqual(boundingBox({ latitude: 89, longitude: 0 }, 500).slice(0, 3), [-180, 90, 180]);
  const pacific = boundingBox({ latitude: 0, longitude: 179 }, 1000);
  assert.equal(pacific[2], 180);
});
