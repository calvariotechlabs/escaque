# Diseño de Escaque

Copia en el repositorio de lo que se diseña en Claude Design. Regla del proyecto: no se escribe código visual sin que el diseño y el Design System hayan pasado antes por allí.

| Qué | Origen en Claude Design | Versión | Exportado |
| --- | --- | --- | --- |
| Design System «S-Design - Escaque» | https://claude.ai/artifact/5eMkXXkB3rMzuRwKU5osqC | 1794395532-9b16 | 2026-11-11 |
| Lienzo «Design - Escaque» (partida en escritorio, móvil y coronación) | https://claude.ai/artifact/EFBEpxb6n1xjdX35LYqNcG | 1794395696-33a5 | 2026-11-11 |

Los enlaces son privados de la cuenta de Calvario TechLabs.

## Contenido

- `design-system/`: `README.md` (el libro de marca), `tokens.json` (fuente de los valores), `tokens.css` (generado a partir de `tokens.json`), `components/` (`bundle.css`, `pieces.js` con las siluetas y, por componente, README y vista previa `preview.html`) y `assets/Piezas/` (las doce piezas en SVG).
- `lienzo/`: `canvas.json` y las tres pantallas (`*.dc.html`). Son fuentes del editor de Claude Design: para verlas en HTML puro, abre el enlace de arriba. Las imágenes de pieza apuntan a ids de subida de ese lienzo, no a ficheros de este repositorio.

## Cómo se usa en el código

- `src/ui/tokens.css` se genera a partir de `tokens.json` (valores y temas) y `src/ui/board.css` copia de `components/bundle.css` las reglas de piezas, tablero, marcas y botones. Si cambia el diseño, se actualiza primero aquí y después en `src/ui`.
- Las siluetas de `src/ui/pieces.ts` son las mismas de `components/pieces.js`.
