// -----------------------------------------------------------------------------
// Entry point of the NASA external integration.
//
// Open NASA data, read on the integration's own timer:
//   - devices: "Near-Earth asteroids" (NeoWs: closest approach of the next 7
//     days, approaches, potentially hazardous asteroids) and one "Natural
//     events" device per located house (EONET), offered on the Discovery
//     screen (src/device.js);
//   - scene triggers: close approach under a threshold in lunar distances,
//     potentially hazardous asteroid, new natural event near a house;
//   - scene actions: read the asteroids, the natural events near a house,
//     the latest EPIC image of the Earth;
//   - dashboard widgets: asteroids, the Earth seen from DSCOVR, natural events.
//
// This file only wires the SDK client: the handlers are in src/app.js.
//
// Environment variables provided by the Gladys supervisor:
//   GLADYS_HOST_API_URL / GLADYS_INTEGRATION_TOKEN / GLADYS_INTEGRATION_SELECTOR
//   TZ (the timezone of Gladys: the times written in the scene texts)
// The SDK reads the first three: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { createApp } from './src/app.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const gladys = new GladysIntegration();
createApp(gladys);

// --- Startup -----------------------------------------------------------------------
logger.info(`Starting the NASA integration ${version}...`);
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
