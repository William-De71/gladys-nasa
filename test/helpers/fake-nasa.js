// A fake NASA for the tests: a real HTTP server on 127.0.0.1 serving the REAL
// answers downloaded on 2026-11-05 around 19:45 UTC (test/fixtures/nasa/):
// the NeoWs feed of 2026-11-05 to 2026-11-12, the EPIC list of 2026-11-03,
// the EONET events of western Europe (30 days, polygons cut to 40 vertices)
// and the open events of the world (30 days). Tests never touch the network.
// Nothing starts on import (`node --test` also runs this file).
//
//   - NeoWs answers like api.nasa.gov: 403 `API_KEY_INVALID` for a key
//     listed in `fake.badKeys`, 400 for a range over 7 days, the
//     x-ratelimit headers; `fake.quota = 0` answers 429 `OVER_RATE_LIMIT`;
//   - EONET answers the Europe file for a box over France, the world file
//     otherwise (`fake.set('eonet', …)` replaces both);
//   - `fake.fail(service, status)` answers an error, `fake.offline = true`
//     drops the connections; `fake.requests` lists what was asked.

import { createServer } from 'node:http';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The files were read at 19:45 UTC: a Thursday, 20:45 in Paris.
const NOW = Date.parse('2026-11-05T19:45:00Z');
const TZ = 'Europe/Paris';
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const silent = { info() {}, warn() {}, error() {}, debug() {} };

/**
 * @description A temporary folder standing for /data.
 * @returns {string} The path.
 */
const dataDir = () => mkdtempSync(join(tmpdir(), 'gladys-nasa-'));

const FIXTURES = new URL('../fixtures/nasa/', import.meta.url);

/**
 * @description A real answer, parsed (or the bytes of the JPEG).
 * @param {string} name - `neo-feed`, `epic-natural`, `eonet-europe`, `eonet-open-30d`, `epic-thumb`.
 * @returns {unknown} The JSON, or a Buffer.
 */
function fixture(name) {
  if (name === 'epic-thumb') return readFileSync(new URL('epic-thumb.jpg', FIXTURES));
  return JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES), 'utf8'));
}

/**
 * @description Start the fake NASA.
 * @returns {Promise<object>} `{ urls, set, fail, requests, close, … }`.
 */
async function startFakeNasa() {
  const content = {
    neows: fixture('neo-feed'),
    epic: fixture('epic-natural'),
    eonet: null,
    image: fixture('epic-thumb'),
  };
  const failures = new Map();
  const fake = {
    requests: [],
    offline: false,
    badKeys: new Set(['WRONGKEY0123']),
    quota: 1000,
    set(service, value) {
      content[service] = value;
    },
    fail(service, status) {
      if (status) failures.set(service, status);
      else failures.delete(service);
    },
    count(service) {
      return fake.requests.filter((request) => request.service === service).length;
    },
  };
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    const service = url.pathname.startsWith('/neo/')
      ? 'neows'
      : url.pathname.startsWith('/api/natural')
        ? 'epic'
        : url.pathname.startsWith('/archive/')
          ? 'image'
          : url.pathname.startsWith('/api/v3/events')
            ? 'eonet'
            : 'other';
    fake.requests.push({ service, url, headers: request.headers });
    if (fake.offline) {
      request.socket.destroy();
      return;
    }
    const send = (status, body, type = 'application/json', headers = {}) => {
      response.writeHead(status, { 'Content-Type': type, ...headers });
      response.end(Buffer.isBuffer(body) ? body : JSON.stringify(body));
    };
    if (failures.has(service)) {
      send(failures.get(service), { error: 'failure' });
      return;
    }
    if (service === 'neows') {
      const key = url.searchParams.get('api_key');
      if (fake.badKeys.has(key)) {
        send(403, {
          error: {
            code: 'API_KEY_INVALID',
            message: 'An invalid api_key was supplied. Get one at https://api.nasa.gov:443',
          },
        });
        return;
      }
      const limit = key === 'DEMO_KEY' ? 10 : 1000;
      if (fake.quota <= 0) {
        send(
          429,
          { error: { code: 'OVER_RATE_LIMIT', message: 'You have exceeded your rate limit.' } },
          'application/json',
          { 'x-ratelimit-limit': String(limit), 'x-ratelimit-remaining': '0' },
        );
        return;
      }
      const start = Date.parse(`${url.searchParams.get('start_date')}T00:00:00Z`);
      const end = Date.parse(`${url.searchParams.get('end_date')}T00:00:00Z`);
      if (!(end - start <= 7 * DAY)) {
        send(400, {
          code: 400,
          http_error: '400 BAD_REQUEST',
          error_message: 'Date Format Exception - The Feed date limit is only 7 Days',
        });
        return;
      }
      fake.quota -= 1;
      send(200, content.neows, 'application/json', {
        'x-ratelimit-limit': String(limit),
        'x-ratelimit-remaining': String(Math.max(0, fake.quota)),
      });
      return;
    }
    if (service === 'epic') {
      send(200, content.epic);
      return;
    }
    if (service === 'image') {
      send(200, content.image, 'image/jpeg');
      return;
    }
    if (service === 'eonet') {
      if (content.eonet) {
        send(200, content.eonet);
        return;
      }
      const [west, north, east, south] = (url.searchParams.get('bbox') ?? '')
        .split(',')
        .map(Number);
      const overFrance = west < 7 && east > -2 && north > 46 && south < 46;
      send(200, fixture(overFrance ? 'eonet-europe' : 'eonet-open-30d'));
      return;
    }
    send(404, { error: 'not found' });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const root = `http://127.0.0.1:${server.address().port}`;
  fake.urls = { neows: root, epic: root, eonet: root };
  fake.close = () => new Promise((resolve) => server.close(resolve));
  return fake;
}

export { startFakeNasa, fixture, dataDir, silent, NOW, TZ, MINUTE, HOUR, DAY };
