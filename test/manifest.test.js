import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { TRIGGERS } from '../src/events.js';
import { ACTIONS } from '../src/app.js';
import { WIDGETS, ASTEROID_SORTS, DEFAULT_ASTEROID_SORT } from '../src/widgets.js';
import { SCENE_ACTIONS, ASTEROID_OUTPUTS, EVENT_OUTPUTS, EARTH_OUTPUTS } from '../src/summary.js';
import { CATEGORIES } from '../src/eonet.js';
import {
  AUTO_LANGUAGE,
  RADII,
  DEFAULT_RADIUS,
  EVENT_DAYS,
  DEFAULT_EVENT_DAYS,
  LUNAR_THRESHOLDS,
  DEFAULT_LUNAR_THRESHOLD,
} from '../src/config.js';
import { LANGUAGES } from '../src/i18n.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const manifest = read('../gladys-assistant-integration.json');
const pkg = read('../package.json');
const byKey = (list) => new Map(list.map((entry) => [entry.key, entry]));
const values = (field) => field.options.map((option) => option.value);
const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const REPO = 'William-De71/gladys-nasa';

test('a device integration, in lockstep with package.json, at 0.x until 1.0.0 is decided', () => {
  assert.equal(manifest.type, 'device');
  assert.equal(manifest.name, 'NASA');
  assert.equal(manifest.version, pkg.version);
  assert.match(pkg.version, /^0\./);
  assert.equal(manifest.docker_image, `ghcr.io/william-de71/gladys-nasa:${pkg.version}`);
  assert.equal(manifest.cover_image, `https://raw.githubusercontent.com/${REPO}/main/cover.jpg`);
  assert.equal(pkg.license, 'Apache-2.0');
  assert.equal(pkg.name, 'gladys-nasa');
});

test('declares the cloud transport: the three NASA services, an optional secret key', () => {
  assert.deepEqual(manifest.transports, ['cloud']);
  const client = source('../src/nasa-api.js');
  for (const host of ['api.nasa.gov', 'epic.gsfc.nasa.gov', 'eonet.gsfc.nasa.gov']) {
    assert.match(client, new RegExp(`https://${host.replace(/\./g, '\\.')}`), host);
  }
  for (const file of [
    'app',
    'neo',
    'epic',
    'eonet',
    'events',
    'summary',
    'widgets',
    'device',
    'store',
    'time',
    'config',
  ]) {
    assert.doesNotMatch(
      source(`../src/${file}.js`),
      /fetch\(|node:https?|node:net|node:dgram/,
      file,
    );
  }
  assert.doesNotMatch(source('../src/app.js'), /publishTransports|GLADYS_PREFER_LOCAL/);
  const secrets = manifest.config_schema.filter((field) => field.type === 'secret');
  assert.deepEqual(
    secrets.map((field) => [field.key, field.required]),
    [['api_key', false]],
  );
  assert.ok(
    !manifest.config_schema.some((field) => ['oauth2', 'account_link'].includes(field.type)),
  );
});

test('Gladys 5.3.0: widgets, scenes, catalog keywords; the houses read with `location`, chosen through their devices', () => {
  assert.equal(manifest.gladys_version, '>=5.3.0');
  assert.deepEqual(manifest.categories, ['environment', 'leisure']);
  assert.equal(manifest.location, true, 'getHouses() for the natural events');
  assert.match(source('../src/app.js'), /gladys\.getHouses\(\)/);
  assert.doesNotMatch(JSON.stringify(manifest), /"source":"houses"/, 'houses need 5.2.0');
  for (const key of ['network_wake', 'containers', 'network_discovery', 'webhooks', 'messaging']) {
    assert.equal(manifest[key], undefined, key);
  }
  for (const widget of manifest.widgets) {
    assert.equal(widget.action_timeout_seconds, undefined, 'no button');
  }
});

test('declares exactly the scene triggers, actions and widgets the code handles', () => {
  const app = source('../src/app.js');
  assert.deepEqual(
    manifest.scene_triggers.map((t) => t.key),
    Object.values(TRIGGERS),
  );
  assert.deepEqual(
    manifest.scene_actions.map((a) => a.key),
    Object.values(SCENE_ACTIONS),
  );
  assert.deepEqual(
    manifest.widgets.map((w) => w.key),
    Object.values(WIDGETS),
  );
  for (const key of Object.keys(WIDGETS))
    assert.match(app, new RegExp(`onWidgetGet\\(WIDGETS\\.${key}`), key);
  for (const key of Object.keys(SCENE_ACTIONS))
    assert.match(app, new RegExp(`onSceneAction\\(SCENE_ACTIONS\\.${key}`), key);
  assert.deepEqual(
    manifest.actions.map((a) => a.key),
    Object.values(ACTIONS),
  );
  for (const key of Object.keys(ACTIONS))
    assert.match(app, new RegExp(`onAction\\(ACTIONS\\.${key}`), key);
  assert.doesNotMatch(app, /onWidgetAction/);
  const outputs = (key) =>
    byKey(manifest.scene_actions)
      .get(key)
      .outputs.map((o) => o.key);
  assert.deepEqual(outputs('get_asteroids'), ASTEROID_OUTPUTS);
  assert.deepEqual(outputs('get_natural_events'), EVENT_OUTPUTS);
  assert.deepEqual(outputs('get_earth_image'), EARTH_OUTPUTS);
  assert.match(app, /onWidgetGetImage\(/);
});

test('the option values of the fields mirror the code', () => {
  const triggers = byKey(manifest.scene_triggers);
  const field = (trigger, key) => byKey(triggers.get(trigger).fields).get(key);
  assert.deepEqual(values(field('natural_event_nearby', 'category')), [...CATEGORIES, 'other']);
  assert.equal(field('natural_event_nearby', 'device').source, 'devices');
  for (const action of manifest.scene_actions.filter((a) => a.fields.length)) {
    assert.equal(byKey(action.fields).get('device').source, 'devices', action.key);
    assert.equal(byKey(action.fields).get('device').required, false, action.key);
  }
  const widgets = byKey(manifest.widgets);
  const sort = byKey(widgets.get('asteroids').settings).get('sort');
  assert.deepEqual(values(sort), ASTEROID_SORTS);
  assert.equal(sort.default, DEFAULT_ASTEROID_SORT);
  for (const key of ['earth', 'natural_events']) {
    assert.equal(byKey(widgets.get(key).settings).get('device').source, 'devices', key);
  }
  const config = byKey(manifest.config_schema);
  assert.deepEqual(values(config.get('radius_km')), RADII);
  assert.equal(config.get('radius_km').default, DEFAULT_RADIUS);
  assert.deepEqual(values(config.get('event_days')), EVENT_DAYS);
  assert.equal(config.get('event_days').default, DEFAULT_EVENT_DAYS);
  assert.deepEqual(values(config.get('lunar_threshold')), LUNAR_THRESHOLDS);
  assert.equal(config.get('lunar_threshold').default, DEFAULT_LUNAR_THRESHOLD);
  assert.deepEqual(values(config.get('language')), [AUTO_LANGUAGE, ...LANGUAGES]);
  // Every trigger field is a key of the event data (the core compares them).
  for (const trigger of manifest.scene_triggers) {
    for (const f of trigger.fields ?? []) {
      assert.ok(
        trigger.variables.some((v) => v.key === f.key),
        `${trigger.key}.${f.key} is also a variable`,
      );
      assert.ok(!('default' in f));
    }
  }
});

test('limits of the store: counts, timeouts, sizes', () => {
  assert.ok(manifest.widgets.length >= 1 && manifest.widgets.length <= 5);
  assert.ok(manifest.scene_triggers.length <= 20 && manifest.scene_actions.length <= 20);
  for (const trigger of manifest.scene_triggers) {
    assert.ok((trigger.fields ?? []).length <= 10 && trigger.variables.length <= 20, trigger.key);
    assert.ok(trigger.key.length <= 40);
  }
  for (const action of manifest.scene_actions) {
    assert.ok(action.fields.length <= 10 && action.outputs.length <= 20, action.key);
  }
  for (const action of [...manifest.scene_actions, ...manifest.actions]) {
    assert.ok(action.timeout_seconds >= 5 && action.timeout_seconds <= 120, action.key);
  }
  const size = statSync(new URL('../gladys-assistant-integration.json', import.meta.url)).size;
  assert.ok(size < 100 * 1024, `${size} bytes`);
  const cover = readFileSync(new URL('../cover.jpg', import.meta.url));
  assert.ok(cover.length < 150 * 1024, `cover.jpg: ${cover.length} bytes`);
  assert.equal(cover.readUInt16BE(0), 0xffd8);
});

test('catalog search terms and countries, which need Gladys 5.3.0', () => {
  assert.equal(manifest.gladys_version, '>=5.3.0');
  assert.ok(Array.isArray(manifest.keywords));
  assert.ok(manifest.keywords.length >= 1 && manifest.keywords.length <= 10);
  const terms = manifest.keywords.map((keyword) => keyword.trim().toLowerCase());
  for (const [index, term] of terms.entries()) {
    assert.ok(term.length >= 2 && manifest.keywords[index].length <= 30, term);
  }
  assert.equal(new Set(terms).size, terms.length, 'unique once trimmed and lowercased');
  assert.ok(!terms.includes(manifest.name.toLowerCase()), 'the name is already searched');
  // Usable anywhere: no country filter in the catalog.
  assert.equal(manifest.countries, undefined);
});
