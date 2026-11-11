# Escaque

App web para aprender ajedrez con motor propio (**Alfil Beta**), escrita desde cero en TypeScript sin dependencias en ejecución: ni librerías de ajedrez, ni frameworks de interfaz. TypeScript solo se usa para compilar.

## Estado

**Hito actual: 1 — Reglas + perft, sin interfaz** (en preparación).

| Hito | Descripción | Estado |
| --- | --- | --- |
| 0 | Repositorio, estructura y herramientas | En curso |
| 1 | Reglas completas + perft | Pendiente |
| 2 | Tablero jugable (dos jugadores) | Pendiente |
| 3 | Máquina en Web Worker, 3 niveles | Pendiente |
| 4 | Coach: explicación de errores | Pendiente |
| 5 | 5–6 lecciones guiadas | Pendiente |
| 6 | Pulido para portfolio, CI y despliegue | Pendiente |

## Cómo se hizo

El diseño y las decisiones técnicas (arquitectura, tablero 0x88, estrategia de búsqueda, criterios de «terminado») son míos. La implementación está asistida con Claude y revisada por mí. Las decisiones y las cifras se irán documentando aquí a medida que avancen los hitos.

## Estructura

```
src/core     reglas: tablero 0x88, generador de jugadas, FEN, notación algebraica (SAN)
src/engine   Alfil Beta: evaluación + búsqueda (no depende de la interfaz)
src/coach    explicación de errores
src/lessons  lecciones como datos (FEN + objetivo + comprobación)
src/ui       tablero, controles, paneles
src/worker   puente entre la interfaz y el motor
tests/       perft y reglas especiales
```

`core` y `engine` funcionan igual en Node y en el navegador.

## Desarrollo

Requiere Node LTS (22 o superior).

```sh
npm install      # solo instala TypeScript (devDependency)
npm run build    # tsc -> dist/ (módulos ES nativos)
npm test         # compila y ejecuta node --test
```

## Licencia

MIT.
