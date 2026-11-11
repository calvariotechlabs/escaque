Resultado de una partida contra la máquina. Sustituye al estado de la partida cuando termina y ofrece la revancha.

**Textos.** Título: «Has ganado.», «Has perdido.» o «Tablas.». Texto: la causa en la misma forma que GameStatus: «Jaque mate. Ganan las blancas.», «Jaque mate. Ganan las negras.», «Tablas por ahogado.», «Tablas por material insuficiente.», «Tablas por la regla de los 50 movimientos.», «Tablas por triple repetición.» Sin signos de exclamación ni emojis.

**Reglas.** Es una región `role="status"` con `aria-labelledby` al título, para que el resultado se anuncie al terminar. Borde de 2 px en `ink`, como el estado final. El resultado nunca se distingue solo por color. Tiene una sola acción, «Revancha» (principal), que repite el mismo nivel y el mismo color. «Nueva partida» sigue en los botones de la partida, sin estilo principal mientras haya resultado, y no pide confirmación porque la partida ya ha terminado. «Deshacer jugada» sigue disponible y deshace la jugada de la máquina y la tuya.

**Posición.** Móvil y tablet vertical: encima del tablero, en el lugar del estado. Desde 860 px: en la columna lateral, encima de las jugadas.
