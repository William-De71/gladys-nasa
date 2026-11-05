// The HTTP client against the fake NASA (a real server on 127.0.0.1).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createNasaClient,
  epicImagePath,
  redact,
  NasaError,
  MAX_IMAGE_BYTES,
} from '../src/nasa-api.js';
import { startFakeNasa, NOW } from './helpers/fake-nasa.js';

const start = async (t) => {
  const fake = await startFakeNasa();
  t.after(() => fake.close());
  return { fake, api: createNasaClient({ userAgent: 'gladys-nasa/test', urls: fake.urls }) };
};

test('NeoWs: 8 calendar days from today (the 7-day limit), the key, the quota headers', async (t) => {
  const { fake, api } = await start(t);
  const feed = await api.neoFeed({ from: NOW, key: '' });
  assert.equal(feed.element_count, 51);
  const [request] = fake.requests;
  assert.equal(request.url.searchParams.get('start_date'), '2026-11-05');
  assert.equal(request.url.searchParams.get('end_date'), '2026-11-12');
  assert.equal(request.url.searchParams.get('api_key'), 'DEMO_KEY');
  assert.equal(request.headers['user-agent'], 'gladys-nasa/test');
  assert.equal(api.quota().limit, 10);
  await api.neoFeed({ from: NOW, key: 'MyOwnKey12345' });
  assert.equal(fake.requests[1].url.searchParams.get('api_key'), 'MyOwnKey12345');
  assert.equal(api.quota().limit, 1000);
});

test('NeoWs errors: a refused key, an exhausted quota, another status; the key never shows', async (t) => {
  const { fake, api } = await start(t);
  await assert.rejects(api.neoFeed({ from: NOW, key: 'WRONGKEY0123' }), (err) => {
    assert.ok(err instanceof NasaError);
    assert.equal(err.kind, 'key');
    assert.equal(err.status, 403);
    assert.doesNotMatch(err.message, /WRONGKEY0123/);
    return true;
  });
  fake.quota = 0;
  await assert.rejects(api.neoFeed({ from: NOW, key: '' }), { kind: 'quota', status: 429 });
  fake.quota = 10;
  fake.fail('neows', 503);
  await assert.rejects(api.neoFeed({ from: NOW, key: '' }), { kind: 'http', status: 503 });
  fake.offline = true;
  await assert.rejects(api.neoFeed({ from: NOW, key: '' }), { kind: 'unreachable' });
});

test('EPIC: the list, an image by its archive path, a JPEG of 300 kB at most', async (t) => {
  const { fake, api } = await start(t);
  const list = await api.epicLatest();
  assert.equal(list.length, 7);
  const bytes = await api.epicImage(list[0]);
  assert.equal(bytes[0], 0xff);
  assert.equal(
    fake.requests.at(-1).url.pathname,
    '/archive/natural/2026/11/03/jpg/epic_1b_20261103003634.jpg',
  );
  await api.epicImage(list[0], { size: 'thumbs' });
  assert.match(fake.requests.at(-1).url.pathname, /\/thumbs\/epic_1b_20261103003634\.jpg$/);
  fake.set('image', Buffer.alloc(MAX_IMAGE_BYTES + 1, 0xff));
  await assert.rejects(api.epicImage(list[0]), { kind: 'too_large' });
  fake.set('image', Buffer.from('<html>'));
  await assert.rejects(api.epicImage(list[0]), { kind: 'invalid' });
  assert.throws(() => epicImagePath({ image: '../etc', date: '2026-11-03' }), { kind: 'invalid' });
});

test('EONET: every status, the period, a rounded box', async (t) => {
  const { fake, api } = await start(t);
  const answer = await api.eonetEvents({ bbox: [-0.61234, 51.7, 12.65, 42.7], days: 30 });
  assert.ok(answer.events.length >= 6);
  const { searchParams } = fake.requests[0].url;
  assert.equal(searchParams.get('status'), 'all');
  assert.equal(searchParams.get('days'), '30');
  assert.equal(searchParams.get('bbox'), '-0.612,51.7,12.65,42.7');
  fake.set('eonet', '');
  fake.fail('eonet', 500);
  await assert.rejects(api.eonetEvents({ bbox: [0, 1, 1, 0], days: 7 }), { kind: 'http' });
});

test('redact hides a personal key, never DEMO_KEY', () => {
  assert.equal(redact('api_key=abc123456 failed', 'abc123456'), 'api_key=*** failed');
  assert.equal(redact('api_key=DEMO_KEY', 'DEMO_KEY'), 'api_key=DEMO_KEY');
  assert.equal(redact('text', ''), 'text');
});
