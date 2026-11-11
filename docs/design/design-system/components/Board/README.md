El tablero 8×8 con coordenadas fuera de las casillas, visto desde las blancas o desde las negras.

**Quién lo aporta.** Una FEN (solo la colocación de piezas) y la orientación. El tablero ocupa el ancho disponible hasta 640 px y siempre es cuadrado.

**Marcado.** Raíz `.tablero`; rejilla `role="grid"` con una `role="row"` por fila y una `role="gridcell"` por casilla (`data-square="e4"`, `aria-label="e4, peón blanco"`). Rangos y columnas llevan `aria-hidden="true"`. Al girar el tablero, las coordenadas se invierten con él.

**No hagas.** No metas las coordenadas dentro de las casillas, no redondees el tablero y no pongas sombra a las casillas.
