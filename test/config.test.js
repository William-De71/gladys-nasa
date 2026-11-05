import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, readLanguage, guessLanguage, INTERNAL_KEYS } from '../src/config.js';

test('key, language, radius, period and threshold, with their defaults', () => {
  const defaults = {
    apiKey: '',
    language: 'auto',
    radiusKm: 500,
    eventDays: 14,
    lunarThreshold: 5,
  };
  assert.deepEqual(normalizeConfig(), defaults);
  assert.deepEqual(normalizeConfig(null), defaults);
  assert.deepEqual(
    normalizeConfig({
      api_key: ' abcDEF123456789 ',
      language: 'es',
      radius_km: '2000',
      event_days: '30',
      lunar_threshold: '1',
    }),
    { apiKey: 'abcDEF123456789', language: 'es', radiusKm: 2000, eventDays: 30, lunarThreshold: 1 },
  );
  assert.deepEqual(
    normalizeConfig({
      api_key: 'bad key with spaces',
      language: 'it',
      radius_km: '300',
      event_days: 3,
      lunar_threshold: '0.5',
    }),
    defaults,
  );
  assert.equal(normalizeConfig({ radius_km: 250 }).radiusKm, 250);
});

test('the language of the last widget, else the timezone', () => {
  assert.equal(readLanguage({ [INTERNAL_KEYS.language]: 'de' }, 'en'), 'de');
  assert.equal(readLanguage({ [INTERNAL_KEYS.language]: 'xx' }, 'fr'), 'fr');
  assert.deepEqual(
    [
      'Europe/Paris',
      'Europe/Berlin',
      'Europe/Madrid',
      'America/Argentina/Cordoba',
      'Asia/Tokyo',
      '',
    ].map(guessLanguage),
    ['fr', 'de', 'es', 'es', 'en', 'en'],
  );
});
