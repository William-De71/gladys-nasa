# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.1.0] - unreleased

### Added

- **asteroids:** the close approaches of near-Earth asteroids for the next 7 days, from the NASA NeoWs service (JPL data): the closest one in kilometres and lunar distances, the count of approaches and of potentially hazardous asteroids, with a free NASA API key or the shared DEMO_KEY and a prudent budget of 4 requests a day
- **earth:** the latest images of the whole Earth taken by EPIC on board DSCOVR, the one facing your house shown in a dashboard widget
- **natural events:** the wildfires, storms, floods, volcanoes and other natural events tracked by EONET near each located house of Gladys, within a radius of your choice, as a device per house
- **scenes:** triggers for an asteroid passing closer than a threshold in lunar distances, a potentially hazardous asteroid approaching, and a new natural event near a house (filtered by house and category); actions that read the asteroids of the week, the natural events near a house and the latest EPIC image, each with a sentence ready to send
- **widgets:** the asteroids of the week, the Earth seen from DSCOVR, and the natural events near a house
- **configuration:** optional NASA API key, language of the texts, radius and period of the natural events, threshold of the close approaches, a "Test the connection" button and a "Diagnostic" button
- **i18n:** English, French, German and Spanish for the manifest, the runtime texts, the documentation and the README
