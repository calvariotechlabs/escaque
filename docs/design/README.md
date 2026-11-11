# Diseño de Escaque

Copia en el repositorio de lo que se diseña en Claude Design. Regla del proyecto: no se escribe código visual sin que el diseño y el Design System hayan pasado antes por allí.

| Qué | Origen en Claude Design | Versión | Exportado |
| --- | --- | --- | --- |
| Design System «S-Design - Escaque» | https://claude.ai/artifact/5eMkXXkB3rMzuRwKU5osqC | 1794419285-18b9 | 2026-11-11 |
| Lienzo «Design - Escaque» (tres páginas: Escritorio, Tablet y Móvil, con partida, coronación, confirmación, avisos, arranque y, nuevo, ajustes, «la máquina piensa» y resultado de jugar contra la máquina y, nuevo, el panel del coach) | https://claude.ai/artifact/EFBEpxb6n1xjdX35LYqNcG | 1794419101-aaeb | 2026-11-11 |

Los enlaces son privados de la cuenta de Calvario TechLabs.

## Contenido

- `design-system/`: `README.md` (el libro de marca), `tokens.json` (fuente de los valores), `tokens.css` (generado a partir de `tokens.json`), `components/` (`bundle.css`, `pieces.js` con las siluetas y, por componente, README y vista previa `preview.html`) `assets/Piezas/` (las doce piezas en SVG) y `assets/Icono/` (icono de la app, versión maskable, símbolo, logos horizontales y favicon; salen del pack de logos). Los componentes `GameSetup` (modo, nivel y color) y `GameResult` (resultado de la partida contra la máquina) y la variante `estado--pensando` de `GameStatus` son de jugar contra la máquina. El componente `Coach` (veredicto, caída de la evaluación y avisos de pieza colgando, mate en 1 que se escapó y captura gratis no vista) es del hito 4. Los componentes `Notice` (avisos de instalar, sin conexión y versión nueva) y `AppIcon` son de la PWA; la vista previa de `AppIcon` apunta a ids de subida del Design System.
- `lienzo/`: `canvas.json` y las pantallas (`*.dc.html`: escritorio, móvil, tablet vertical y horizontal, móvil horizontal, coronación, confirmación, avisos, arranque y, de jugar contra la máquina, `Ajustes*`, `Pensando*`, `Resultado*` y, del coach, `CoachEscritorio`, `CoachEstados`, `CoachTablet` y `CoachMovil`, más `coach.css`, los estilos del panel, que también están en `components/bundle.css` del Design System). `canvas.json` agrupa todo en tres páginas (escritorio, tablet y móvil), en filas por tipo de panel. Son fuentes del editor de Claude Design: para verlas en HTML puro, abre el enlace de arriba. Las imágenes de pieza apuntan a ids de subida de ese lienzo, no a ficheros de este repositorio.

## Cómo se usa en el código

- `src/ui/tokens.css` se genera a partir de `tokens.json` (valores y temas) y `src/ui/board.css` copia de `components/bundle.css` las reglas de piezas, tablero, marcas y botones. Si cambia el diseño, se actualiza primero aquí y después en `src/ui`.
- Las siluetas de `src/ui/pieces.ts` son las mismas de `components/pieces.js`.

- La PWA (`public/manifest.webmanifest`, `public/icons/`, `src/pwa/`) sale de las páginas de tablet, móvil horizontal, avisos y arranque, y del grupo Icono. Puntos de corte y colores de tema: ver el README del Design System.
