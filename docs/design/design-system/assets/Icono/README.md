Pack de identidad de Escaque: un único símbolo, un alfil blanco con una diagonal en `accent`, sobre `board-ink`. Vectores reales, sin imágenes incrustadas; el nombre va convertido a trazados (Inter Display seminegrita).

- `icono.svg`: icono de 1024×1024 con esquinas redondeadas. Para la pestaña, el escritorio y `apple-touch-icon`.
- `icono-maskable.svg`: versión a sangre y sin esquinas, con el símbolo al 90 % para que quepa en el círculo seguro del 80 % de Android con cualquier máscara.
- `simbolo.svg`: el alfil solo, en color, sobre transparente.
- `logo-horizontal-claro.svg` y `logo-horizontal-oscuro.svg`: símbolo y nombre, para fondo claro y oscuro.
- `favicon.svg`: símbolo simplificado, legible a 16 px.

En el repositorio se generan de ellos los PNG de 192, 512 y 180 px que necesita el manifiesto. La pantalla de arranque es el icono centrado sobre `surface` (claro `#f1f3f5`, oscuro `#0f1218`), sin más elementos.
