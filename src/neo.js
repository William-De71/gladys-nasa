// -----------------------------------------------------------------------------
// The close approaches of the NeoWs feed (JPL data served by api.nasa.gov).
//
// The feed groups the asteroids by day (`near_earth_objects["2026-11-07"]`),
// each with its approaches (`close_approach_data`): only those to the Earth
// count. An approach is identified by the asteroid and its instant
// (`<neo id>@<epoch ms>`), stable from a reading to the next: the triggers
// remember those ids. Distances arrive as strings ("8343148.38…"): parsed as
// numbers; `close_approach_date_full` is UTC ("2026-Nov-07 00:21").
// -----------------------------------------------------------------------------

const KM_PER_LUNAR_DISTANCE = 384400;

/**
 * @description A number of the feed (strings and numbers).
 * @param {unknown} value - The value.
 * @returns {number|null} The number.
 */
function num(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * @description The instant of an approach: `epoch_date_close_approach`, else
 * the full date ("2026-Nov-07 00:21", UTC), else the day at 00:00 UTC.
 * @param {object} data - An entry of `close_approach_data`.
 * @returns {number|null} In ms.
 */
function approachInstant(data) {
  const epoch = num(data?.epoch_date_close_approach);
  if (epoch !== null) return epoch;
  const full = /^(\d{4})-([A-Za-z]{3})-(\d{2}) (\d{2}):(\d{2})$/.exec(
    String(data?.close_approach_date_full ?? ''),
  );
  if (full) {
    const month = 'JanFebMarAprMayJunJulAugSepOctNovDec'.indexOf(full[2]) / 3;
    if (month >= 0) {
      return Date.UTC(+full[1], month, +full[3], +full[4], +full[5]);
    }
  }
  const day = Date.parse(`${data?.close_approach_date ?? ''}T00:00:00Z`);
  return Number.isFinite(day) ? day : null;
}

/**
 * @description The asteroid name without the parentheses of a provisional
 * designation: "(2007 VV83)" -> "2007 VV83"; "433 Eros (A898 PA)" stays.
 * @param {unknown} name - The name of the feed.
 * @returns {string} The name.
 */
function cleanName(name) {
  const text = String(name ?? '').trim();
  const match = /^\((.+)\)$/.exec(text);
  return (match ? match[1] : text).slice(0, 60);
}

/**
 * @description Read a NeoWs feed into approaches, sorted by instant.
 * @param {unknown} raw - The feed.
 * @returns {object[]|null} `[{ id, neo, name, at, km, lunar, kms, diameterMin,
 * diameterMax, hazardous, sentry, url }]`, null when not a feed.
 */
function parseFeed(raw) {
  const days = raw?.near_earth_objects;
  if (!days || typeof days !== 'object' || Array.isArray(days)) return null;
  const approaches = new Map();
  for (const list of Object.values(days)) {
    for (const neo of Array.isArray(list) ? list : []) {
      const neoId = String(neo?.id ?? neo?.neo_reference_id ?? '');
      if (!/^\d+$/.test(neoId)) continue;
      for (const data of Array.isArray(neo.close_approach_data) ? neo.close_approach_data : []) {
        if (data?.orbiting_body && data.orbiting_body !== 'Earth') continue;
        const at = approachInstant(data);
        const km = num(data?.miss_distance?.kilometers);
        if (at === null || km === null) continue;
        const id = `${neoId}@${at}`;
        const diameter = neo.estimated_diameter?.meters ?? {};
        const url = String(neo.nasa_jpl_url ?? '');
        approaches.set(id, {
          id,
          neo: neoId,
          name: cleanName(neo.name),
          at,
          km,
          lunar: num(data?.miss_distance?.lunar) ?? km / KM_PER_LUNAR_DISTANCE,
          kms: num(data?.relative_velocity?.kilometers_per_second),
          diameterMin: num(diameter.estimated_diameter_min),
          diameterMax: num(diameter.estimated_diameter_max),
          hazardous: neo.is_potentially_hazardous_asteroid === true,
          sentry: neo.is_sentry_object === true,
          url: /^https:\/\//.test(url)
            ? url
            : `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${neoId}`,
        });
      }
    }
  }
  return [...approaches.values()].sort((a, b) => a.at - b.at);
}

/**
 * @description The approaches still to come in a window.
 * @param {object[]} approaches - parseFeed().
 * @param {number} now - Now, in ms.
 * @param {number} [span] - The window, in ms (7 days).
 * @returns {object[]} The approaches.
 */
function upcoming(approaches, now, span = 7 * 24 * 3600 * 1000) {
  return (approaches ?? []).filter((approach) => approach.at >= now && approach.at <= now + span);
}

/**
 * @description What the devices, widgets and scenes say of the week to come.
 * @param {object[]} approaches - parseFeed().
 * @param {number} now - Now, in ms.
 * @returns {object} `{ list, count, hazardous, closest, today }`.
 */
function weekOf(approaches, now) {
  const list = upcoming(approaches, now);
  const closest = list.reduce((best, item) => (!best || item.km < best.km ? item : best), null);
  return {
    list,
    count: list.length,
    hazardous: list.filter((item) => item.hazardous).length,
    closest,
    today: list.filter((item) => item.at < now + 24 * 3600 * 1000).length,
  };
}

/**
 * @description The estimated diameter, in metres, rounded: "30–70".
 * @param {object} approach - An approach.
 * @returns {string} The range, "" when unknown.
 */
function diameterRange(approach) {
  const round = (value) =>
    value >= 1000
      ? Math.round(value / 100) * 100
      : value >= 100
        ? Math.round(value / 10) * 10
        : Math.round(value);
  if (!Number.isFinite(approach?.diameterMin) || !Number.isFinite(approach?.diameterMax)) {
    return '';
  }
  const low = round(approach.diameterMin);
  const high = round(approach.diameterMax);
  return low === high ? String(low) : `${low}–${high}`;
}

export { KM_PER_LUNAR_DISTANCE, parseFeed, upcoming, weekOf, diameterRange, cleanName };
