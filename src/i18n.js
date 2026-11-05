// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback).
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: feature and device names, widget contents, statuses, scene texts
// and errors, results of the configuration buttons. Vocabulary of the Gladys
// interface (appareil / Gerät / dispositivo, maison / Zuhause / vivienda);
// German says "du", Spanish "usted", like Gladys. The names of the asteroids
// and the titles of the EONET events stay as NASA writes them (English).
// -----------------------------------------------------------------------------

const LANGUAGES = ['en', 'fr', 'de', 'es'];

const TEXTS = {
  // devices and features
  deviceAsteroids: {
    en: 'Near-Earth asteroids (NASA)',
    fr: 'Astéroïdes géocroiseurs (NASA)',
    de: 'Erdnahe Asteroiden (NASA)',
    es: 'Asteroides cercanos (NASA)',
  },
  deviceEvents: {
    en: 'Natural events – {house}',
    fr: 'Événements naturels – {house}',
    de: 'Naturereignisse – {house}',
    es: 'Eventos naturales – {house}',
  },
  feature_closest_distance: {
    en: 'Closest approach (km)',
    fr: 'Passage le plus proche (km)',
    de: 'Nächster Vorbeiflug (km)',
    es: 'Paso más cercano (km)',
  },
  feature_closest_lunar: {
    en: 'Closest approach (lunar distances)',
    fr: 'Passage le plus proche (distances lunaires)',
    de: 'Nächster Vorbeiflug (Mondabstände)',
    es: 'Paso más cercano (distancias lunares)',
  },
  feature_approaches: {
    en: 'Approaches in 7 days',
    fr: 'Passages sur 7 jours',
    de: 'Vorbeiflüge in 7 Tagen',
    es: 'Pasos en 7 días',
  },
  feature_hazardous: {
    en: 'Potentially hazardous in 7 days',
    fr: 'Potentiellement dangereux sur 7 jours',
    de: 'Potenziell gefährlich in 7 Tagen',
    es: 'Potencialmente peligrosos en 7 días',
  },
  feature_closest_name: {
    en: 'Closest asteroid',
    fr: 'Astéroïde le plus proche',
    de: 'Nächster Asteroid',
    es: 'Asteroide más cercano',
  },
  feature_events_nearby: {
    en: 'Natural events nearby',
    fr: 'Événements naturels proches',
    de: 'Naturereignisse in der Nähe',
    es: 'Eventos naturales cercanos',
  },
  feature_nearest_distance: {
    en: 'Nearest event (km)',
    fr: 'Événement le plus proche (km)',
    de: 'Nächstes Ereignis (km)',
    es: 'Evento más cercano (km)',
  },
  feature_nearest_event: {
    en: 'Nearest event',
    fr: 'Événement le plus proche',
    de: 'Nächstes Ereignis',
    es: 'Evento más cercano',
  },
  stateNearestEvent: {
    en: '{title} ({category}, {distance} km)',
    fr: '{title} ({category}, {distance} km)',
    de: '{title} ({category}, {distance} km)',
    es: '{title} ({category}, {distance} km)',
  },
  stateNoEvent: {
    en: 'None within {radius} km',
    fr: 'Aucun dans un rayon de {radius} km',
    de: 'Keines im Umkreis von {radius} km',
    es: 'Ninguno en {radius} km a la redonda',
  },
  stateNoApproach: {
    en: 'None in 7 days',
    fr: 'Aucun sur 7 jours',
    de: 'Keiner in 7 Tagen',
    es: 'Ninguno en 7 días',
  },

  // EONET categories
  category_drought: { en: 'Drought', fr: 'Sécheresse', de: 'Dürre', es: 'Sequía' },
  category_dustHaze: {
    en: 'Dust and haze',
    fr: 'Poussière et brume',
    de: 'Staub und Dunst',
    es: 'Polvo y bruma',
  },
  category_earthquakes: { en: 'Earthquake', fr: 'Séisme', de: 'Erdbeben', es: 'Terremoto' },
  category_floods: { en: 'Flood', fr: 'Inondation', de: 'Überschwemmung', es: 'Inundación' },
  category_landslides: {
    en: 'Landslide',
    fr: 'Glissement de terrain',
    de: 'Erdrutsch',
    es: 'Deslizamiento',
  },
  category_manmade: {
    en: 'Man-made',
    fr: 'Origine humaine',
    de: 'Menschengemacht',
    es: 'De origen humano',
  },
  category_seaLakeIce: {
    en: 'Sea and lake ice',
    fr: 'Glace de mer et de lac',
    de: 'Meer- und Seeeis',
    es: 'Hielo marino y lacustre',
  },
  category_severeStorms: {
    en: 'Severe storm',
    fr: 'Tempête violente',
    de: 'Schwerer Sturm',
    es: 'Tormenta severa',
  },
  category_snow: { en: 'Snow', fr: 'Neige', de: 'Schnee', es: 'Nieve' },
  category_tempExtremes: {
    en: 'Extreme temperature',
    fr: 'Température extrême',
    de: 'Extremtemperatur',
    es: 'Temperatura extrema',
  },
  category_volcanoes: { en: 'Volcano', fr: 'Volcan', de: 'Vulkan', es: 'Volcán' },
  category_waterColor: {
    en: 'Water colour',
    fr: 'Couleur de l’eau',
    de: 'Wasserfärbung',
    es: 'Color del agua',
  },
  category_wildfires: {
    en: 'Wildfire',
    fr: 'Feu de forêt',
    de: 'Waldbrand',
    es: 'Incendio forestal',
  },
  category_other: { en: 'Other', fr: 'Autre', de: 'Sonstiges', es: 'Otro' },

  // status of the integration (200 characters at most)
  statusOk: {
    en: 'NASA read {time}: {approaches} asteroid approaches in 7 days, {events} natural events near your houses.',
    fr: 'NASA lue {time} : {approaches} passages d’astéroïdes sur 7 jours, {events} événements naturels près de vos maisons.',
    de: 'NASA gelesen {time}: {approaches} Asteroiden-Vorbeiflüge in 7 Tagen, {events} Naturereignisse nahe deinen Zuhause.',
    es: 'NASA leída {time}: {approaches} pasos de asteroides en 7 días, {events} eventos naturales cerca de sus viviendas.',
  },
  statusWaiting: {
    en: 'First reading of the NASA services in progress…',
    fr: 'Première lecture des services de la NASA en cours…',
    de: 'Erste Abfrage der NASA-Dienste läuft…',
    es: 'Primera lectura de los servicios de la NASA en curso…',
  },
  statusUnreachable: {
    en: 'The NASA services do not answer since {time} ({detail}). Retrying later.',
    fr: 'Les services de la NASA ne répondent plus depuis {time} ({detail}). Nouvel essai plus tard.',
    de: 'Die NASA-Dienste antworten seit {time} nicht ({detail}). Neuer Versuch später.',
    es: 'Los servicios de la NASA no responden desde {time} ({detail}). Se reintentará más tarde.',
  },
  statusKey: {
    en: 'api.nasa.gov refuses the API key: check it in the configuration, or empty the field to use DEMO_KEY.',
    fr: 'api.nasa.gov refuse la clé d’API : vérifiez-la dans la configuration, ou videz le champ pour utiliser DEMO_KEY.',
    de: 'api.nasa.gov lehnt den API-Schlüssel ab: Prüfe ihn in der Konfiguration oder leere das Feld für DEMO_KEY.',
    es: 'api.nasa.gov rechaza la clave de API: revísela en la configuración o vacíe el campo para usar DEMO_KEY.',
  },
  statusQuota: {
    en: 'The hourly quota of api.nasa.gov is used up ({key}): the asteroids wait for the next hour.',
    fr: 'Le quota horaire d’api.nasa.gov est épuisé ({key}) : les astéroïdes attendent l’heure suivante.',
    de: 'Das Stundenkontingent von api.nasa.gov ist aufgebraucht ({key}): Die Asteroiden warten bis zur nächsten Stunde.',
    es: 'La cuota horaria de api.nasa.gov está agotada ({key}): los asteroides esperan a la hora siguiente.',
  },
  statusNoHouse: {
    en: 'No house of Gladys has a location: no natural events.',
    fr: 'Aucune maison de Gladys n’est localisée : pas d’événements naturels.',
    de: 'Kein Zuhause in Gladys hat einen Standort: keine Naturereignisse.',
    es: 'Ninguna vivienda de Gladys tiene ubicación: sin eventos naturales.',
  },
  keyDemo: { en: 'DEMO_KEY', fr: 'DEMO_KEY', de: 'DEMO_KEY', es: 'DEMO_KEY' },
  keyOwn: { en: 'your key', fr: 'votre clé', de: 'dein Schlüssel', es: 'su clave' },

  // widgets
  widgetWaiting: {
    en: 'Waiting for the first reading of NASA…',
    fr: 'En attente de la première lecture de la NASA…',
    de: 'Warte auf die erste Abfrage der NASA…',
    es: 'Esperando la primera lectura de la NASA…',
  },
  widgetNoHouse: {
    en: 'Give a location to a house of Gladys (Settings → Houses) to see the events near it.',
    fr: 'Localisez une maison de Gladys (Paramètres → Maisons) pour voir les événements autour.',
    de: 'Gib einem Zuhause in Gladys einen Standort (Einstellungen → Zuhause), um die Ereignisse in der Nähe zu sehen.',
    es: 'Ubique una vivienda de Gladys (Ajustes → Viviendas) para ver los eventos cercanos.',
  },
  widgetNoApproach: {
    en: 'No asteroid approach announced for the next 7 days.',
    fr: 'Aucun passage d’astéroïde annoncé pour les 7 prochains jours.',
    de: 'Kein Asteroiden-Vorbeiflug für die nächsten 7 Tage angekündigt.',
    es: 'Ningún paso de asteroide anunciado para los próximos 7 días.',
  },
  widgetNoEvent: {
    en: 'No natural event within {radius} km in the last {days} days.',
    fr: 'Aucun événement naturel dans un rayon de {radius} km ces {days} derniers jours.',
    de: 'Kein Naturereignis im Umkreis von {radius} km in den letzten {days} Tagen.',
    es: 'Ningún evento natural a menos de {radius} km en los últimos {days} días.',
  },
  tileClosest: { en: 'Closest', fr: 'Le plus proche', de: 'Am nächsten', es: 'Más cercano' },
  tileApproaches: {
    en: 'Approaches 7 d',
    fr: 'Passages 7 j',
    de: 'Vorbeiflüge 7 T.',
    es: 'Pasos 7 d',
  },
  tileHazardous: {
    en: 'Hazardous',
    fr: 'Dangereux',
    de: 'Gefährlich',
    es: 'Peligrosos',
  },
  tileEvents: { en: 'Events', fr: 'Événements', de: 'Ereignisse', es: 'Eventos' },
  tileNearest: { en: 'Nearest', fr: 'Le plus proche', de: 'Am nächsten', es: 'Más cercano' },
  unitLunar: { en: 'LD', fr: 'DL', de: 'LD', es: 'DL' },
  badgeHazardous: { en: 'Hazardous', fr: 'Dangereux', de: 'Gefährlich', es: 'Peligroso' },
  badgeClose: { en: 'Close', fr: 'Proche', de: 'Nah', es: 'Cercano' },
  rowApproach: {
    en: '{when} · {lunar} LD · {diameter} m',
    fr: '{when} · {lunar} DL · {diameter} m',
    de: '{when} · {lunar} LD · {diameter} m',
    es: '{when} · {lunar} DL · {diameter} m',
  },
  detailApproach: {
    en: 'Closest approach: {when}\nDistance: {km} km ({lunar} lunar distances)\nRelative speed: {kms} km/s\nEstimated diameter: {diameter} m\nPotentially hazardous: {hazardous}\nOn the Sentry impact risk list: {sentry}',
    fr: 'Passage au plus près : {when}\nDistance : {km} km ({lunar} distances lunaires)\nVitesse relative : {kms} km/s\nDiamètre estimé : {diameter} m\nPotentiellement dangereux : {hazardous}\nSur la liste de risque d’impact Sentry : {sentry}',
    de: 'Größte Annäherung: {when}\nAbstand: {km} km ({lunar} Mondabstände)\nRelativgeschwindigkeit: {kms} km/s\nGeschätzter Durchmesser: {diameter} m\nPotenziell gefährlich: {hazardous}\nAuf der Sentry-Einschlagsrisikoliste: {sentry}',
    es: 'Máxima aproximación: {when}\nDistancia: {km} km ({lunar} distancias lunares)\nVelocidad relativa: {kms} km/s\nDiámetro estimado: {diameter} m\nPotencialmente peligroso: {hazardous}\nEn la lista de riesgo de impacto Sentry: {sentry}',
  },
  detailEvent: {
    en: 'Category: {category}\nLast update: {date}\nDistance: {distance} km\nMagnitude: {magnitude}\nSource: {source}',
    fr: 'Catégorie : {category}\nDernière mise à jour : {date}\nDistance : {distance} km\nAmpleur : {magnitude}\nSource : {source}',
    de: 'Kategorie: {category}\nLetzte Aktualisierung: {date}\nAbstand: {distance} km\nAusmaß: {magnitude}\nQuelle: {source}',
    es: 'Categoría: {category}\nÚltima actualización: {date}\nDistancia: {distance} km\nMagnitud: {magnitude}\nFuente: {source}',
  },
  linkJpl: { en: 'JPL page', fr: 'Fiche du JPL', de: 'JPL-Seite', es: 'Ficha del JPL' },
  linkSource: { en: 'Source', fr: 'Source', de: 'Quelle', es: 'Fuente' },
  yes: { en: 'yes', fr: 'oui', de: 'ja', es: 'sí' },
  no: { en: 'no', fr: 'non', de: 'nein', es: 'no' },
  captionAsteroids: {
    en: 'NASA NeoWs (JPL data) · read {time}',
    fr: 'NASA NeoWs (données du JPL) · lu {time}',
    de: 'NASA NeoWs (JPL-Daten) · gelesen {time}',
    es: 'NASA NeoWs (datos del JPL) · leído {time}',
  },
  altEarth: {
    en: 'The Earth seen by EPIC from DSCOVR, {date}',
    fr: 'La Terre vue par EPIC depuis DSCOVR, {date}',
    de: 'Die Erde von EPIC an Bord von DSCOVR gesehen, {date}',
    es: 'La Tierra vista por EPIC desde DSCOVR, {date}',
  },
  captionEarth: {
    en: 'NASA EPIC · DSCOVR · {date}',
    fr: 'NASA EPIC · DSCOVR · {date}',
    de: 'NASA EPIC · DSCOVR · {date}',
    es: 'NASA EPIC · DSCOVR · {date}',
  },
  captionEarthHouse: {
    en: 'NASA EPIC · {date} · facing {house}',
    fr: 'NASA EPIC · {date} · face à {house}',
    de: 'NASA EPIC · {date} · Blick auf {house}',
    es: 'NASA EPIC · {date} · frente a {house}',
  },
  captionEvents: {
    en: 'NASA EONET · {house} · {radius} km · {days} d · {time}',
    fr: 'NASA EONET · {house} · {radius} km · {days} j · {time}',
    de: 'NASA EONET · {house} · {radius} km · {days} T. · {time}',
    es: 'NASA EONET · {house} · {radius} km · {days} d · {time}',
  },

  // scenes
  sentenceAsteroids: {
    en: '{count} asteroids pass near the Earth in the next 7 days, {hazardous} of them potentially hazardous. The closest: {name}, {date}, at {lunar} lunar distances ({km} km).',
    fr: '{count} astéroïdes passent près de la Terre ces 7 prochains jours, dont {hazardous} potentiellement dangereux. Le plus proche : {name}, {date}, à {lunar} distances lunaires ({km} km).',
    de: '{count} Asteroiden fliegen in den nächsten 7 Tagen an der Erde vorbei, davon {hazardous} potenziell gefährlich. Am nächsten: {name}, {date}, in {lunar} Mondabständen ({km} km).',
    es: '{count} asteroides pasan cerca de la Tierra en los próximos 7 días, {hazardous} de ellos potencialmente peligrosos. El más cercano: {name}, {date}, a {lunar} distancias lunares ({km} km).',
  },
  sentenceAsteroidsNone: {
    en: 'No asteroid approach is announced for the next 7 days.',
    fr: 'Aucun passage d’astéroïde n’est annoncé pour les 7 prochains jours.',
    de: 'Für die nächsten 7 Tage ist kein Asteroiden-Vorbeiflug angekündigt.',
    es: 'No se anuncia ningún paso de asteroide para los próximos 7 días.',
  },
  sentenceCloseApproach: {
    en: 'Asteroid {name} will pass {date} at {lunar} lunar distances from the Earth ({km} km), at {kms} km/s, about {diameter} m wide.',
    fr: 'L’astéroïde {name} passera {date} à {lunar} distances lunaires de la Terre ({km} km), à {kms} km/s, environ {diameter} m de diamètre.',
    de: 'Der Asteroid {name} fliegt {date} in {lunar} Mondabständen an der Erde vorbei ({km} km), mit {kms} km/s, etwa {diameter} m groß.',
    es: 'El asteroide {name} pasará {date} a {lunar} distancias lunares de la Tierra ({km} km), a {kms} km/s, de unos {diameter} m.',
  },
  sentenceHazardous: {
    en: 'Potentially hazardous asteroid {name} will pass {date} at {lunar} lunar distances from the Earth ({km} km), about {diameter} m wide.',
    fr: 'L’astéroïde potentiellement dangereux {name} passera {date} à {lunar} distances lunaires de la Terre ({km} km), environ {diameter} m de diamètre.',
    de: 'Der potenziell gefährliche Asteroid {name} fliegt {date} in {lunar} Mondabständen an der Erde vorbei ({km} km), etwa {diameter} m groß.',
    es: 'El asteroide potencialmente peligroso {name} pasará {date} a {lunar} distancias lunares de la Tierra ({km} km), de unos {diameter} m.',
  },
  sentenceEvents: {
    en: '{count} natural events within {radius} km of {house} in the last {days} days. The nearest: {title} ({category}), {distance} km away, {date}.',
    fr: '{count} événements naturels dans un rayon de {radius} km autour de {house} ces {days} derniers jours. Le plus proche : {title} ({category}), à {distance} km, le {date}.',
    de: '{count} Naturereignisse im Umkreis von {radius} km um {house} in den letzten {days} Tagen. Am nächsten: {title} ({category}), {distance} km entfernt, am {date}.',
    es: '{count} eventos naturales a menos de {radius} km de {house} en los últimos {days} días. El más cercano: {title} ({category}), a {distance} km, el {date}.',
  },
  sentenceEventsNone: {
    en: 'No natural event within {radius} km of {house} in the last {days} days.',
    fr: 'Aucun événement naturel dans un rayon de {radius} km autour de {house} ces {days} derniers jours.',
    de: 'Kein Naturereignis im Umkreis von {radius} km um {house} in den letzten {days} Tagen.',
    es: 'Ningún evento natural a menos de {radius} km de {house} en los últimos {days} días.',
  },
  sentenceNaturalEvent: {
    en: '{category}: {title}, {distance} km from {house} ({date}).',
    fr: '{category} : {title}, à {distance} km de {house} ({date}).',
    de: '{category}: {title}, {distance} km von {house} entfernt ({date}).',
    es: '{category}: {title}, a {distance} km de {house} ({date}).',
  },
  sentenceEarth: {
    en: 'Latest image of the whole Earth by NASA EPIC: {date}, centred on latitude {lat}, longitude {lon}.',
    fr: 'Dernière image de la Terre entière par EPIC (NASA) : {date}, centrée sur la latitude {lat}, longitude {lon}.',
    de: 'Neuestes Bild der ganzen Erde von NASA EPIC: {date}, zentriert auf Breite {lat}, Länge {lon}.',
    es: 'Última imagen de la Tierra entera de NASA EPIC: {date}, centrada en la latitud {lat}, longitud {lon}.',
  },
  errNoData: {
    en: 'NASA did not answer: {detail}',
    fr: 'La NASA n’a pas répondu : {detail}',
    de: 'Die NASA hat nicht geantwortet: {detail}',
    es: 'La NASA no ha respondido: {detail}',
  },
  errNoHouse: {
    en: 'No house of Gladys has a location.',
    fr: 'Aucune maison de Gladys n’est localisée.',
    de: 'Kein Zuhause in Gladys hat einen Standort.',
    es: 'Ninguna vivienda de Gladys tiene ubicación.',
  },

  // configuration buttons
  testOk: {
    en: 'NASA answers. Asteroids: {approaches} approaches in 7 days ({key}). Earth: EPIC images of {epic}. Natural events: {events} near {houses}.',
    fr: 'La NASA répond. Astéroïdes : {approaches} passages sur 7 jours ({key}). Terre : images EPIC du {epic}. Événements naturels : {events} près de {houses}.',
    de: 'Die NASA antwortet. Asteroiden: {approaches} Vorbeiflüge in 7 Tagen ({key}). Erde: EPIC-Bilder vom {epic}. Naturereignisse: {events} nahe {houses}.',
    es: 'La NASA responde. Asteroides: {approaches} pasos en 7 días ({key}). Tierra: imágenes EPIC del {epic}. Eventos naturales: {events} cerca de {houses}.',
  },
  testFailed: {
    en: 'NASA does not answer: {detail}',
    fr: 'La NASA ne répond pas : {detail}',
    de: 'Die NASA antwortet nicht: {detail}',
    es: 'La NASA no responde: {detail}',
  },
  diagnosticDone: {
    en: 'Diagnostic written to the logs of the integration in {count} line(s) "NASA diagnostic" (no key, no coordinates).',
    fr: 'Diagnostic écrit dans les journaux de l’intégration en {count} ligne(s) « NASA diagnostic » (ni clé ni coordonnées).',
    de: 'Diagnose in {count} Zeile(n) „NASA diagnostic“ in die Protokolle der Integration geschrieben (ohne Schlüssel und Koordinaten).',
    es: 'Diagnóstico escrito en los registros de la integración en {count} línea(s) «NASA diagnostic» (sin clave ni coordenadas).',
  },
  none: { en: 'none', fr: 'aucune', de: 'keine', es: 'ninguna' },

  // relative times
  never: { en: 'never', fr: 'jamais', de: 'nie', es: 'nunca' },
  justNow: { en: 'just now', fr: 'à l’instant', de: 'gerade eben', es: 'ahora mismo' },
  minutesAgo: {
    en: '{n} min ago',
    fr: 'il y a {n} min',
    de: 'vor {n} Min.',
    es: 'hace {n} min',
  },
  hoursAgo: { en: '{n} h ago', fr: 'il y a {n} h', de: 'vor {n} Std.', es: 'hace {n} h' },
  daysAgo: {
    en: '{n} days ago',
    fr: 'il y a {n} jours',
    de: 'vor {n} Tagen',
    es: 'hace {n} días',
  },
};

/**
 * @description Whether a value is a language of the integration.
 * @param {unknown} value - The value.
 * @returns {boolean} True for en, fr, de, es.
 */
function isLanguage(value) {
  return LANGUAGES.includes(value);
}

/**
 * @description A text in a language, with its values.
 * @param {string} key - A TEXTS key.
 * @param {string} language - The language (English when unknown).
 * @param {object} [values] - The values of the `{placeholders}`.
 * @returns {string} The text, the key itself when unknown.
 */
function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) {
    return key;
  }
  const template = entry[isLanguage(language) ? language : 'en'] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (whole, name) =>
    values[name] === undefined || values[name] === null ? '' : String(values[name]),
  );
}

/**
 * @description A text in the four languages.
 * @param {string|Function} key - A TEXTS key, or `(language) => text`.
 * @param {object|Function} [values] - The values, or `(language) => values`.
 * @returns {object} `{ en, fr, de, es }`.
 */
function all(key, values = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      typeof key === 'function'
        ? key(language)
        : t(key, language, typeof values === 'function' ? values(language) : values),
    ]),
  );
}

/**
 * @description How long ago an instant was: "just now", "12 min ago", "3 h ago".
 * @param {number} at - The instant, in ms (0: never).
 * @param {number} now - Now, in ms.
 * @param {string} language - The language.
 * @returns {string} The text.
 */
function ago(at, now, language) {
  if (!at) {
    return t('never', language);
  }
  const minutes = Math.floor((now - at) / 60000);
  if (minutes < 1) {
    return t('justNow', language);
  }
  if (minutes < 60) {
    return t('minutesAgo', language, { n: minutes });
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return t('hoursAgo', language, { n: hours });
  }
  return t('daysAgo', language, { n: Math.floor(hours / 24) });
}

/**
 * @description A number in the format of a language.
 * @param {number} value - The number.
 * @param {string} language - The language.
 * @param {number} [decimals] - The decimals at most.
 * @returns {string} "2,33" in French.
 */
function formatNumber(value, language, decimals = 1) {
  if (!Number.isFinite(value)) {
    return '–';
  }
  return new Intl.NumberFormat(isLanguage(language) ? language : 'en', {
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * @description A signed number: "+2", "−5,1".
 * @param {number} value - The number.
 * @param {string} language - The language.
 * @param {number} [decimals] - The decimals at most.
 * @returns {string} The text.
 */
function formatSigned(value, language, decimals = 1) {
  if (!Number.isFinite(value)) {
    return '–';
  }
  return new Intl.NumberFormat(isLanguage(language) ? language : 'en', {
    maximumFractionDigits: decimals,
    signDisplay: 'exceptZero',
  }).format(value);
}

export { LANGUAGES, TEXTS, isLanguage, t, all, ago, formatNumber, formatSigned };
