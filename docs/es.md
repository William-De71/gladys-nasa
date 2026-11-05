# NASA

## Presentación

Esta integración lleva a Gladys tres servicios abiertos de la NASA: los **asteroides cercanos a la Tierra** que pasan en los próximos 7 días (NeoWs, datos del JPL), la última imagen de la **Tierra entera** tomada por la cámara EPIC del satélite DSCOVR, a 1,5 millones de km, y los **eventos naturales** que sigue EONET cerca de sus viviendas: incendios forestales, tormentas severas, inundaciones, volcanes, hielo marino…

Transporte: nube. La integración lee `api.nasa.gov`, `epic.gsfc.nasa.gov` y `eonet.gsfc.nasa.gov`. Envía su clave de la NASA, si la indicó, solo a api.nasa.gov, y para EONET un cuadrado del radio elegido alrededor de cada vivienda ubicada, nunca su posición exacta. No afiliada a la NASA.

**La distancia lunar.** La distancia de la Tierra a la Luna, 384 400 km. La mayoría de los asteroides de una semana pasan más allá de 5 distancias lunares; unos pocos al año pasan dentro de la órbita de la Luna. Un **asteroide potencialmente peligroso** (PHA) mide más de unos 140 m y su órbita se acerca a menos de 7,5 millones de km de la de la Tierra: una clasificación, no un impacto anunciado.

## Requisitos previos

- Gladys 5.3.0 o posterior (widgets y desencadenadores de escena).
- Para los eventos naturales y la Tierra frente a su vivienda: una vivienda ubicada (Ajustes → Viviendas). La integración pide las coordenadas de las viviendas al instalarla.
- Opcional: una clave de API gratuita de la NASA, pedida en un minuto en https://api.nasa.gov/ (basta una dirección de correo). Sin ella, la clave compartida `DEMO_KEY` permite 10 peticiones por hora y dirección IP; la integración usa 4 al día.

## Configuración

| Campo                              | Uso                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------- |
| Clave de API de la NASA (opcional) | Vacío: `DEMO_KEY`. Una clave personal evita compartir una cuota con su red.                 |
| Idioma de los textos               | Nombres de los dispositivos, frases de las escenas y errores. Automático: el último widget. |
| Radio alrededor de cada vivienda   | 100 a 2000 km (500 por defecto): hasta dónde cuenta un evento natural.                      |
| Eventos de los últimos             | 7, 14 o 30 días (14 por defecto).                                                           |
| Paso cercano a menos de            | 1 a 20 distancias lunares (5 por defecto): desencadenador de paso cercano y colores.        |

El botón **Probar la conexión** lee los tres servicios (los asteroides solo si no se leyeron en los últimos 10 minutos) y enumera las viviendas ubicadas. **Diagnóstico** escribe el estado de la integración en sus registros, sin la clave ni las coordenadas.

La integración lee los asteroides cada 6 horas, EPIC cada 3 horas (un nuevo día de imágenes se publica una vez al día, con uno o dos días de retraso) y EONET cada hora. Un fallo la hace esperar más cada vez (6 horas como máximo); una cuota agotada espera una hora; una clave rechazada espera un cambio de la configuración.

## Uso

### Dispositivos

En la pantalla Descubrir: un dispositivo **Asteroides cercanos (NASA)**, y un dispositivo **Eventos naturales** por vivienda ubicada. Cree los que quiera.

| Dispositivo                  | Funciones                                                                                                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asteroides cercanos (NASA)   | Paso más cercano de los próximos 7 días (km y distancias lunares), pasos en 7 días, potencialmente peligrosos en 7 días, nombre del asteroide más cercano                  |
| Eventos naturales – vivienda | Número de eventos en el radio y el periodo, distancia del más cercano (km), su título, categoría y distancia (un texto). Sin evento, la distancia conserva su último valor |

### Widgets del panel

![Los tres widgets: los asteroides de la semana, los eventos naturales cerca de una vivienda, la Tierra desde el espacio (ilustración generada, no una captura de pantalla; 2026 VX1 y el incendio del bosque de Chaux son ficticios)](https://raw.githubusercontent.com/William-De71/gladys-nasa/main/docs/assets/widgets.es.png)

- **Asteroides cercanos**: el paso más cercano (rojo bajo 1 distancia lunar, naranja bajo el umbral), los contadores, luego los 8 pasos más cercanos o próximos (ajuste) con su fecha, distancia y tamaño; una fila abre sus detalles y la ficha del JPL.
- **La Tierra desde el espacio**: elija un dispositivo Eventos naturales (vacío: la primera vivienda ubicada): la última imagen EPIC cuyo centro es el más cercano a la longitud de la vivienda, con su fecha.
- **Eventos naturales cercanos**: elija un dispositivo Eventos naturales: el número, la distancia del más cercano y los eventos con su categoría, fecha, magnitud y fuente.

### Escenas

Desencadenadores (cada uno se dispara una sola vez, nunca al arrancar):

- **NASA: paso cercano de un asteroide**: un asteroide pasará más cerca que el umbral en los próximos 7 días.
- **NASA: asteroide potencialmente peligroso**: un PHA pasará en los próximos 7 días, sea cual sea su distancia.
- **NASA: evento natural cercano**: un nuevo evento EONET en el radio de una vivienda; filtro por vivienda y por categorías. Cambiar el radio o el periodo nunca dispara los eventos que entran en el campo.

Cada desencadenador da una frase lista, `{{triggerEvent.data.message}}`, en el idioma de la configuración; los títulos de los eventos quedan en inglés, como los escribe la NASA.

Acciones: **leer los asteroides de la semana**, **leer los eventos naturales cercanos** (una vivienda), **leer la última imagen de la Tierra** (una vivienda), cada una con una frase `summary`; la última también da el enlace de la imagen. Responden con las últimas lecturas y solo vuelven a leer lo que es demasiado antiguo.

Ejemplos:

1. Cuando **paso cercano de un asteroide** (umbral: 1 distancia lunar) → enviar la notificación `{{triggerEvent.data.message}}`.
2. Cuando **evento natural cercano** en el dispositivo Eventos naturales de la vivienda, categoría Incendios forestales → enviar «Incendio a {{triggerEvent.data.distance_km}} km: {{triggerEvent.data.title}}».
3. Cada domingo a las 9:00 → **leer los asteroides de la semana** → enviar el `summary`.

## Solución de problemas

- **Ningún dispositivo Eventos naturales**: la vivienda no tiene ubicación (Ajustes → Viviendas); luego vuelva a buscar desde la pantalla Descubrir.
- **«api.nasa.gov rechaza la clave de API»**: revise la clave, o vacíe el campo para usar `DEMO_KEY`.
- **«La cuota horaria de api.nasa.gov está agotada»**: `DEMO_KEY` la comparten todos los dispositivos de su dirección IP pública; pida una clave personal gratuita.
- **Los eventos naturales se quedan en 0**: EONET es escaso fuera de Estados Unidos; pruebe un radio o un periodo mayores.
- **La imagen de la Tierra tiene unos días**: EPIC publica sus imágenes con uno o dos días de retraso, y a veces se detiene varios días.
- Registros: Ajustes → Supervisión; añada `DEBUG=gladys-integration-sdk` en modo desarrollador para los registros del SDK. Issues: https://github.com/William-De71/gladys-nasa/issues
