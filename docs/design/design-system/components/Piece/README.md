Las doce piezas de Escaque (rey, dama, torre, alfil, caballo y peón, en blancas y negras), dibujadas a mano en SVG.

**Quién lo aporta.** El contenedor es una casilla con tamaño propio; la pieza llena el 100 % de ancho y alto. Los degradados `escaque-grad-w` y `escaque-grad-b` deben existir una vez por documento (`EscaquePieces.defs()`).

**Cómo usarlas.** Marca la pieza como decorativa (`aria-hidden="true"`): el nombre accesible lo da la casilla. No cambies colores a mano: están en los tokens `piece-*`. Mínimo recomendado, 32 px de lado.

**No hagas.** No uses símbolos Unicode ni otro juego de piezas, no recolorees las negras con tonos del tablero y no añadas sombras exteriores.
