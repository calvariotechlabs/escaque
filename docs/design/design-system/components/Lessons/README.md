Lecciones guiadas: lista de lecciones, objetivo, pistas, retroalimentación (acierto, fallo, paso intermedio) y progreso.

**Reglas.** La lista (`ol.lecciones`) lleva una tarjeta por lección: cada `a.leccion` es un enlace con número (decorativo), título (con «Lección N:» solo para lectores de pantalla), resumen, número de jugadas y estado. El estado se ve por icono (círculo vacío, medio círculo, círculo con marca), borde (`--curso` grueso en `accent`, `--hecha` en `ink`) y palabra; nunca solo por color. El progreso son seis segmentos (`progreso__seg`): relleno = completada, borde grueso = abierta, borde fino = sin empezar, más el texto «2 de 6 lecciones completadas.».

`objetivo` es una frase imperativa («Da mate en una jugada.»). `pistas` acumula las pistas pedidas una a una (`ol` con `aria-live="polite"`); el botón dice «Pedir pista 2 de 3» y, al agotarlas, «No quedan más pistas» desactivado. La última pista marca casillas del tablero con las marcas de siempre.

`retro` es la única región `role="status"` de la pantalla. Acierto: borde continuo de 2 px, icono de marca y «Correcto.»; el tablero se bloquea y el foco pasa a «Siguiente lección». Fallo: `retro--fallo`, borde discontinuo, icono de cruz y el motivo en una frase completa; la jugada se deshace. Paso intermedio (lecciones de dos jugadas): «Bien. Sigue con el paso 2 de 2.» y la respuesta fija del rival en notación española.

**Textos.** Español de tú, sin exclamaciones y con punto final. Acciones: «Pedir pista», «Reiniciar lección», «Todas las lecciones», «Siguiente lección: <título>», «Repetir lección», «Jugar contra Alfil Beta». El progreso se guarda en este dispositivo y la pantalla lo dice.

**Disposición.** Lista: tarjetas en columnas de 340 px como mínimo (tres en escritorio, dos en tablet, una en móvil). Lección: título, objetivo, y debajo tablero a la izquierda y panel a la derecha (turno, retroalimentación, pistas, acciones) desde 860 px; en una columna por debajo, con la retroalimentación tras el tablero.
