// -----------------------------------------------------------------------------
// HTTP client of the three open NASA services the integration reads. GET only,
// one request at a time, a User-Agent naming the integration and its
// repository:
//
//   NeoWs  https://api.nasa.gov/neo/rest/v1/feed?start_date=&end_date=&api_key=
//          close approaches of near-Earth asteroids, 7 days at most per
//          request (8 calendar days: start and end included). A key of
//          api.nasa.gov is required: the user's own (free, 1,000 requests an
//          hour) or the shared DEMO_KEY (10 an hour per IP address, checked on
//          2026-11-05 in `x-ratelimit-limit`). An invalid key answers 403
//          `API_KEY_INVALID`, a range too long 400, an exhausted quota 429.
//   EPIC   https://epic.gsfc.nasa.gov/api/natural
//          the images of the last day of the EPIC camera (no key), and
//          https://epic.gsfc.nasa.gov/archive/natural/YYYY/MM/DD/jpg/<image>.jpg,
//          1080 × 1080 JPEG of about 210 to 230 kB (thumbs/: 120 px).
//   EONET  https://eonet.gsfc.nasa.gov/api/v3/events?status=&days=&bbox=
//          the natural events of a bounding box (no key). Without a box the
//          open events weigh 5 MB: the integration always sends one.
//
// The key travels in the query string (the only way api.nasa.gov takes it):
// it never appears in a log or an error message — `redact()`.
// -----------------------------------------------------------------------------

const NEOWS_URL = 'https://api.nasa.gov';
const EPIC_URL = 'https://epic.gsfc.nasa.gov';
const EONET_URL = 'https://eonet.gsfc.nasa.gov';
const DEMO_KEY = 'DEMO_KEY';
const TIMEOUT_MS = 30000;
// The core refuses a widget image over 300 kB decoded.
const MAX_IMAGE_BYTES = 300 * 1024;

/**
 * @description An error of a NASA service, with a kind.
 */
class NasaError extends Error {
  /**
   * @param {string} kind - `unreachable` (no answer), `key` (invalid key),
   * `quota` (429), `http` (another error status), `invalid` (not the
   * content expected), `too_large` (an image over 300 kB).
   * @param {string} message - The message.
   * @param {object} [extra] - `{ status, service, retryAfter }`.
   */
  constructor(kind, message, extra = {}) {
    super(message);
    this.name = 'NasaError';
    this.kind = kind;
    Object.assign(this, extra);
  }
}

/**
 * @description Hide an API key in a text.
 * @param {string} text - The text.
 * @param {string} [key] - The key.
 * @returns {string} The text, the key replaced by `***`.
 * @example
 * redact('api_key=abc123', 'abc123'); // -> 'api_key=***'
 */
function redact(text, key) {
  const value = String(text ?? '');
  return key && key !== DEMO_KEY ? value.split(key).join('***') : value;
}

/**
 * @description A UTC day "YYYY-MM-DD".
 * @param {number} instant - In ms.
 * @returns {string} The day.
 */
const utcDay = (instant) => new Date(instant).toISOString().slice(0, 10);

/**
 * @description The NASA client.
 * @param {object} options - Options.
 * @param {string} options.userAgent - The User-Agent of every request.
 * @param {Function} [options.fetch] - The fetch implementation (tests).
 * @param {object} [options.urls] - `{ neows, epic, eonet }` roots (tests).
 * @returns {object} `{ neoFeed, epicLatest, epicImage, eonetEvents, quota }`.
 */
function createNasaClient({ userAgent, fetch: fetchFn = globalThis.fetch, urls = {} }) {
  const roots = { neows: NEOWS_URL, epic: EPIC_URL, eonet: EONET_URL, ...urls };
  // The last quota api.nasa.gov announced: `{ limit, remaining, at }`.
  let quota = null;
  let busy = Promise.resolve();

  /**
   * @description One request at a time: a request waits for the previous one.
   * @param {Function} task - `() => Promise`.
   * @returns {Promise<unknown>} Its result.
   */
  function serial(task) {
    const run = busy.then(task);
    busy = run.catch(() => {});
    return run;
  }

  /**
   * @description GET a URL.
   * @param {string} service - `neows`, `epic` or `eonet` (errors, logs).
   * @param {URL} url - The URL.
   * @param {object} [options] - `{ key, binary }`.
   * @returns {Promise<{ response: Response, body: string|Buffer }>} The answer.
   */
  async function get(service, url, { key, binary = false } = {}) {
    let response;
    try {
      response = await fetchFn(url, {
        headers: { 'User-Agent': userAgent, Accept: binary ? 'image/jpeg' : 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new NasaError('unreachable', redact(err?.cause?.code ?? err?.name ?? 'network', key), {
        service,
      });
    }
    if (service === 'neows') {
      const limit = Number(response.headers.get('x-ratelimit-limit'));
      const remaining = Number(response.headers.get('x-ratelimit-remaining'));
      if (response.headers.has('x-ratelimit-remaining') && Number.isFinite(remaining)) {
        quota = { limit: Number.isFinite(limit) ? limit : null, remaining, at: Date.now() };
      }
    }
    if (response.status !== 200) {
      const text = await response.text().catch(() => '');
      let code = '';
      try {
        const json = JSON.parse(text);
        code = json?.error?.code ?? json?.error_message ?? json?.http_error ?? '';
      } catch {
        // Not JSON: the status says enough.
      }
      const detail = redact(`HTTP ${response.status}${code ? ` ${code}` : ''}`, key).slice(0, 200);
      if (response.status === 429 || code === 'OVER_RATE_LIMIT') {
        const retryAfter = Number(response.headers.get('retry-after'));
        throw new NasaError('quota', detail, {
          service,
          status: response.status,
          retryAfter: Number.isFinite(retryAfter) ? retryAfter : null,
        });
      }
      if (response.status === 403 && /API_KEY/.test(code)) {
        throw new NasaError('key', detail, { service, status: 403 });
      }
      throw new NasaError('http', detail, { service, status: response.status });
    }
    if (binary) {
      return { response, body: Buffer.from(await response.arrayBuffer()) };
    }
    return { response, body: await response.text() };
  }

  /**
   * @description Parse a JSON body.
   * @param {string} service - The service.
   * @param {string} body - The body.
   * @returns {unknown} The JSON.
   */
  function json(service, body) {
    try {
      return JSON.parse(body);
    } catch {
      throw new NasaError('invalid', `Not JSON (${body.length} bytes)`, { service });
    }
  }

  return {
    /**
     * @description The close approaches of 8 calendar days from a day (UTC).
     * @param {object} options - `{ from (ms), key }`.
     * @returns {Promise<object>} The NeoWs feed.
     */
    neoFeed({ from, key }) {
      return serial(async () => {
        const apiKey = key || DEMO_KEY;
        const url = new URL('/neo/rest/v1/feed', roots.neows);
        url.searchParams.set('start_date', utcDay(from));
        url.searchParams.set('end_date', utcDay(from + 7 * 24 * 3600 * 1000));
        url.searchParams.set('api_key', apiKey);
        const { body } = await get('neows', url, { key: apiKey });
        return json('neows', body);
      });
    },
    /**
     * @description The images of the last day of EPIC (natural colour).
     * @returns {Promise<object[]>} The list.
     */
    epicLatest() {
      return serial(async () => {
        const { body } = await get('epic', new URL('/api/natural', roots.epic));
        return json('epic', body);
      });
    },
    /**
     * @description One EPIC image, a JPEG of at most 300 kB.
     * @param {object} image - `{ image, date }` of the list ("2026-11-03 00:31:45").
     * @param {object} [options] - `{ size: 'jpg' | 'thumbs' }`.
     * @returns {Promise<Buffer>} The bytes.
     */
    epicImage(image, { size = 'jpg' } = {}) {
      return serial(async () => {
        const { body } = await get('epic', new URL(epicImagePath(image, size), roots.epic), {
          binary: true,
        });
        if (body.length > MAX_IMAGE_BYTES) {
          throw new NasaError('too_large', `${body.length} bytes`, { service: 'epic' });
        }
        if (body[0] !== 0xff || body[1] !== 0xd8) {
          throw new NasaError('invalid', 'Not a JPEG', { service: 'epic' });
        }
        return body;
      });
    },
    /**
     * @description The natural events of a bounding box.
     * @param {object} options - `{ bbox: [west, north, east, south], days }`.
     * @returns {Promise<object>} The EONET answer.
     */
    eonetEvents({ bbox, days }) {
      return serial(async () => {
        const url = new URL('/api/v3/events', roots.eonet);
        // Floods and earthquakes are often closed the day they appear: "all", not "open".
        url.searchParams.set('status', 'all');
        url.searchParams.set('days', String(days));
        url.searchParams.set('bbox', bbox.map((value) => Number(value.toFixed(3))).join(','));
        const { body } = await get('eonet', url);
        return json('eonet', body);
      });
    },
    quota: () => quota,
  };
}

/**
 * @description The path of an EPIC image on the archive.
 * @param {object} image - `{ image, date }`.
 * @param {string} [size] - `jpg`, `thumbs` or `png`.
 * @returns {string} "/archive/natural/2026/11/03/jpg/epic_1b_….jpg".
 */
function epicImagePath(image, size = 'jpg') {
  const day = String(image?.date ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^[\w-]+$/.test(String(image?.image ?? ''))) {
    throw new NasaError('invalid', 'Unknown EPIC image', { service: 'epic' });
  }
  const extension = size === 'png' ? 'png' : 'jpg';
  return `/archive/natural/${day.replace(/-/g, '/')}/${size}/${image.image}.${extension}`;
}

export {
  NEOWS_URL,
  EPIC_URL,
  EONET_URL,
  DEMO_KEY,
  MAX_IMAGE_BYTES,
  NasaError,
  redact,
  createNasaClient,
  epicImagePath,
};
