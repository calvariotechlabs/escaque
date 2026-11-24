# Banco de posiciones de referencia

Batería reproducible para medir a **Alfil Beta** y al **coach** contra una referencia externa (Stockfish). Es el bloque B2 de la Release Candidate (RC-04 en `consolidacion-rc.md`, tarea CAL-408).

Stockfish **no es una dependencia de Escaque**: no está en `package.json`, no se descarga solo, no entra en el sitio publicado y la app nunca lo llama. Se usa una vez, en desarrollo, para calcular `referencia-stockfish.json`, que queda guardado en el repositorio. Medir (`npm run bench:posiciones`) solo lee ese fichero.

## Ficheros

| Fichero | Qué es |
| --- | --- |
| `posiciones.json` | 82 posiciones con su categoría, su FEN, una descripción y las jugadas que el coach debe analizar (además de la mejor de la referencia). Las que salen de partidas guardan las jugadas de origen (`origen`, `origenUci`). |
| `referencia-stockfish.json` | Valoración de Stockfish de **todas las jugadas legales** de cada posición, con la metodología usada. |
| `resultados/antes-b1.json` y `.md` | Medición del commit `5e9e946` (el auditado), antes de los cambios del coach (B1) y del motor (B11). Es el «antes» con el que se compararán. |
| `../tools/stockfish-ref.mjs` | Genera la referencia (solo desarrollo). |
| `../tools/banco-core.ts`, `../tools/banco.ts` | Métricas e informe. |
| `../tests/banco.test.ts` | Comprueba en `npm test` que el banco y la referencia son válidos y que las métricas cuentan bien. |

## Uso

```bash
npm run bench:posiciones                          # informe en Markdown por la salida estándar (unos 4 min)
npm run bench:posiciones -- --etiqueta despues-b1 # además lo guarda en bench/resultados/despues-b1.{json,md}
npm run bench:posiciones -- --solo auditoria-h-01 # una posición
```

Para regenerar la referencia (solo si cambian las posiciones o se cambia de versión de Stockfish):

```bash
# Descarga manual del binario oficial (no se versiona ni se instala con npm):
# https://github.com/official-stockfish/Stockfish/releases/tag/sf_17.1 → stockfish-ubuntu-x86-64-avx2.tar
npm run bench:referencia -- /ruta/a/stockfish-ubuntu-x86-64-avx2 --procesos 4   # unos 3-4 min con 4 núcleos
```

## Categorías

| Categoría | Posiciones | Ejemplos |
| --- | --- | --- |
| Mate inmediato | 9 | Mate del pastor, del loco, de Légal, de la coz, del pasillo, coronando |
| Mate forzado | 4 | Philidor (Dg8+ Txg8 Cf7#), Schulder–Boden 1853, Ópera de Morphy (Db8+!), dama y rey contra rey |
| Doblete | 6 | Horquillas de caballo, de peón y de alfil; dobles ataques de dama; …Dg5 en el Blackburne-Shilling |
| Clavada | 5 | Pieza clavada atacada por un peón, clavada falsa de la trampa del elefante, gambito Englund |
| Descubierto | 4 | Jaques descubiertos que ganan la dama; trampa de la Petrov |
| Sacrificio correcto | 5 | Légal (Cxe5!), Ópera (Txd7!), Damiano (Cxe5!), sacrificio griego, Cxf7 contra el Traxler |
| Sacrificio incorrecto | 4 | Axf7+ prematuros, Axh7+ con el caballo de f6 defendiendo, …Cxe4? |
| Ganancia de material | 5 | Piezas sueltas, arca de Noé (…c5) |
| Pérdida de material | 8 | Trampa del elefante (Cxd5??), Blackburne-Shilling (Cxe5?), arca de Noé (Dxd4??), Englund (Ac3??) y tres jugadas que permiten mate en 1 |
| Jugadas equivalentes | 6 | Posición inicial, 1.e4 e5, Escocesa, Italiana, Ruy López, final de peones simétrico |
| Posiciones tranquilas | 7 | Ruy López cerrada, Gambito de dama, Najdorf, Francesa, Caro-Kann, India de rey, Inglesa |
| Finales | 7 | Lucena, Philidor, oposición, torres, peón alejado, alfil del color equivocado, coronar torre para no ahogar |
| Auditorías | 12 | Las 12 posiciones reproducidas de las dos auditorías (H-01 a H-14), con la jugada que se criticó |

Las posiciones están escritas a mano (jugadas desde la inicial o FEN) y **cada etiqueta se ha contrastado con la referencia**: cuando Stockfish no daba la razón a la descripción, se corrigió la posición o la categoría (por ejemplo, 5.Cxf7 contra el Traxler pasó de «sacrificio incorrecto» a «correcto»). 118 jugadas marcadas en total.

## Referencia: Stockfish

Registrado dentro de `referencia-stockfish.json` (`metodologia`):

- **Motor:** Stockfish 17.1, binario oficial `stockfish-ubuntu-x86-64-avx2` (SHA-256 en el fichero).
- **Configuración:** 1 hilo, tabla de 64 MB vaciada (`ucinewgame` y `Clear Hash`) antes de cada posición, sin tablas de finales.
- **Presupuesto:** 8.000.000 de nodos por posición (`go nodes`), con MultiPV igual al número de jugadas legales: se valora cada jugada, no solo la mejor. Profundidad alcanzada: de 17 en los medios juegos a más de 50 en finales y mates.
- **Puntuación:** centipeones o «mate en N», vistos por quien mueve tras hacer cada jugada (convención UCI).
- **Reproducibilidad:** con un hilo y un presupuesto fijo de nodos, Stockfish es determinista. Dos ejecuciones completas dieron ficheros idénticos posición a posición. La consolidación usó profundidad 20 y vio diferencias de hasta 0,25 peones entre dos ejecuciones; con nodos fijos y tabla vacía no las hay.
- **Límites conocidos:** 8 millones de nodos no es un análisis perfecto. En 28 de las 2.332 líneas la última iteración solo dio una cota (`lowerbound` o `upperbound`; se guarda en `cota`). En 7 posiciones el `bestmove` de Stockfish no es el primero de la lista ordenada por valoración, siempre a menos de 30 centipeones. Las métricas usan la primera de la lista.

## Qué se mide

### Alfil Beta

Cuatro perfiles sobre las 82 posiciones:

| Perfil | Cómo | ¿Determinista? |
| --- | --- | --- |
| Fácil | `chooseMove(…, "facil")` con una semilla fija por posición | Sí |
| Medio | `chooseMove(…, "medio")`: profundidad 3, tope de 0,5 s | **No del todo**: en la posición H-02b el tope corta la profundidad 3 en unos 0,5 s, y según la ejecución se queda en 2 o en 3 |
| Difícil | `chooseMove(…, "dificil")`: 0,9 s de reloj real | **No**: la profundidad depende del equipo |
| Profundidad 5 | `search` a profundidad fija 5 con tabla nueva | Sí |

Para cada jugada elegida:

- **Mejor jugada:** juega la primera de la referencia (o una con la misma valoración).
- **Equivalente:** a 30 centipeones o menos de la mejor.
- **Pérdida media:** centipeones perdidos respecto a la mejor, con las valoraciones recortadas a ±10 peones (un mate cuenta como +10). Así, elegir «+12» en lugar de «mate en 3» no cuenta como error, y sí dejar escapar una ventaja decisiva.
- **Errores de más de 2 peones:** pérdida mayor de 200 centipeones, en todo el banco y solo en las categorías tácticas (todas salvo equivalentes, tranquilas y finales). Es el criterio del **punto de parada del motor** (B11): Difícil por debajo de 1 s y ningún error de más de 2 peones en las tácticas.
- **Mates mantenidos:** en las posiciones donde la referencia ve mate a favor, la jugada elegida sigue llevando a mate.
- **Tiempo:** media y máximo por jugada, en Node, en el equipo donde se ejecuta.

### Coach

`analyzeMove` a profundidad 4 (la de `COACH_LIMITS`) **sin reloj**, para que el resultado no dependa del equipo, sobre la mejor jugada de la referencia y las jugadas marcadas de cada posición (unas 140 en total).

- **Veredicto de la referencia:** el mismo cálculo que hace el coach (curva logística con pendiente 0,00368208 y umbrales de 0,05, 0,10 y 0,15 de caída de puntos esperados) pero con las valoraciones de Stockfish, y con «Mejor jugada» para cualquier jugada equivalente (a 30 centipeones o menos).
- **Veredicto igual al de la referencia** y **matriz de veredictos** (filas: referencia; columnas: coach).
- **Errores graves detectados:** de las jugadas que la referencia califica de «Error grave», cuántas llama el coach «Error» o «Error grave».
- **Falsos positivos:** jugadas equivalentes a la mejor que el coach llama «Error» o «Error grave» (sacrificios correctos, por ejemplo).
- **Errores no vistos:** jugadas que la referencia llama «Error» o peor y el coach «Mejor» o «Buena».
- **Mejor jugada del coach equivalente a la de la referencia.**
- **Mates:** si la referencia ve mate a favor en 3 o menos, ¿el coach lo muestra en la evaluación de antes? Si la jugada permite un mate que antes no había, ¿lo muestra en la de después?
- **Coherencia:** las cinco invariantes de RC-01, comprobadas desde fuera sobre el informe (`invariantes()` en `tools/banco-core.ts`):
  1. «Mejor jugada» como veredicto y otra jugada como «Mejor jugada» debajo.
  2. Un aviso táctico y, a la vez, «no hay un motivo táctico».
  3. Mate en contra tras la jugada y un texto que elogia material o dice que la diferencia es pequeña.
  4. «X gana una torre» (o un peón, una pieza, la dama) cuando la línea de Alfil Beta (8 medias jugadas, la misma que usa el coach) no captura esa pieza.
  5. «Mejor» o «Buena» para una jugada que permite un mate que antes no había.
- **Tiempo** por análisis: media, percentil 95 y máximo.

### Estabilidad

Diferencia de la evaluación de Alfil Beta entre profundidad 4 (la del coach) y 5 en cada posición. Se marcan las que cambian un peón o más (hallazgo H-11).

## Duelo entre versiones del motor

El banco mide jugadas sueltas; para saber si un cambio del motor lo hace más fuerte hace falta jugar partidas. `tools/duelo.mjs` enfrenta dos `dist/` compilados de Escaque (por ejemplo, el de la rama y el de main en un worktree aparte):

```bash
node tools/duelo.mjs --a dist --b ../main/dist --partidas 100 --procesos 4 --nivel dificil --salida resultado.json
node tools/duelo.mjs --a dist --b ../main/dist --partidas 20 --ms 100   # prueba rápida: 100 ms por jugada
```

- Las partidas salen de `bench/aperturas.json` (50 aperturas escritas a mano y comprobadas como legales). Cada apertura se juega dos veces, una con cada color, así que ninguna versión gana por las aperturas.
- Cada jugador usa su propio núcleo y su propia tabla de transposición, vaciada al empezar cada partida. Las partidas acaban en mate, tablas por las reglas o un tope de jugadas.
- Da el marcador, el porcentaje de puntos con su intervalo de confianza del 95 %, la diferencia de Elo **entre las dos versiones** y la probabilidad de que A sea más fuerte (LOS), además del tiempo por jugada de cada una.
- Con el nivel Difícil el reloj es real: los procesos no deben compartir el equipo con otro trabajo pesado, porque afecta a la profundidad que alcanza cada lado.

Resultado de B11 (issue #63): `bench/resultados/duelo-b11-dificil.json`, +96 =1 −3 contra main.

## Reproducibilidad

- El informe trae una **huella** (FNV-1a de 32 bits) de todo lo determinista: jugadas de Fácil y de profundidad 5, estabilidad e informes completos del coach (veredicto, mejor jugada y textos). Deja fuera los tiempos y los niveles Medio y Difícil, que dependen del reloj. Dos ejecuciones del mismo commit dan la misma huella; si cambia, ha cambiado el comportamiento.
- Las posiciones de las auditorías se analizan desde su FEN, sin el historial de la partida: no cuentan repeticiones anteriores (en ninguna de las 12 influyen).

## Limitaciones

- **No hay Elo.** Con 82 posiciones elegidas a mano no se puede estimar una fuerza absoluta con validez estadística. Las cifras sirven para comparar versiones del mismo código sobre el mismo banco, no para compararse con otros motores.
- Las muestras por categoría son pequeñas (de 4 a 12). Una diferencia de una o dos posiciones entre versiones puede ser ruido del nivel Difícil; las comparaciones finas deben usar los perfiles deterministas.
- Stockfish a 8 millones de nodos es una referencia muy fuerte, no una verdad absoluta, sobre todo en finales que necesitarían tablas (el alfil del color equivocado lo valora +0,5 en lugar de tablas).
- Las invariantes se comprueban sobre el texto con expresiones regulares: detectan las contradicciones descritas en la consolidación, no cualquier incoherencia. El elogio de una jugada que no es la mejor del coach no se comprueba con la regla 4, porque el informe no expone su línea. Cuando B1 añada `checkInvariants` al coach, el banco debería usar también esa comprobación.
- Los tiempos son de Node en el equipo que ejecuta el banco, no del navegador.
