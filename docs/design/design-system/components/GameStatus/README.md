Línea de estado de la partida: de quién es el turno, si hay jaque y cómo termina.

**Textos.** «Juegan las blancas.», «Juegan las negras. Jaque.», «Jaque mate. Ganan las blancas.», «Tablas por ahogado.», «Tablas por material insuficiente.», «Tablas por la regla de los 50 movimientos.», «Tablas por triple repetición.» La región es `role="status"` para que el cambio se anuncie.

**Reglas.** Al terminar la partida, el panel pasa a borde de 2 px en `ink`. El círculo de turno es decorativo (`aria-hidden`).

**Contra la máquina.** Cuando le toca a la máquina, el panel lleva la clase `estado--pensando`: añade «Alfil Beta está pensando.» tras el turno («Juegan las negras. Alfil Beta está pensando.») y una barra indeterminada `.pensando__barra` (decorativa, `aria-hidden`) en una segunda línea. Con `prefers-reduced-motion` la barra no se mueve. Al llegar su jugada se anuncia «Alfil Beta juega Cf6. Juegan las blancas.» y, cuando le toca al jugador, «Juegan las blancas. Te toca.». Al terminar, el panel lo sustituye GameResult.
