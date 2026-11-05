// -----------------------------------------------------------------------------
// Dashboard widgets of the NASA integration.
//
//   - `asteroids`       the close approaches of the next 7 days: the closest one
//                       in lunar distances, the count of approaches and of
//                       potentially hazardous asteroids, then the 8 closest
//                       (or the 8 next ones) in a list; a row opens its details
//                       and its page on the JPL site;
//   - `earth`           the latest image of EPIC whose centre is the closest to
//                       the longitude of a house: the whole sunlit face of the
//                       Earth seen from DSCOVR;
//   - `natural_events`  the EONET events within the radius of a house: their
//                       count, the nearest distance, the list with the category,
//                       the magnitude and the distance as a badge.
// No button: the readings follow their own rhythm, and the widgets never ask
// NASA anything (the EPIC image is read once, then served from memory). The
// content is cached per language. The date of a card-list row replaces its
// subtitle: the dates are written in the subtitles.
// Content budget of a card: 8 components, 1 main one, 6 tiles, 2 texts (1
// body), 1 status, 4 buttons.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { t, ago, formatNumber } from './i18n.js';
import { formatTime, formatDate } from './time.js';
import { diameterRange } from './neo.js';
import { imageKey } from './epic.js';
import { categoryLabel, magnitudeText } from './summary.js';

const WIDGETS = { ASTEROIDS: 'asteroids', EARTH: 'earth', NATURAL_EVENTS: 'natural_events' };
const TTL_SECONDS = { asteroids: 900, earth: 1800, natural_events: 900, message: 120 };
const ASTEROID_SORTS = ['distance', 'date'];
const DEFAULT_ASTEROID_SORT = 'distance';
const LIST_ITEMS = 8;

/**
 * @description Truncate a text to a bound, with an ellipsis.
 * @param {string} value - The text.
 * @param {number} max - The bound.
 * @returns {string} The text.
 */
function clip(value, max) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * @description A widget content made of one message.
 * @param {string} message - The message.
 * @param {object} [options] - `{ heading, ttl }`.
 * @returns {object} The content.
 */
function messageContent(message, { heading, ttl = TTL_SECONDS.message } = {}) {
  const components = [];
  if (heading) {
    components.push({ type: 'text', variant: 'heading', text: clip(heading, 40) });
  }
  components.push({ type: 'text', variant: 'body', text: clip(message, 300) });
  return { ttl_seconds: ttl, components };
}

/**
 * @description The color of a lunar distance against the threshold.
 * @param {number} lunar - The distance (LD).
 * @param {number} threshold - The threshold of the configuration (LD).
 * @returns {string} A widget color.
 */
const lunarColor = (lunar, threshold) =>
  lunar <= 1
    ? WIDGET_COLORS.DANGER
    : lunar <= threshold
      ? WIDGET_COLORS.WARNING
      : WIDGET_COLORS.SUCCESS;

/**
 * @description The "asteroids" widget.
 * @param {object} options - Options.
 * @param {object} options.week - weekOf() (neo.js).
 * @param {number|null} options.updatedAt - When NeoWs was last read.
 * @param {number} options.threshold - The close-approach threshold (LD).
 * @param {string} options.language - The user language.
 * @param {string} [options.timeZone] - The timezone of Gladys.
 * @param {number} options.now - Now.
 * @param {object} [options.settings] - `{ sort }`.
 * @returns {object} The content.
 */
function buildAsteroidsWidget({
  week,
  updatedAt,
  threshold,
  language,
  timeZone,
  now,
  settings = {},
}) {
  if (!updatedAt) {
    return messageContent(t('widgetWaiting', language));
  }
  const components = [];
  const closest = week.closest;
  if (closest) {
    components.push({
      type: 'value',
      value: formatNumber(closest.lunar, language, closest.lunar < 10 ? 2 : 1),
      unit: t('unitLunar', language),
      label: clip(t('tileClosest', language), 24),
      icon: 'crosshair',
      color: lunarColor(closest.lunar, threshold),
    });
  }
  components.push(
    {
      type: 'value',
      value: week.count,
      label: clip(t('tileApproaches', language), 24),
      icon: 'calendar',
    },
    {
      type: 'value',
      value: week.hazardous,
      label: clip(t('tileHazardous', language), 24),
      icon: 'alert-triangle',
      color: week.hazardous > 0 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS,
    },
  );
  const sort = ASTEROID_SORTS.includes(settings.sort) ? settings.sort : DEFAULT_ASTEROID_SORT;
  const rows = [...week.list]
    .sort(sort === 'date' ? (a, b) => a.at - b.at : (a, b) => a.km - b.km)
    .slice(0, LIST_ITEMS);
  if (rows.length) {
    components.push({
      type: 'card-list',
      display: 'list',
      items: rows.map((approach) => {
        const lunar = formatNumber(approach.lunar, language, approach.lunar < 10 ? 2 : 1);
        const diameter = diameterRange(approach);
        const when = formatTime(approach.at, { language, timeZone, now });
        const badge = approach.hazardous
          ? { text: clip(t('badgeHazardous', language), 16), color: WIDGET_COLORS.DANGER }
          : approach.lunar <= threshold
            ? { text: clip(t('badgeClose', language), 16), color: WIDGET_COLORS.WARNING }
            : null;
        return {
          title: clip(approach.name, 60),
          subtitle: clip(
            t('rowApproach', language, { when, lunar, diameter: diameter || '?' }),
            60,
          ),
          ...(badge ? { badge } : {}),
          description: clip(
            t('detailApproach', language, {
              when,
              km: formatNumber(Math.round(approach.km), language, 0),
              lunar,
              kms: formatNumber(approach.kms, language, 1),
              diameter: diameter || '?',
              hazardous: t(approach.hazardous ? 'yes' : 'no', language),
              sentry: t(approach.sentry ? 'yes' : 'no', language),
            }),
            2000,
          ),
          links: [{ url: approach.url, label: clip(t('linkJpl', language), 24) }],
        };
      }),
    });
  } else {
    components.push({ type: 'text', variant: 'body', text: t('widgetNoApproach', language) });
  }
  components.push({
    type: 'text',
    variant: 'caption',
    text: clip(t('captionAsteroids', language, { time: ago(updatedAt, now, language) }), 80),
  });
  return { ttl_seconds: TTL_SECONDS.asteroids, components };
}

/**
 * @description The "earth" widget.
 * @param {object} options - Options.
 * @param {object|null} options.image - The EPIC image shown.
 * @param {object|null} options.house - The house it faces, if any.
 * @param {string} options.language - The user language.
 * @param {string} [options.timeZone] - The timezone of Gladys.
 * @returns {object} The content.
 */
function buildEarthWidget({ image, house, language, timeZone }) {
  if (!image) {
    return messageContent(t('widgetWaiting', language));
  }
  const date = `${formatDate(image.at, { language, timeZone })}, ${formatTime(image.at, {
    language,
    timeZone,
    now: image.at,
  })}`;
  return {
    ttl_seconds: TTL_SECONDS.earth,
    components: [
      {
        type: 'image',
        key: imageKey(image),
        fit: 'contain',
        alt: clip(t('altEarth', language, { date }), 120),
      },
      {
        type: 'text',
        variant: 'caption',
        text: clip(
          t(house ? 'captionEarthHouse' : 'captionEarth', language, {
            date,
            house: house?.name ?? '',
          }),
          80,
        ),
      },
    ],
  };
}

/**
 * @description The color of the distance of an event.
 * @param {number} distance - In km.
 * @param {number} radiusKm - The radius of the configuration.
 * @returns {string} A widget color.
 */
const distanceColor = (distance, radiusKm) =>
  distance <= Math.min(50, radiusKm / 4)
    ? WIDGET_COLORS.DANGER
    : distance <= radiusKm / 2
      ? WIDGET_COLORS.WARNING
      : WIDGET_COLORS.INFO;

/**
 * @description The "natural_events" widget.
 * @param {object} options - Options.
 * @param {object} options.house - The house.
 * @param {object[]} options.events - The events near it (eventsNear).
 * @param {number|null} options.updatedAt - When EONET was last read for it.
 * @param {number} options.radiusKm - The radius of the configuration.
 * @param {number} options.eventDays - The period of the configuration.
 * @param {string} options.language - The user language.
 * @param {string} [options.timeZone] - The timezone of Gladys.
 * @param {number} options.now - Now.
 * @returns {object} The content.
 */
function buildEventsWidget({
  house,
  events,
  updatedAt,
  radiusKm,
  eventDays,
  language,
  timeZone,
  now,
}) {
  if (!updatedAt) {
    return messageContent(t('widgetWaiting', language));
  }
  const components = [
    {
      type: 'value',
      value: events.length,
      label: clip(t('tileEvents', language), 24),
      icon: 'alert-triangle',
      color: events.length ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS,
    },
  ];
  if (events.length) {
    components.push({
      type: 'value',
      value: events[0].distance,
      unit: 'km',
      label: clip(t('tileNearest', language), 24),
      icon: 'map-pin',
      color: distanceColor(events[0].distance, radiusKm),
    });
    components.push({
      type: 'card-list',
      display: 'list',
      items: events.slice(0, LIST_ITEMS).map((event) => {
        const category = categoryLabel(event.category, language);
        const magnitude = magnitudeText(event, language);
        const date = formatDate(event.at, { language, timeZone });
        return {
          title: clip(event.title, 60),
          subtitle: clip([category, date, magnitude].filter(Boolean).join(' · '), 60),
          badge: {
            text: clip(`${formatNumber(event.distance, language, 0)} km`, 16),
            color: distanceColor(event.distance, radiusKm),
          },
          description: clip(
            t('detailEvent', language, {
              category,
              date,
              distance: formatNumber(event.distance, language, 0),
              magnitude: magnitude || '–',
              source: event.source ?? '–',
            }),
            2000,
          ),
          ...(event.url
            ? { links: [{ url: event.url, label: clip(t('linkSource', language), 24) }] }
            : {}),
        };
      }),
    });
  } else {
    components.push({
      type: 'text',
      variant: 'body',
      text: clip(
        t('widgetNoEvent', language, {
          radius: formatNumber(radiusKm, language, 0),
          days: eventDays,
        }),
        300,
      ),
    });
  }
  components.push({
    type: 'text',
    variant: 'caption',
    text: clip(
      t('captionEvents', language, {
        house: house.name,
        radius: formatNumber(radiusKm, language, 0),
        days: eventDays,
        time: ago(updatedAt, now, language),
      }),
      80,
    ),
  });
  return { ttl_seconds: TTL_SECONDS.natural_events, components };
}

export {
  WIDGETS,
  TTL_SECONDS,
  ASTEROID_SORTS,
  DEFAULT_ASTEROID_SORT,
  messageContent,
  buildAsteroidsWidget,
  buildEarthWidget,
  buildEventsWidget,
};
