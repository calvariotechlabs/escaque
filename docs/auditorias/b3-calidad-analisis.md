# B3 · Calidad del análisis del coach (RC-05)

Bloque B3 de la Release Candidate, issue #62. Mediciones con el banco de posiciones (`bench/`, Stockfish 17.1 como referencia externa, solo en desarrollo). Coach sin reloj y a profundidad 4, como en `antes-b1`.

## Qué se midió antes de cambiar nada

| Prueba | Resultado | Conclusión |
|---|---|---|
| 6.Cxf7 (H-06), sacrificio griego y Axf7+ del Traxler a profundidad 4, 5 y 6 | Pérdida 187/209/176 cp (H-06), 224/219/214 cp (griego), 325/357/359 cp (Traxler); tiempo ×3-5 por nivel (prof. 6: 7-15 s) | Más profundidad **no** arregla los sacrificios. Falta seguridad del rey en la evaluación: es trabajo de B11 (`evaluate.ts`). |
| Banco del coach a profundidad 5 | Falsos positivos 7 → 8; detección igual; tiempo medio ×3,5 (1,1 s), máximo 15,5 s | Una media jugada más no mejora los veredictos y se sale de cualquier tope de tiempo. |
| Presupuesto adaptativo por nodos para la búsqueda de antes (mín. 3 o 4, hasta 12; 120 k a 400 k nodos) | Ninguna variante mejora a profundidad 4 fija; con mínimo 3 empeoran H-07 y H-14; con 300-400 k nodos el máximo pasa de 15 s | Se descarta como mecanismo general. Se usa solo donde las mediciones lo justifican (abajo). |
| Confirmar «Error» y «Error grave» a profundidad 5 en todas las posiciones | Solo cambia 1 de 30 veredictos graves (coronar torre) | Confirmar en profundidad solo merece la pena donde es barato. |

## Causas raíz y cambios

| Defecto | Causa raíz | Cambio | Prueba de regresión |
|---|---|---|---|
| H-07 · 13.O-O: «Pieza colgando» en e5 | El aviso salía del intercambio estático (sin clavadas ni amenazas) y no se contrastaba con el motor | El aviso solo se da si el motor confirma que capturar esa pieza le sale bien al rival: casi tan bien como su mejor respuesta, o claramente mejor que antes de la jugada | `tests/coach-analisis.test.ts` (H-07) |
| Philidor · Cf7+ llamado «Error» (Stockfish: mate en 4) | La búsqueda de antes se para al ver el mate en 2; la de la jugada hecha se queda en 2 medias jugadas y no ve el mate más largo | Si la mejor daba mate y la hecha no lo mantiene, la hecha se mira más hondo con un presupuesto de nodos (150 k, determinista) | `coach-analisis.test.ts` (Philidor) |
| Coronar torre (c8=T, mate en 5) llamado «Error» | A profundidad 4 ninguna de las dos ve el mate | Antes de llamar «Error» o «Error grave» se vuelve a buscar más hondo **si cabe en 150 k nodos** (finales y posiciones forzadas); si completa más profundidad, manda ella, con las dos jugadas a la misma profundidad | `coach-analisis.test.ts` (coronar torre) |
| Tiempo: las búsquedas extra podrían sumar varios topes | Cada búsqueda extra tenía su propio reloj | Un solo reloj (`COACH_LIMITS.timeMs`) para la búsqueda de antes y las extra; la búsqueda extra solo cuenta si llega al menos a la profundidad de la normal | Revisión de código; suite del coach |
| El banco contaba como contradicción «Mejor jugada» con otra igual de buena | La regla externa usaba `best` en lugar de `alternative`, que es lo que enseña el panel desde B1 | La regla usa `alternative` y el banco suma además `checkInvariants` del propio coach | `tests/banco.test.ts` |

Ya existía y no se ha tocado: la cancelación de cálculos obsoletos (una petición nueva termina el Worker del coach y el repaso descarta respuestas viejas por número de petición; cubierto en `tests/worker-coach.test.ts` y `tests/worker-protocol.test.ts`).

## Antes y después

| Coach | antes-b1 (5e9e946) | después de B3 |
|---|---|---|
| Veredicto igual al de la referencia | 91/152 (60 %) | 99/152 (65 %) |
| Errores graves detectados | 20/23 (87 %) | 20/23 (87 %) |
| Falsos positivos | 7/123 (6 %) | 5/123 (4 %) |
| Errores llamados «Mejor» o «Buena» | 3 | 3 |
| Mates a favor vistos / permitidos vistos | 20/20 · 4/4 | 20/20 · 4/4 |
| Informes con contradicciones | 39/152 (26 %) | 0/152 (0 %), con `checkInvariants` incluida |
| Tiempo por análisis (media · p95 · máximo) | 190 · 715 · 3592 ms | 290 · 1046 · 3781 ms |

El aumento de tiempo frente a `antes-b1` viene de B1 (completar líneas para explicar). Frente a main tras B1, medido igual en este contenedor (286 · 973 · 4417 ms), B3 deja la media igual (+1 %), el p95 un 7 % más alto y el máximo más bajo. El repaso de una partida tarda lo mismo que hoy. Resultados completos en `bench/resultados/despues-b3.md`.

## Lo que queda abierto

- **Sacrificios correctos llamados «Error grave»** (6.Cxf7 de H-06, sacrificio griego, Axf7+ del Traxler): dependen de la evaluación (seguridad del rey, B11). El texto ya dice que puede ser un sacrificio cuya compensación el coach no ve (B1). Si B11 no lo resuelve, hace falta una excepción aprobada: capar el veredicto de los sacrificios bajaría la detección de los incorrectos (4 en el banco).
- **Cxd4 en el Blackburne-Shilling** («Error»; Stockfish: la mejor) y **axb4 en H-02b**: a profundidad 6 la pérdida baja, pero cuesta 10-80 s. Dependen de la velocidad del motor (B11).
- **Errores no vistos** (Cxe5 del Blackburne, Dxd4 del arca de Noé, 10…Da5 de H-14): el motor no ve la refutación a profundidad 4. B11.
- **Tope de 2 s por análisis**: el máximo sigue en 3,8 s (H-02b, posición muy cargada). Bajar de profundidad 4 empeora los veredictos (medido), así que depende de que B11 acelere la búsqueda.
- **H-11** (dos evaluaciones distintas de la misma posición): en el banco solo 2 de 82 posiciones cambian 1 peón o más de profundidad 4 a 5, y confirmar a profundidad 5 cambia 1 de 30 veredictos graves. No se marca la inestabilidad en el texto: no hay evidencia de que lo necesite.
