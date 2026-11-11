Panel del coach: explica la última jugada con veredicto, mejor jugada, caída de la evaluación y avisos.

**Reglas.** `section.coach` con título «Coach» y la jugada revisada en notación. El veredicto (`coach__veredicto`) es la única región `role="status"`: «Error grave.», «Imprecisión.» o «Buena jugada.» más una frase corta. La gravedad se ve por icono, borde (`--grave` sólido de 2 px en `ink`, `--dudosa` discontinuo) y palabra; nunca solo por color. La evaluación es una lista de definiciones («Antes», «Después») con el valor en peones o «Mate en 1» y una barra decorativa (`aria-hidden`): lo claro es ventaja blanca y la marca central es la igualdad. Cada aviso (`coach__aviso`) lleva título con icono, una frase y un botón «Ver en el tablero» con `aria-label` que empieza por el texto visible («Ver en el tablero: dama colgando en h5»). El aviso activo lleva borde de 3 px en `accent` y su botón dice «Quitar del tablero». El botón marca las casillas con `data-marks` (seleccionada, destino, captura).

**Estados.** Error grave, imprecisión, buena jugada (sin avisos), revisando (`coach__barra-pensando`, quieta con movimiento reducido; el tablero sigue libre) y sin jugadas.

**Textos.** Español de tú, sin exclamaciones y con punto final. Avisos: «Pieza colgando», «Mate en 1 que se escapó», «Captura gratis no vista».
