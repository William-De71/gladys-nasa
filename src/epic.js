// -----------------------------------------------------------------------------
// The images of EPIC, the Earth Polychromatic Imaging Camera on board DSCOVR,
// 1.5 million kilometres from the Earth towards the Sun: 10 to 20 pictures of
// the whole sunlit face of the Earth a day, published one or two days later.
//
// `/api/natural` lists the images of the last published day: `image`
// ("epic_1b_20261103003634"), `date` ("2026-11-03 00:31:45", UTC),
// `centroid_coordinates` (the point of the Earth at the centre of the picture)
// and `caption`. A house is best seen on the image whose centre is closest to
// its longitude: that is the one the widget shows.
// -----------------------------------------------------------------------------

import { epicImagePath, EPIC_URL } from './nasa-api.js';

/**
 * @description Read the list of EPIC.
 * @param {unknown} raw - The answer of /api/natural.
 * @returns {object[]|null} `[{ image, date, at, lat, lon, caption }]`, by
 * instant; null when not a list.
 */
function parseEpic(raw) {
  if (!Array.isArray(raw)) return null;
  const images = [];
  for (const item of raw) {
    const image = String(item?.image ?? '');
    const date = String(item?.date ?? '');
    const at = Date.parse(`${date.replace(' ', 'T')}Z`);
    const centre = item?.centroid_coordinates ?? item?.coords?.centroid_coordinates ?? {};
    const lat = Number(centre.lat);
    const lon = Number(centre.lon);
    if (!/^[\w-]+$/.test(image) || !Number.isFinite(at)) continue;
    images.push({
      image,
      date,
      at,
      lat: Number.isFinite(lat) ? lat : null,
      lon: Number.isFinite(lon) ? lon : null,
      caption: String(item?.caption ?? '').slice(0, 300),
    });
  }
  return images.sort((a, b) => a.at - b.at);
}

/**
 * @description The difference between two longitudes, 0 to 180 degrees.
 * @param {number} a - A longitude.
 * @param {number} b - A longitude.
 * @returns {number} The difference.
 */
function longitudeGap(a, b) {
  const gap = Math.abs(((((a - b) % 360) + 540) % 360) - 180);
  return gap;
}

/**
 * @description The images, best first, for a longitude: the closest centre
 * first; without a longitude, the latest first.
 * @param {object[]} images - parseEpic().
 * @param {number|null} [longitude] - The longitude of the house.
 * @returns {object[]} The images.
 */
function imagesFor(images, longitude) {
  const list = [...(images ?? [])];
  if (!Number.isFinite(longitude)) return list.sort((a, b) => b.at - a.at);
  return list.sort(
    (a, b) =>
      (Number.isFinite(a.lon) ? longitudeGap(a.lon, longitude) : 999) -
        (Number.isFinite(b.lon) ? longitudeGap(b.lon, longitude) : 999) || b.at - a.at,
  );
}

/**
 * @description The key of the image in a widget content (`^[a-z0-9][a-z0-9-]{0,63}$`):
 * it changes with the image, the core caches an image one hour by key.
 * @param {object} image - An EPIC image.
 * @returns {string} "epic-20261103003634".
 */
function imageKey(image) {
  const digits = String(image?.image ?? '')
    .split('_')
    .pop()
    .replace(/\D/g, '');
  return `epic-${digits || 'none'}`.slice(0, 64);
}

/**
 * @description The public URL of an image (scene outputs, links).
 * @param {object} image - An EPIC image.
 * @returns {string} The URL of the 1080 px JPEG.
 */
const imageUrl = (image) => `${EPIC_URL}${epicImagePath(image, 'jpg')}`;

export { parseEpic, imagesFor, longitudeGap, imageKey, imageUrl };
