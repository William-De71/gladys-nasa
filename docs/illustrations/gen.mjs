// Widget contents for the generated illustrations, built by the real code of
// the integration: the app itself (src/app.js) wired to the fake Gladys of the
// SDK and the fake NASA of the tests (a real local HTTP server), on the real
// answers of 5 November 2026, made livelier on purpose with two FICTITIOUS
// items: an asteroid "2026 VX1" passing at 0.6 lunar distances, and a
// wildfire in the Chaux forest (Jura). The Earth is the real EPIC image of
// 3 November 2026, 11:24 UTC (NASA, public domain), reduced to 540 px
// (epic-sample.jpg). Never real data presented as such. Written as JSON for
// render.js:
//   node gen.mjs <repo> <out.json>

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (file) => import(pathToFileURL(join(repo, file)).href);
const { createApp } = await load('src/app.js');
const { LANGUAGES } = await load('src/i18n.js');
const { createFakeGladys } = await import(
  pathToFileURL(join(repo, 'node_modules/@gladysassistant/integration-sdk/lib/testing.js')).href
);
const { startFakeNasa, dataDir, fixture, silent, NOW, HOUR, DAY } = await load(
  'test/helpers/fake-nasa.js',
);

const manifest = JSON.parse(readFileSync(join(repo, 'gladys-assistant-integration.json'), 'utf8'));
const WIDGET_KEYS = ['asteroids', 'natural_events', 'earth'];
const HOUSES = [
  { id: 'maison', name: 'Maison', selector: 'maison', latitude: 47.24, longitude: 6.02 },
];
const EARTH = readFileSync(join(repo, 'docs/illustrations/epic-sample.jpg'));

/**
 * @description The fake NASA, with the two fictitious items.
 * @returns {Promise<object>} The fake.
 */
async function liveNasa() {
  const fake = await startFakeNasa();
  const feed = fixture('neo-feed');
  feed.near_earth_objects['2026-11-07'].push({
    id: '9999999',
    name: '(2026 VX1)',
    nasa_jpl_url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=9999999',
    is_potentially_hazardous_asteroid: true,
    is_sentry_object: false,
    estimated_diameter: { meters: { estimated_diameter_min: 140, estimated_diameter_max: 310 } },
    close_approach_data: [
      {
        close_approach_date: '2026-11-07',
        epoch_date_close_approach: NOW + 2 * DAY - 5 * HOUR,
        miss_distance: { kilometers: '230640', lunar: '0.6' },
        relative_velocity: { kilometers_per_second: '14.2' },
        orbiting_body: 'Earth',
      },
    ],
  });
  fake.set('neows', feed);
  const europe = fixture('eonet-europe');
  europe.events.unshift({
    id: 'EONET_99999',
    title: 'Wildfire Chaux Forest, Jura, France',
    closed: null,
    categories: [{ id: 'wildfires', title: 'Wildfires' }],
    sources: [{ id: 'EO', url: 'https://eonet.gsfc.nasa.gov/' }],
    geometry: [
      {
        magnitudeValue: 120,
        magnitudeUnit: 'acres',
        date: new Date(NOW - 5 * HOUR).toISOString(),
        type: 'Point',
        coordinates: [5.62, 47.08],
      },
    ],
  });
  fake.set('eonet', europe);
  fake.set('image', EARTH);
  return fake;
}

/**
 * @description One language: the three widgets and the image.
 * @param {string} language - Language.
 * @returns {Promise<object>} The widget contents and images.
 */
async function contents(language) {
  const clock = { now: NOW };
  const fake = await liveNasa();
  const config = { language, radius_km: '1000', event_days: '30', lunar_threshold: '5' };
  const gladys = createFakeGladys({ config, houses: HOUSES });
  const app = createApp(gladys, {
    urls: fake.urls,
    dataDir: dataDir(),
    now: () => clock.now,
    timeZone: 'Europe/Paris',
    timers: false,
    logger: silent,
  });
  await gladys.connect();
  await app.whenReady();
  await app.tick();
  const device = 'ext:test-integration:natural-events:maison';
  const settings = {
    asteroids: { sort: 'distance' },
    natural_events: { device },
    earth: { device },
  };
  const result = {};
  const images = {};
  for (const key of WIDGET_KEYS) {
    const content = (await gladys.fake.widgetGet(key, { settings: settings[key], language })).data
      .content;
    result[key] = content;
    for (const component of content.components.filter((c) => c.type === 'image')) {
      const answer = await gladys.fake.widgetGetImage(component.key);
      images[component.key] = `data:image/jpeg;base64,${answer.data.image ?? answer.data}`;
    }
  }
  await gladys.fake.shutdown();
  await fake.close();
  return { result, images };
}

const all = {};
let images = {};
for (const language of LANGUAGES) {
  const { result, images: found } = await contents(language);
  all[language] = result;
  images = { ...images, ...found };
}

const card = (key) => {
  const widget = manifest.widgets.find((item) => item.key === key);
  return { icon: widget.icon, label: widget.label };
};
writeFileSync(
  out,
  JSON.stringify({
    now: NOW,
    contents: all,
    images,
    cards: Object.fromEntries(WIDGET_KEYS.map((key) => [key, card(key)])),
  }),
);
