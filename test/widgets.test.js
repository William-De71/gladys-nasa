// Every widget content passes the validator of the SDK (the rules of the
// core) in the four languages, with the real answers of 2026-11-05.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent, validateWidgetImage } from '@gladysassistant/integration-sdk';
import {
  WIDGETS,
  buildAsteroidsWidget,
  buildEarthWidget,
  buildEventsWidget,
  messageContent,
} from '../src/widgets.js';
import { parseFeed, weekOf } from '../src/neo.js';
import { parseEpic, imagesFor, imageKey } from '../src/epic.js';
import { parseEvents, eventsNear } from '../src/eonet.js';
import { LANGUAGES } from '../src/i18n.js';
import { fixture, NOW, TZ, DAY, HOUR } from './helpers/fake-nasa.js';

const HOUSE = { id: 'h', name: 'Maison', latitude: 47.24, longitude: 6.02 };
const week = weekOf(parseFeed(fixture('neo-feed')), NOW);
const images = parseEpic(fixture('epic-natural'));
const events = eventsNear(parseEvents(fixture('eonet-europe')), HOUSE, {
  radiusKm: 2000,
  since: NOW - 30 * DAY,
});
const clean = (content) => assert.deepEqual(validateWidgetContent(content), []);

test('the keys of the widgets', () => {
  assert.deepEqual(Object.values(WIDGETS), ['asteroids', 'earth', 'natural_events']);
});

test('asteroids: tiles, the list sorted by distance or date, badges, details and JPL links', () => {
  for (const language of LANGUAGES) {
    for (const sort of ['distance', 'date']) {
      const content = buildAsteroidsWidget({
        week,
        updatedAt: NOW - HOUR,
        threshold: 20,
        language,
        timeZone: TZ,
        now: NOW,
        settings: { sort },
      });
      clean(content);
      const [closest, count, hazardous, list] = content.components;
      assert.equal(closest.color, 'warning');
      assert.equal(count.value, week.count);
      assert.equal(hazardous.value, week.hazardous);
      assert.equal(list.items.length, 8);
      if (sort === 'distance') assert.equal(list.items[0].title, '2015 VH65');
      assert.ok(list.items.some((item) => item.badge?.color === 'danger'));
      assert.match(list.items[0].links[0].url, /^https:\/\/ssd\.jpl\.nasa\.gov/);
      assert.equal(list.items[0].date, undefined, 'the date would replace the subtitle');
    }
  }
  const empty = buildAsteroidsWidget({
    week: weekOf([], NOW),
    updatedAt: NOW,
    threshold: 5,
    language: 'fr',
    timeZone: TZ,
    now: NOW,
  });
  clean(empty);
  assert.equal(empty.components.length, 4);
  clean(buildAsteroidsWidget({ week, updatedAt: null, threshold: 5, language: 'en', now: NOW }));
});

test('earth: the image facing the house, its key, a caption', () => {
  for (const language of LANGUAGES) {
    const image = imagesFor(images, HOUSE.longitude)[0];
    const content = buildEarthWidget({ image, house: HOUSE, language, timeZone: TZ });
    clean(content);
    assert.equal(content.components[0].key, imageKey(image));
    assert.match(content.components[1].text, /Maison/);
    clean(buildEarthWidget({ image, house: null, language, timeZone: TZ }));
  }
  clean(buildEarthWidget({ image: null, house: HOUSE, language: 'en' }));
  assert.deepEqual(validateWidgetImage(fixture('epic-thumb').toString('base64')), []);
});

test('natural events: count, nearest distance, the list with categories and sources', () => {
  for (const language of LANGUAGES) {
    const content = buildEventsWidget({
      house: HOUSE,
      events,
      updatedAt: NOW - HOUR,
      radiusKm: 2000,
      eventDays: 30,
      language,
      timeZone: TZ,
      now: NOW,
    });
    clean(content);
    const [count, nearest, list] = content.components;
    assert.equal(count.value, events.length);
    assert.equal(nearest.value, events[0].distance);
    assert.equal(list.items[0].title, 'Flood in France');
    assert.match(list.items[0].badge.text, /km$/);
    const none = buildEventsWidget({
      house: HOUSE,
      events: [],
      updatedAt: NOW,
      radiusKm: 100,
      eventDays: 7,
      language,
      timeZone: TZ,
      now: NOW,
    });
    clean(none);
    assert.equal(none.components[0].color, 'success');
  }
  clean(messageContent('x', { heading: 'y' }));
});
