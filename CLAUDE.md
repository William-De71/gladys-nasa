# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for three open NASA services: a
Node.js service (Node 22+, ESM, no build step) in its own sandboxed Docker
container, talking to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency, and to NeoWs (`api.nasa.gov`, an optional key,
`DEMO_KEY` by default), EPIC (`epic.gsfc.nasa.gov`) and EONET v3
(`eonet.gsfc.nasa.gov`). `type: "device"`, Gladys 5.3.0+, `transports:
["cloud"]`, `location: true` (the houses, for the natural events and the
Earth facing them). Not affiliated with NASA: never its insignia. APOD is
left out on purpose (its API answers the NASA logo for every date since the
move to science.nasa.gov, checked on 2026-11-05).

## Commands

```bash
npm install
npm test                                  # node --test; a fake NASA HTTP server on 127.0.0.1
node --test test/app.test.js              # one file
UPDATE_BASELINE=1 npm test                # rewrite test/fixtures/discovery.baseline.json (on purpose only)
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npx github:GladysAssistant/integration-store . --skip-image-check   # store checks
scripts/build-cover.sh                    # cover.jpg from docs/assets/cover.svg
docs/illustrations/render.sh              # docs/assets/widgets.<lang>.png
node .github/scripts/release.mjs next     # the version the next release would get
```

## Architecture

```
index.js               SDK wiring only (new GladysIntegration + createApp)
src/app.js             every handler; the timer (what is due per service), houses, devices
                       and states, scene events, scene actions, widgets, the EPIC image cache
src/nasa-api.js        HTTP client: NeoWs (key, quota), EPIC (list, JPEG ≤ 300 kB), EONET (bbox)
src/neo.js             the NeoWs feed into approaches, the week to come
src/epic.js            the EPIC list, the image facing a longitude, the widget image key
src/eonet.js           EONET events, distances to points and polygons, the box of a radius
src/events.js          the detectors of the triggers (pure: state + reading -> events)
src/summary.js         outputs of the scene actions, payloads and sentences of the triggers
src/device.js          the asteroids device and the natural events devices, their states
src/widgets.js         asteroids, earth and natural_events widgets
src/store.js           /data/nasa.json (a few tens of kB, never a key nor a geometry)
src/config.js          key, language, radius, period, lunar threshold
src/i18n.js            runtime texts, en / fr / de / es
src/time.js            texts in the timezone of Gladys
test/helpers/fake-nasa.js   the fake NASA (real answers of 2026-11-05, key, quota, errors)
.github/scripts/release.mjs     version, changelog, bump (tested in test/)
```

## Rules

- **External ids are forever**, and so is every key users store:
  `ext:<selector>:asteroids:global`, `ext:<selector>:natural-events:<house id>`,
  features `…:<key>`, feature `category` / `type` / `unit` / `min` / `max`,
  the keys of `config_schema` and `actions`, `last_language`, widgets and
  settings, triggers (fields, option values, variables), scene actions
  (fields, outputs). `test/structure.test.js` compares them to
  `test/fixtures/discovery.baseline.json`: never update it to make a test
  pass without a documented migration.
- **No unit Gladys does not have.** km is a unit of `distance-sensor`; the
  lunar distance has none: an `unknown` feature, the unit in its name.
- **Be sober with free services.** NeoWs every 6 hours (`DEMO_KEY` is 10
  requests an hour per IP, shared), EPIC every 3 hours, EONET every hour
  with a box per house (`PRODUCTS` of app.js); a failure waits longer each
  time, a quota an hour, a refused key 6 hours or a new key. A widget never
  reads NASA, except the EPIC image, once per image, kept in memory. A scene
  action only reads what is too old. The tests never touch the network.
- **The key is a secret**: never in a log, an error, the diagnostic or
  `/data` (`redact()`), only in the query string of api.nasa.gov.
- **`should_poll` stays false**: the integration has its own timer.
- **Times**: NASA writes UTC; texts are written in the timezone of Gladys (TZ).
- **Scene events** once per approach or event, never at the first reading,
  never after a change of the radius or the period (`scope`), never from a
  scene action (the detectors only run on the timer).
- **The container rootfs is read-only.** Write only under `/data`.
- **Four languages.** Every user-facing text (manifest, `src/i18n.js`,
  `docs/*.md`, README) exists in en, fr, de, es; `test/i18n.test.js` checks it.
  German says "du", Spanish "usted". Asteroid names and EONET titles stay
  as NASA writes them.
- **Widget images.** After any change to a widget content, run
  `docs/illustrations/render.sh` again and look at the four PNG files.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, the lockfile or the manifest, nor the `docker_image` tag.
  Below 1.0.0 until the maintainer runs Release with `release-as: 1.0.0`.
- **Changelog.** Ne jamais éditer CHANGELOG.md à la main, il est généré à la
  release. Écris le titre de PR comme la ligne que l'utilisateur lira.
- **Commits and PR titles** follow Conventional Commits, in English.
- **Forum drafts** (`.github/forum-*.md`) are never committed.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English.

## Pitfalls

- APOD (`/planetary/apod`) answers "NASA Science" and the NASA logo for every
  date since the move to science.nasa.gov (2026-11-05): do not add it back
  before checking.
- The NeoWs feed takes 8 calendar days at most (start and end included):
  a 9th day is a 400 "The Feed date limit is only 7 Days".
- Distances arrive as strings in NeoWs; `close_approach_date_full` is UTC.
- EONET without a box weighs 5 MB (thousands of US wildfires); floods and
  earthquakes are `closed` the day they appear: ask `status=all`. GDACS titles
  end with their own number ("Flood in France 1104243"): cut.
- The 1080 px EPIC JPEG weighs 210–230 kB (300 kB allowed in a widget): the
  120 px thumbnail is the fallback. Images are published one or two days late.
- A card-list date replaces the subtitle in the core: dates go in the subtitle.
- `node --test` also runs `test/helpers/`: nothing starts on import.
- The validator of the Gladys core creates `gladys-development.duckdb` in the
  current folder: run it from elsewhere.
