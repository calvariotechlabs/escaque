# B6 · Validación integral (RC-08, issue #72)

Fecha: 24-nov-2026. Código validado: `main` en `b9abb5e` (incluye firma, pie y «Acerca de»). Las pruebas se hicieron con Chrome real (Chromium con Playwright) contra el sitio construido con `npm run build:site`, servido con **las mismas cabeceras de `vercel.json`** (CSP incluida), y contra el despliegue de producción de Vercel donde se pudo.

Leyenda: **Ejecutada** (hecha aquí, con evidencia) · **Parcial** (hecha solo en parte) · **Pendiente de persona** (necesita a Sergio o un dispositivo físico).

## 1. Resultado en una línea

Sin defectos funcionales ni de seguridad nuevos. Un hallazgo de texto (F-01, bajo) que necesita decisión de Sergio porque el texto está en el diseño aprobado. No hay cambios de código en esta PR: solo este informe.

## 2. Pruebas ejecutadas

| Área | Prueba | Estado | Evidencia |
|---|---|---|---|
| Suites existentes | `npm test` | Ejecutada | 1093 de 1093 en verde, 27 s |
| Suites existentes | `npm run test:e2e` (14 ficheros) | Ejecutada | 97 de 97 en verde, 54 s |
| CSP | Cuatro rutas (`#/jugar`, `#/lecciones`, una lección, `#/acerca`) con la CSP de producción | Ejecutada | 0 errores ni violaciones en consola; el JSON-LD en línea no la rompe |
| Privacidad | Peticiones a otros orígenes | Ejecutada | Ninguna: todo es del mismo origen |
| Privacidad | Cookies | Ejecutada | `document.cookie` vacío y 0 cookies en el contexto; `localStorage` solo con claves `escaque:` |
| Instalación PWA | Criterios de instalabilidad de Chrome (`Page.getInstallabilityErrors`) y errores de manifiesto | Ejecutada | Listas vacías. Iconos 192/512, maskable y SVG existen y están en la caché del service worker |
| Service worker | Se instala, controla la página y crea una única caché `escaque-<versión>` | Ejecutada | Una caché tras recargar |
| Sin conexión | Recarga sin red: abre y restaura la partida | Ejecutada | `1. e4 e5 2. Cf3` restaurada |
| Sin conexión | Seguir jugando sin red; abrir «Acerca de»; la máquina en nivel Difícil (Worker) | Ejecutada | Jugada propia aceptada; la máquina respondió en 1,0 s; aviso «Sin conexión. Puedes seguir jugando» |
| Recuperación | Recargar con partida a medias | Ejecutada | Partida y orientación recuperadas |
| Recuperación | Datos guardados corruptos (JSON roto, `null`, jugada ilegal, 200 kB de basura, clave de lecciones rota, tema inválido) | Ejecutada | Seis casos: arranca limpio, sin errores |
| Recuperación | `localStorage` bloqueado (como modo privado estricto) | Ejecutada | Se juega sin errores |
| Actualización del service worker | Subir una versión nueva con la pestaña abierta | Ejecutada | Aviso «Hay una versión nueva», la página no se recarga sola; «Actualizar ahora» carga la versión nueva, borra la caché vieja y la partida en curso sobrevive |
| PGN | Exportar: nombre `escaque-AAAA-MM-DD.pgn` y contenido `1. d4 d5 *` | Ejecutada | Descarga real |
| PGN | Importar el mismo fichero | Ejecutada | Abre el repaso con 2 jugadas |
| PGN | Importar PGN con jugada ilegal; PGN de 12 000 medias jugadas | Ejecutada | Mensajes claros («La jugada 1... e4 no es legal…», «La partida tiene demasiadas jugadas») |
| Móvil | Sin desborde horizontal en 8 tamaños (320×568, 360×640, 390×844, 844×390, 667×375, 768×1024, 1280×800, 1920×1080), en inicio, lecciones, una lección, acerca y partida | Ejecutada | 0 desbordes en 40 combinaciones; ningún control táctil por debajo de 24 px |
| Zoom | 200 % (640×400) | Ejecutada | Sin scroll horizontal |
| Movimiento | `prefers-reduced-motion` | Ejecutada | Sin animaciones infinitas ni transiciones largas |
| Teclado | Tab por todos los controles de inicio; foco visible en todos (anillo de 3 px, también en las tarjetas de opción) | Ejecutada | Captura revisada |
| Teclado | Empezar con Enter: el foco va al tablero | Ejecutada | Foco en `e1` |
| Teclado | Recorrer el tablero con flechas; mover e2-e4 con Enter | Ejecutada | La jugada se apunta y se anuncia: «Blancas: e4. Peón de e2 a e4.» |
| Teclado | Diálogo PGN: abre con foco en el campo, Tab queda dentro, Escape cierra y devuelve el foco a «Cargar PGN» | Ejecutada | `<dialog>` modal nativo |
| Teclado | Rutas: el foco va al título (h2) en Lecciones y Acerca | Ejecutada | Comprobado |
| Estructura | `lang="es"`, un h1, landmarks (banner, dos navegaciones con nombre, main, pie), árbol de accesibilidad de Acerca y Lecciones | Ejecutada | Nombres completos en los enlaces de lección |
| Rendimiento | Carga con CPU 4 veces más lenta (local): primer pintado | Ejecutada | 164 ms la primera visita, 100 ms con el service worker |
| Rendimiento | Tamaño: sitio 795 kB; JS 446 kB sin comprimir; JS+CSS+HTML 131 kB comprimidos | Ejecutada | `du` y `gzip` |
| Rendimiento | Repaso de 33 medias jugadas (la Ópera de Morphy), análisis completo | Ejecutada | 8,9 s, con barra de progreso y la interfaz respondiendo |
| «Acerca de» | «Sin dependencias en ejecución» | Ejecutada | `dependencies: {}` en `package.json` |
| «Acerca de» | «Sin cookies / sin cuentas / todo en tu dispositivo» | Ejecutada | Ver Privacidad |
| «Acerca de» | «Funciona sin conexión» | Ejecutada | Ver Sin conexión |
| «Acerca de» | «Licencia MIT» | Ejecutada | `LICENSE` es MIT, © 2026 Calvario TechLabs (coincide con el pie) |
| Cabeceras en producción | Despliegue de producción `escaque-iui5i9fnr` (commit `b9abb5e`), ruta `/manifest.webmanifest` | Parcial | Servidas: CSP completa, X-Frame-Options DENY, nosniff, Referrer-Policy no-referrer, Permissions-Policy, COOP same-origin, HSTS (63072000, preload), `Cache-Control: no-cache` del manifiesto y su tipo MIME |

## 3. Qué no se pudo medir y por qué

1. **Cabeceras en las páginas HTML y el JS de producción.** La Protección contra bots de Vercel (Challenge) responde 429 a cualquier cliente de un centro de datos, también con enlace de acceso compartido: se vio con `curl`, con Chrome sin cabeza y con la herramienta de Vercel. Solo el manifiesto pasó. Como todas las rutas comparten la regla `/(.*)` de `vercel.json` (que además tiene prueba propia, `vercel-config.test.mjs`), lo esperable es que sean idénticas, pero **no está medido**. Pendiente de Sergio: abrir https://escaque.calvariotechlabs.com/ en Chrome, pestaña Red, y mirar las cabeceras de respuesta del documento (un navegador normal pasa el desafío).
2. **Cabecera `x-robots-tag: noindex`.** Salió en el despliegue `*.vercel.app`; es normal en alias que no son de producción, pero hay que confirmar que **no** sale en `escaque.calvariotechlabs.com` (sería invisible para buscadores). Pendiente de Sergio, en la misma medición.
3. **Reglas del cortafuegos.** No son legibles por la API de Vercel en este proyecto (ya anotado). No se enviaron peticiones de prueba al sitio real.

## 4. Pendiente de persona o dispositivo físico (guion corto)

| Prueba | Dispositivo | Qué comprobar |
|---|---|---|
| Instalar | Android (Chrome) y iPhone (Safari, «Añadir a pantalla de inicio») | Que aparece el aviso o la opción, el icono (también el maskable en Android) y que abre a pantalla completa |
| Sin conexión real | Los mismos, en modo avión tras abrir una vez la web | Que abre, que se puede jugar contra la máquina y que sale el aviso «Sin conexión» |
| Actualización | Instalada en el móvil, tras la siguiente fusión a main | Que sale «Hay una versión nueva» al volver a abrirla |
| Uso a una mano | Móvil en vertical y apaisado | Alcance de «Empezar partida», «Deshacer» y arrastrar piezas con el pulgar |
| Lector de pantalla | TalkBack (Android) y VoiceOver (iPhone y Mac) | Que anuncia las jugadas («Blancas: e4. Peón de e2 a e4.»), el nombre de las casillas, el diálogo de PGN y los avisos. Aquí solo se pudo comprobar el árbol de accesibilidad y la región `aria-live`, **no** lo que dice un lector real |
| Cabeceras en producción | Navegador de Sergio | Punto 3.1 y 3.2 |

## 5. Hallazgos

### F-01 · Texto del aviso de versión nueva (bajo, pendiente de decisión)

El aviso dice «Al actualizar se reinicia la partida en curso.» Medido: al actualizar, la página se recarga pero **la partida en curso se restaura** (en la prueba, `1. d4 d5` seguía ahí). El texto asusta sin motivo.

- Dónde: `src/pwa/notices.ts` (línea 52), y la prueba `tests/pwa-notices.test.ts`, que fija ese texto.
- El texto forma parte del diseño aprobado (Lienzo, lámina «Avisos»; Design System, componente Notice). Por la regla de «diseño primero» no lo cambio sin tu OK.
- Propuesta: «Al actualizar se recarga la página y tu partida se conserva.» Es un cambio de una línea más su prueba, sin cambio de maquetación. Si lo apruebas, lo hago en otra PR con la actualización de `docs/design`.

### Observaciones sin defecto

- La CSP usa `'self'` y no `nonce`: no hace falta nonce porque la web no tiene scripts ni estilos en línea (el bloque JSON-LD es un dato, no código, y no lo bloquea la CSP, medido).
- Al tabular fuera del último control el foco pasa al navegador (en Chrome sin cabeza se ve como `body`): comportamiento normal, no una trampa.
- Las pruebas de `fetch()` a mismo origen en `http://127.0.0.1` fallan por `upgrade-insecure-requests` de la CSP. Es un artefacto de probar por http; la app no usa `fetch` (carga módulos y Workers) y en producción es https.

## 6. Cómo repetirlo

Las comprobaciones de navegador se hicieron con scripts desechables de Playwright, que no está entre las dependencias del proyecto (a propósito), así que no se añaden al repositorio. Lo que sí es repetible en el repositorio: `npm test` y `npm run test:e2e`, que cubren teclado, instalación, lecciones, PGN, arrastre y accesibilidad. La actualización del service worker entre versiones, el modo sin conexión, el estado corrupto y los tamaños de pantalla solo tienen la cobertura de unidad de `tools/sw.test.mjs` y `tests/save*.test.ts`; si quieres, se pueden pasar a e2e con `tools/cdp.mjs` (hecho aparte, en B4 o después de la RC).
