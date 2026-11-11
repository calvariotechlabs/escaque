Escaque es una app web para aprender ajedrez con motor propio (Alfil Beta). Es un proyecto de portfolio: la interfaz debe sentirse precisa, sobria y legible, sin adornos. Todo se dibuja a mano con DOM, CSS y SVG, sin librerías de interfaz ni juegos de piezas de terceros.

## Fundamentos de contenido

- Escribe en español, en tono directo y de tú: «Juegan las blancas», «Corona el peón», «Girar tablero».
- Las jugadas se escriben en notación algebraica con las letras españolas de pieza: C (caballo), A (alfil), T (torre), D (dama), R (rey); el peón no lleva letra. Ejemplos: `e4`, `Cf3`, `Axe5+`, `O-O`, `e8=D`.
- Nombra las piezas con su género: «torre blanca», «peón negro», «dama negra».
- Cada casilla se anuncia como «e4, peón blanco» o «e4, vacía». Las coordenadas visibles son decorativas y no se leen.
- Sin emojis, sin signos de exclamación, sin mayúsculas de énfasis. Los estados terminan en punto: «Jaque mate. Ganan las blancas.»

## Fundamentos visuales

- **Color.** Página en `surface`; paneles en `surface-raised`; texto en `ink`, secundario en `ink-muted`. La única acción de color es `accent`, con `on-accent` encima. Los bordes de controles usan `control-border`; `line` solo separa paneles.
- **Tablero.** Casillas en `square-light` y `square-dark`, iguales en tema claro y oscuro. No se redondean ni llevan sombra. Las coordenadas van fuera, en la tipografía `coord` y `ink-muted`.
- **Piezas.** Estilo de volumen con degradado lateral (luz a la izquierda, sombra a la derecha) y contorno oscuro de 1 unidad sobre un viewBox de 45×45. Blancas: `piece-white-hi`, `piece-white-mid`, `piece-white-lo`, contorno `piece-outline-white`. Negras: `piece-black-hi`, `piece-black-mid`, `piece-black-lo`, contorno `piece-outline-black`.
- **Marcas.** El significado va en la forma y el color solo refuerza: seleccionada = relleno `mark-selected` más anillo `board-ink`; destino = punto `board-ink`; captura = anillo `board-ink` alrededor de la pieza; última jugada = relleno `mark-last-move`; jaque = resplandor `mark-check` bajo el rey. El foco de teclado es un anillo sólido de 3 px en `board-ink`, dentro de la casilla.
- **Tipografía.** Títulos en `display` (Space Grotesk), texto en `body` y `body-sm` (IBM Plex Sans), jugadas en `notation` (IBM Plex Mono).
- **Espaciado y radios.** Escala `space-1` a `space-8`. Paneles y diálogo con `radius-md`; botones con `radius-sm`; el tablero con ángulos rectos.
- **Movimiento.** Ninguno por defecto. Si se anima una jugada, respeta `prefers-reduced-motion`.
- **Objetivos táctiles.** Botones de al menos 44 px de alto; las casillas del tablero miden al menos 38 px con una pantalla de 360 px de ancho.

## Accesibilidad

- Texto y coordenadas cumplen 4,5:1 en los dos temas; bordes de controles y marcas, 3:1.
- El tablero es una rejilla (`role="grid"`, filas y celdas) con una sola casilla en la secuencia de tabulación y flechas para moverse. El estado de la partida y las jugadas se anuncian en una región `role="status"`.
- Nada se distingue solo por color: la jugada actual lleva relleno y negrita, el jaque lleva texto, el foco lleva anillo.

## Iconografía

Escaque no usa iconos en la interfaz: los botones llevan solo texto. Las únicas imágenes son las doce piezas del grupo Piezas y el icono de la app del grupo Icono (un alfil blanco con una diagonal `accent` sobre fondo `board-ink`, más el símbolo suelto, el logotipo horizontal y el favicon).

## App instalada

- La app se instala desde el navegador y funciona sin conexión. Al abrirla, el color de la barra del sistema y el de la pantalla de arranque son `surface` (claro `#f1f3f5`, oscuro `#0f1218`); la pantalla de arranque es solo el icono centrado.
- Los avisos de instalar, sin conexión y versión nueva usan el componente `Notice`. Un aviso a la vez, con texto en español que termina en punto.
- Puntos de corte: móvil por debajo de 600 px (una columna: estado, tablero, botones y jugadas); tablet vertical de 600 a 859 px (una columna, tablero hasta 700 px, botones en fila y jugadas debajo); desde 860 px, dos columnas con el tablero a la izquierda. En un móvil apaisado (alto menor de 500 px) el tablero se limita por el alto y el panel pasa a la derecha. Los márgenes respetan las áreas seguras del dispositivo.

## Cómo usar este sistema

Carga `components/bundle.css` tras los tokens y reproduce el marcado de cada componente tal como aparece en su vista previa. Las siluetas de las piezas están en `components/pieces.js` y como SVG sueltos en `assets/Piezas/`.
