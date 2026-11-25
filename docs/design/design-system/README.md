Escaque es una app web para aprender ajedrez con motor propio (Alfil Beta). Es un proyecto de portfolio: la interfaz debe sentirse precisa, sobria y legible, sin adornos. Todo se dibuja a mano con DOM, CSS y SVG, sin librerías de interfaz ni juegos de piezas de terceros.

## Fundamentos de contenido

- Escribe en español, en tono directo y de tú: «Juegan las blancas», «Corona el peón», «Girar tablero».
- Las jugadas se escriben en notación algebraica con las letras españolas de pieza: C (caballo), A (alfil), T (torre), D (dama), R (rey); el peón no lleva letra. Ejemplos: `e4`, `Cf3`, `Axe5+`, `O-O`, `e8=D`.
- Nombra las piezas con su género: «torre blanca», «peón negro», «dama negra».
- Cada casilla se anuncia como «e4, peón blanco» o «e4, vacía». Las coordenadas visibles son decorativas y no se leen.
- Sin emojis, sin signos de exclamación, sin mayúsculas de énfasis. Los estados terminan en punto: «Jaque mate. Ganan las blancas.»

## Fundamentos visuales

- **Color.** Página en `surface`; paneles en `surface-raised`; texto en `ink`, secundario en `ink-muted`. La única acción de color es `accent`, con `on-accent` encima. Los bordes de controles usan `control-border`; `line` solo separa paneles.
- **Tablero.** Dos tableros a elegir (CAL-397): Bosque, el de siempre, y Nogal (`data-tablero="nogal"`, valores en `boardThemes` de `tokens.json`). Casillas en `square-light` y `square-dark`, iguales en tema claro y oscuro. No se redondean ni llevan sombra. Las coordenadas van fuera, en la tipografía `coord` y `ink-muted`.
- **Piezas.** Estilo de volumen con degradado lateral (luz a la izquierda, sombra a la derecha) y contorno oscuro de 1 unidad sobre un viewBox de 45×45. Blancas: `piece-white-hi`, `piece-white-mid`, `piece-white-lo`, contorno `piece-outline-white`. Negras: `piece-black-hi`, `piece-black-mid`, `piece-black-lo`, contorno `piece-outline-black`.
- **Marcas.** El significado va en la forma y el color solo refuerza: seleccionada = relleno `mark-selected` más anillo `board-ink`; destino = punto `board-ink` con halo `board-halo`; captura = anillo `board-ink` con halo alrededor de la pieza; última jugada = relleno `mark-last-move` con borde (origen discontinuo, destino continuo); jaque = resplandor `mark-check` bajo el rey con anillo doble. El foco de teclado es un anillo sólido de 3 px en `board-ink` con un halo claro dentro. Las flechas del coach usan `arrow-best` y `arrow-yours` con borde blanco, iguales con la interfaz clara y oscura.
- **Tipografía.** Títulos en `display` (Space Grotesk), texto en `body` y `body-sm` (IBM Plex Sans), IBM Plex Mono (`notation`) solo para una jugada suelta (`Cxb5`, `14. Th2`), una coordenada (`e4`) o una cifra de evaluación (`+0,7`); las frases y los rótulos, también «Mate en 1», van en IBM Plex Sans. Las cuatro fuentes (Space Grotesk 600, Plex Sans 400 y 600, Plex Mono 500, subconjunto latino en woff2) están en `fonts/` y la app las sirve desde su propio dominio (`public/fonts/` del repositorio; licencia SIL OFL en `assets/Fuentes/OFL.txt` del Design System y en `public/fonts/OFL.txt`), con `font-display: swap` y sin CDN.
- **Espaciado y radios.** Escala `space-1` a `space-8`. Paneles y diálogo con `radius-md`; botones con `radius-sm`; el tablero con ángulos rectos.
- **Movimiento.** Ninguno por defecto. Si se anima una jugada, respeta `prefers-reduced-motion`. La única excepción decorativa es la celebración de un logro (ver «Identidad»).
- **Objetivos táctiles.** Botones de al menos 44 px de alto; las casillas del tablero miden al menos 38 px con una pantalla de 360 px de ancho.

## Accesibilidad

- Texto y coordenadas cumplen 4,5:1 en los dos temas; bordes de controles y marcas, 3:1.
- El tablero es una rejilla (`role="grid"`, filas y celdas) con una sola casilla en la secuencia de tabulación y flechas para moverse. El estado de la partida y las jugadas se anuncian en una región `role="status"`.
- Nada se distingue solo por color: la jugada actual lleva relleno y negrita, el jaque lleva texto, el foco lleva anillo.

## Iconografía

Escaque no usa iconos en la interfaz: los botones llevan solo texto. Las únicas imágenes son las doce piezas del grupo Piezas y el icono de la app del grupo Icono (un alfil blanco con una diagonal `accent` sobre fondo `board-ink`, más el símbolo suelto, el logotipo horizontal y el favicon). Además, desde la identidad visual (CAL-398), el rombo de la etiqueta «Jaque», el sello (el logo, con la diagonal en latón en los logros) y el escaque de los títulos, todos decorativos.

## App instalada

- La app se instala desde el navegador y funciona sin conexión. Al abrirla, el color de la barra del sistema y el de la pantalla de arranque son `surface` (claro `#f1f3f5`, oscuro `#0f1218`); la pantalla de arranque es solo el icono centrado.
- Los avisos de instalar, sin conexión y versión nueva usan el componente `Notice`. Un aviso a la vez, con texto en español que termina en punto.
- Puntos de corte: móvil por debajo de 600 px (una columna: estado, tablero, botones y jugadas); tablet vertical de 600 a 859 px (una columna, tablero hasta 700 px, botones en fila y jugadas debajo); desde 860 px, dos columnas con el tablero a la izquierda. En un móvil apaisado (alto menor de 500 px) el tablero se limita por el alto y el panel pasa a la derecha. Los márgenes respetan las áreas seguras del dispositivo.

## Jugar contra la máquina

- La pantalla de inicio y «Nueva partida» llevan a los ajustes (`GameSetup`): modo, nivel (Fácil, Medio, Difícil) y color (blancas, negras o al azar). Contra la máquina, nivel Medio y blancas vienen preseleccionados.
- Los grupos son `fieldset` con botones de radio reales. La opción elegida se ve por la forma (borde de 3 px y círculo relleno) además del color `accent`.
- Mientras la máquina piensa, `GameStatus` añade «Alfil Beta está pensando.» y una barra indeterminada. El tablero no admite jugadas y Deshacer y Rehacer se desactivan.
- Al terminar, `GameResult` sustituye al estado: «Has ganado.», «Has perdido.» o «Tablas.», con la causa y una sola acción principal, «Revancha».
- Los textos siguen las mismas reglas: español de tú, sin exclamaciones y con punto final.

## Coach

- `Coach` explica la última jugada: «¿por qué fue mala?». Va en la columna derecha entre `GameStatus` y `MoveList` (móvil: justo debajo del tablero; tablet vertical: debajo del tablero, en dos columnas).
- Lleva veredicto («Error grave.», «Imprecisión.», «Buena jugada.»), mejor jugada, caída de la evaluación en peones (barras de antes y después) y avisos: pieza colgando, mate en 1 que se escapó y captura gratis no vista.
- La gravedad no depende del color: icono (triángulo, círculo discontinuo, círculo con marca), borde y palabra. Solo el veredicto es `role="status"`; el coach nunca roba el foco. «Ver en el tablero» activa marcas de casilla de siempre y pasa a «Quitar del tablero».
- Habla de «las blancas» y «las negras», para servir también en dos jugadores.

## Lecciones guiadas

- `Lessons` agrupa la lista de lecciones (tarjetas con estado), el progreso (seis segmentos), el objetivo, las pistas y la retroalimentación. Las lecciones son entre 5 y 6, de orden libre; el progreso se guarda en este dispositivo.
- El estado de una lección (sin empezar, en curso, completada) y el resultado de una jugada (acierto, fallo) se distinguen por icono, borde y palabra, nunca solo por color. La retroalimentación es la única región `role="status"`; tras acertar, el foco pasa a «Siguiente lección».
- La cabecera de la web lleva la navegación principal («Jugar» y «Lecciones») con `aria-current="page"` en la actual. La navegación va siempre a la derecha, en el mismo sitio en todas las pantallas; el subtítulo de la partida (modo y nivel) va en su propia línea debajo del nombre (CAL-404). En móvil apaisado el nivel va en el estado.
- Los textos de cada lección (objetivo, pistas, explicación y motivos de fallo) vienen de los datos de la lección: frases completas, de tú y con punto final.

## Identidad

- **Tinta de marca.** Los títulos van en `marca`, el azul petróleo del fondo del logo, con el interletraje algo cerrado. `accent` sigue siendo solo para acciones.
- **El escaque.** Un cuadrado de 10 px partido en diagonal en `marca` (la casilla que cruza la diagonal del alfil del logo) va delante de los títulos de panel: Coach, Jugadas, Pistas, Capturas, las secciones del repaso y «Resumen por bando» (el título de su tabla, CAL-404). Sin ninguna captura, el panel Capturas se pliega a una línea: «Capturas · Ninguna todavía». La muestra de turno es un escaque de 18 px del color que juega.
- **Jaque.** El estado lleva borde de 2 px en `peligro`, fondo `peligro-suave` y la etiqueta «Jaque» con un rombo. Si te toca, el texto dice qué hacer: «Juegan las blancas: sal del jaque.». «Te toca» va en una etiqueta `accent` aparte, solo contra la máquina.
- **Fin de partida.** En dos jugadores, «Jaque mate.» o «Tablas.» en `title` con la causa debajo. Contra la máquina, `GameResult` lleva un antetítulo (Victoria, Derrota o Empate) y el sello.
- **Sello y logro.** El sello es el logo; al ganar o superar una lección su diagonal pasa a `logro-vivo` (latón), con borde `logro`, antetítulo en `logro` y fondo con degradado desde `logro-suave`. El latón se reserva para logros.
- **Celebración.** Una sola vez al ganar o al superar una lección o un bloque: diez escaques salen del sello en 700 ms y se desvanecen. Con «reducir movimiento» no hay confeti, solo un fundido del sello de 120 ms. No se anuncia al lector de pantalla y no se repite al volver a abrir una partida terminada.
- **Estados vacíos.** Un trozo de tablero de 3×3 casi en blanco y dos frases: qué falta y qué va a pasar («Todavía no hay jugadas.» / «Mueve una pieza: cada jugada se apunta aquí…»).
- **Colores forzados.** Escaque, bordes y etiquetas pasan a `CanvasText`; el sello conserva sus colores.

## Firma de la creadora

- **Escaque es la marca del producto; Calvario TechLabs, la creadora.** La firma es solo tipografía, sin logotipo de la creadora: «by» en Plex Sans 400 y «Calvario TechLabs» en Plex Sans 600, 14 px, `ink-muted`. Va en tres sitios y siempre en segundo plano.
- **Cabecera.** Junto a «Escaque», con un separador fino de `line`, solo desde 720 px de ancho y 500 px de alto (`.cab-izq` y `.firma`). Es texto, no un enlace. En móvil y móvil apaisado no se muestra: no hay sitio.
- **Pie** (`Firma`, `.pie`). Un `footer` con nombre «Información» al final de cada pantalla: «Escaque by Calvario TechLabs» (el nombre enlaza a https://calvariotechlabs.com/ en una pestaña nueva, con `rel="noopener noreferrer"` y el aviso oculto «(se abre en una pestaña nueva)»), «Acerca de Escaque» y «© 2026 Calvario TechLabs». Los enlaces miden 44 px de alto, van subrayados y el foco es un anillo de 3 px en `accent`. En móvil va en dos líneas y deja margen bajo la barra «Empezar partida»; en móvil apaisado va al final de la región con scroll del panel.
- **Acerca de** (`.acerca`, `.firma-tarjeta`). Pantalla `#/acerca` a la que se llega desde el pie: título, qué es Escaque, tarjeta con la firma grande y el botón «Conocer Calvario TechLabs», «Cómo está hecho», «Código y licencia» y «Volver a jugar». Dos columnas desde 720 px de ancho; una en móvil.
- **«by»** lleva `lang="en"`. Sin anuncios, sin recursos de terceros y sin animación.

## Cómo usar este sistema

Carga `components/bundle.css` tras los tokens y reproduce el marcado de cada componente tal como aparece en su vista previa. Las siluetas de las piezas están en `components/pieces.js` y como SVG sueltos en `assets/Piezas/`.
