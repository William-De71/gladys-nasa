// -----------------------------------------------------------------------------
// The detectors of the scene triggers: pure functions, a remembered state and
// a reading in, the events and the next state out. app.js keeps the states in
// /data (store.seen), so a restart never fires twice nor misses an event.
//
//   asteroid_close_approach  an approach of the next 7 days closer than the
//                            threshold of the configuration (lunar distances),
//                            once per approach;
//   hazardous_asteroid       an approach of a potentially hazardous asteroid
//                            enters the next 7 days, once per approach;
//   natural_event_nearby     a new EONET event within the radius of a house,
//                            once per event and house.
//
// Never at the first reading (what is already there is not news), nor after a
// change of the radius or the period (the events that come into view are not
// new either): those readings only learn. Never from a scene action: the
// detectors only run on the timer.
// -----------------------------------------------------------------------------

const TRIGGERS = {
  CLOSE_APPROACH: 'asteroid_close_approach',
  HAZARDOUS_ASTEROID: 'hazardous_asteroid',
  NATURAL_EVENT: 'natural_event_nearby',
};
const DAY_MS = 24 * 3600 * 1000;
const MAX_IDS = 500;

/**
 * @description The instant of an approach id `<neo>@<epoch ms>`.
 * @param {string} id - The id.
 * @returns {number} The instant (NaN when unreadable).
 */
const instantOfId = (id) => Number(String(id).split('@')[1]);

/**
 * @description The ids still worth remembering: approaches not passed for a day.
 * @param {string[]} ids - The ids.
 * @param {number} now - Now.
 * @returns {string[]} The ids.
 */
const keepApproaches = (ids, now) =>
  ids.filter((id) => !(instantOfId(id) < now - DAY_MS)).slice(-MAX_IDS);

/**
 * @description The asteroid events of a reading.
 * @param {object|undefined} state - `{ initialized, close: [ids], hazardous: [ids] }`.
 * @param {object} reading - `{ approaches (upcoming), threshold (LD), now }`.
 * @returns {{ events: Array<{ key: string, approach: object }>, next: object }} The result.
 */
function detectAsteroids(state, { approaches, threshold, now }) {
  const known = {
    close: new Set(state?.close ?? []),
    hazardous: new Set(state?.hazardous ?? []),
  };
  const first = !state?.initialized;
  const events = [];
  for (const approach of approaches ?? []) {
    if (approach.at < now) continue;
    if (approach.lunar <= threshold && !known.close.has(approach.id)) {
      known.close.add(approach.id);
      if (!first) events.push({ key: TRIGGERS.CLOSE_APPROACH, approach });
    }
    if (approach.hazardous && !known.hazardous.has(approach.id)) {
      known.hazardous.add(approach.id);
      if (!first) events.push({ key: TRIGGERS.HAZARDOUS_ASTEROID, approach });
    }
  }
  return {
    events,
    next: {
      initialized: true,
      close: keepApproaches([...known.close], now),
      hazardous: keepApproaches([...known.hazardous], now),
    },
  };
}

/**
 * @description The natural events of a house that are new.
 * @param {object|undefined} state - `{ scope, ids }` of the house.
 * @param {object} reading - `{ events (eventsNear), scope ("<radius>/<days>") }`.
 * @returns {{ events: object[], next: object }} The new events, the next state.
 */
function detectNaturalEvents(state, { events, scope }) {
  // A first reading, or a radius or a period changed: learn only.
  const learning = !state || state.scope !== scope;
  const known = new Set(learning ? [] : (state.ids ?? []));
  const found = [];
  for (const event of events ?? []) {
    if (!known.has(event.id)) {
      known.add(event.id);
      if (!learning) found.push(event);
    }
  }
  // The ids of the events still in view, plus the last ones seen: an event
  // that leaves the period then comes back (a new point) is not new.
  const current = new Set((events ?? []).map((event) => event.id));
  const ids = [...known].filter((id) => current.has(id));
  const older = [...known].filter((id) => !current.has(id)).slice(-MAX_IDS + ids.length);
  return { events: found, next: { scope, ids: [...older, ...ids].slice(-MAX_IDS) } };
}

export { TRIGGERS, detectAsteroids, detectNaturalEvents };
