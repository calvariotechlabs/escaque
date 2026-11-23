Repaso de la partida: pantalla que se abre desde «Repasar la partida» en el panel de resultado y deja recorrer la partida terminada con el coach.

**Estado:** aprobado por Sergio el 23-nov-2026 (CAL-304) e implementado (CAL-378): estilos en `src/ui/repaso.css` (copia de `lienzo/repaso.css` más la maquetación), lógica en `src/ui/review.ts` y pantalla en `src/ui/review-screen.ts`. Todavía no están en `components/bundle.css` ni en el Design System de Claude Design.

**Piezas.** Reutiliza `tablero`, `coach` (la jugada seleccionada es el panel del coach con el título «Jugada seleccionada»), `jugadas`, `boton` y `resultado`. Añade:
- `paso`: seis botones de texto en dos filas (Inicio, Anterior, Siguiente, Final; Error clave anterior, Siguiente error clave). Con el foco en ellos, ← → Inicio y Fin (`aria-keyshortcuts`); no hay atajos globales.
- `curva`: curva de evaluación en SVG con la misma escala que el coach (puntos esperados). Lo claro es ventaja blanca; la línea discontinua, la igualdad. Es solo una vista: `role="img"` con un resumen escrito y todo lo que muestra se puede hacer con botones. Marcas: triángulo (error o error grave) y círculo discontinuo (imprecisión); relleno claro, blancas; oscuro, negras. El cursor de la jugada seleccionada es una barra de 3 px en `accent`.
- `clave`: lista de errores clave (errores y errores graves) y, plegadas, las imprecisiones. Cada fila es un botón con forma, texto («Error grave · negras») y la evaluación («+3,1 → +7,6»); la jugada seleccionada lleva `aria-current="true"` y borde de 3 px.
- `resumen`: tabla «Resumen por bando» con cinco filas (mejores, buenas, imprecisiones, errores, errores graves).
- `jugadas__lista--repaso`: la lista de jugadas con el triángulo o el círculo antes de la jugada y un texto oculto («, error grave»). Se desplaza dentro de su panel hasta la jugada seleccionada.
- `avance` (análisis en curso, `role="progressbar"`) y `rep-fallo` (no se pudo revisar, borde discontinuo, `role="alert"`).

**Anuncios.** Al cambiar de jugada, el veredicto (`role="status"`) empieza con un texto oculto: «14. Th2, blancas. Error. Th2 no aprovecha la captura de la torre de a8.», con la jugada en notación española. Los textos y los veredictos salen de `src/coach` (`CoachReport`); no hace falta ningún dato nuevo salvo recorrer la partida jugada a jugada.

**Estados.** Analizando (la curva se dibuja a medida que llegan jugadas y lo pendiente va rayado), jugada sin revisar, sin errores clave y fallo.

**Datos del ejemplo.** Partida de 53 jugadas ganada por las blancas, analizada con `analyzeMove` a profundidad 4: 11 jugadas con imprecisión o error (5 errores, 6 imprecisiones).

**Móvil horizontal.** Sin lámina propia: sigue el patrón del coach apaisado (tablero a la izquierda y, a la derecha, una región con scroll propio con los botones de paso fijos arriba).

**Análisis.** Jugada a jugada en un Worker del coach propio del repaso (unos 0,2 a 0,6 s por jugada), primero la jugada seleccionada si falta y después en orden; reutiliza los informes que el coach ya calculó durante la partida. «Parar el análisis» lo detiene y el botón pasa a «Seguir con el análisis» (texto añadido al implementarlo, no está en el lienzo).
