Marcas que se superponen a una casilla: seleccionada, destino, captura, última jugada, jaque y foco de teclado.

**Cómo se aplican.** Con el atributo `data-marks` en la casilla, con uno o varios valores separados por espacio (`selected target`). El foco usa `:focus-visible` sobre la casilla.

**Reglas.** La forma distingue cada marca (relleno con anillo, punto, anillo, tinte, resplandor); el color nunca es la única pista. Las marcas van bajo la pieza (`z-index` 1) salvo punto y anillo, que van sobre ella. Un anillo de foco nunca se recorta: no pongas `overflow: hidden` en la rejilla.
