// -----------------------------------------------------------------------------
// What the integration keeps across restarts, under /data (the only writable
// place of the container), in /data/nasa.json — a few tens of kilobytes:
//
//   - `products`  per service (neows, epic, eonet): what was read of it (the
//                 approaches of the week, the list of EPIC images), when it
//                 was last read and asked for, its failures in a row: a
//                 restart neither bursts nor goes blind, and the shared
//                 DEMO_KEY is not spent again;
//   - `houses`    per house: the natural events near it (no geometry);
//   - `seen`      what the scene triggers already know (events.js): a
//                 restart never fires twice, never misses a transition.
// -----------------------------------------------------------------------------

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const DEFAULT_DIR = '/data';
const FILE = 'nasa.json';
const EMPTY = () => ({ products: {}, houses: {}, seen: {}, lastError: null });

/**
 * @description Read a JSON file; an absent or broken file is null.
 * @param {string} path - The file.
 * @param {object} [logger] - Logger.
 * @returns {Promise<object|null>} The value.
 */
async function readJson(path, logger) {
  try {
    const value = JSON.parse(await readFile(path, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger?.warn(`Unable to read ${path}: ${err.message}`);
    }
    return null;
  }
}

/**
 * @description Write a JSON file atomically (a temporary file, then a rename).
 * @param {string} path - The file.
 * @param {object} value - The value.
 * @param {object} [logger] - Logger.
 * @returns {Promise<void>}
 */
async function writeJson(path, value, logger) {
  try {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.tmp`;
    await writeFile(temporary, JSON.stringify(value));
    await rename(temporary, path);
  } catch (err) {
    logger?.warn(`Unable to write ${path}: ${err.message}`);
  }
}

/**
 * @description The store.
 * @param {object} [options] - `{ dir, logger }`.
 * @returns {object} `{ data, load, save }`.
 */
function createStore({ dir = DEFAULT_DIR, logger } = {}) {
  const path = join(dir, FILE);
  let writing = Promise.resolve();
  const store = {
    data: EMPTY(),
    /**
     * @description Read the file.
     * @returns {Promise<void>}
     */
    async load() {
      const raw = (await readJson(path, logger)) ?? {};
      const part = (value) =>
        value && typeof value === 'object' && !Array.isArray(value) ? value : {};
      store.data = {
        products: { ...part(raw.products) },
        houses: { ...part(raw.houses) },
        seen: { ...part(raw.seen) },
        lastError: raw.lastError && typeof raw.lastError === 'object' ? raw.lastError : null,
      };
    },
    /**
     * @description Write the state (one write at a time).
     * @returns {Promise<void>}
     */
    save() {
      writing = writing.then(() => writeJson(path, store.data, logger));
      return writing;
    },
  };
  return store;
}

export { DEFAULT_DIR, FILE, createStore };
