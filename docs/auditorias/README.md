# Auditorías externas de Escaque

Evidencia histórica de las dos auditorías del 24 de noviembre de 2026, hechas sobre el commit `5e9e946` y sin cambiar nada del repositorio. No se editan: cualquier corrección va en la consolidación o en documentos nuevos.

| Fichero | Qué es |
|---|---|
| [auditoria-chatgpt-2026-11-24.pdf](auditoria-chatgpt-2026-11-24.pdf) | Auditoría de ChatGPT, 11 páginas, tal como se entregó |
| [auditoria-claude-2026-11-24.md](auditoria-claude-2026-11-24.md) | Auditoría de Claude, copia textual del documento original (sin las capturas) |
| [consolidacion-rc.md](consolidacion-rc.md) | Matriz consolidada, causas raíz, backlog y plan de la Release Candidate (CAL-408) |
| [reproduccion/](reproduccion/) | Scripts y salidas con los que se reprodujeron los casos del coach |

## Cómo repetir la reproducción

```sh
npm ci && npm run build
node docs/auditorias/reproduccion/coach.mjs "$PWD" '<casos en JSON>'
```

Los casos exactos están en la consolidación (sección 3). `stockfish.mjs` necesita la ruta de un binario de Stockfish que se descarga a mano: Stockfish es solo una referencia de validación durante el desarrollo, nunca una dependencia del proyecto ni del sitio. Versión usada: Stockfish 17.1, `stockfish-ubuntu-x86-64-avx2` oficial, 1 hilo, 64 MB de tabla, profundidad 20.
