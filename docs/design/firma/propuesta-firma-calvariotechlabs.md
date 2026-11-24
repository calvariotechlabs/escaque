# Firma «by CalvarioTechLabs» en Escaque (B5) · propuesta de diseño

Issue: https://github.com/calvariotechlabs/escaque/issues/65
Lienzo (versión 56, privado): https://claude.ai/artifact/EFBEpxb6n1xjdX35LYqNcG — en las tres páginas, al final de cada una (título «Firma «by CalvarioTechLabs» (B5)»).

## 1. Qué se propone

| Pieza | Dónde | Detalle |
| --- | --- | --- |
| Firma | Cabecera de tablet y escritorio (desde 720 px de ancho y 500 px de alto) | «by CalvarioTechLabs» a la derecha de «Escaque», con un separador fino. Texto en `ink-muted`, 14 px, «by» en 400 y el nombre en 600. No es un enlace. |
| Pie | Todas las pantallas | «Escaque by CalvarioTechLabs» (el nombre enlaza a https://calvariotechlabs.com/, pestaña nueva), «Acerca de Escaque» y «© 2026 CalvarioTechLabs». En móvil, dos líneas. En móvil apaisado va al final de la región con scroll del panel. |
| Acerca de | Ruta nueva `#/acerca`, se llega desde el pie | Título, qué es Escaque, tarjeta con la firma grande y el botón «Conocer CalvarioTechLabs», «Cómo está hecho», «Código y licencia» y «Volver a jugar». |

Escaque sigue siendo la marca del producto. No hay logotipo de la creadora, ni anuncios, ni nada junto al tablero.

Láminas: `FirmaMarca` (reglas, contraste, textos), `FirmaPartida*` (escritorio claro y oscuro, tablet, móvil, móvil apaisado), `FirmaInicioMovil` (pie con la barra «Empezar partida») y `Acerca*` (escritorio claro y oscuro, tablet, móvil, móvil apaisado).

## 2. Metadatos propuestos (para B7)

En `index.html`:

```html
<meta name="description" content="Aprende ajedrez con un motor propio. Funciona sin conexión. Un proyecto de CalvarioTechLabs.">
<meta name="author" content="CalvarioTechLabs">
<link rel="author" href="https://calvariotechlabs.com/">
<meta name="application-name" content="Escaque">
<meta property="og:description" content="Aprende ajedrez con un motor propio. Funciona sin conexión. Un proyecto de CalvarioTechLabs.">
<meta name="twitter:description" content="Aprende ajedrez con un motor propio. Funciona sin conexión. Un proyecto de CalvarioTechLabs.">
```

Se mantienen `<title>` («Escaque · ajedrez contra la máquina o a dos»), `og:site_name` («Escaque»), `og:title` y la imagen. En la pantalla «Acerca de», el título del documento sería «Acerca de Escaque · CalvarioTechLabs».

JSON-LD (un solo bloque en `index.html`):

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Escaque",
  "url": "https://escaque.calvariotechlabs.com/",
  "description": "Aprende ajedrez con un motor propio. Funciona sin conexión.",
  "applicationCategory": "GameApplication",
  "operatingSystem": "Any",
  "inLanguage": "es",
  "isAccessibleForFree": true,
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "EUR" },
  "license": "https://opensource.org/licenses/MIT",
  "image": "https://escaque.calvariotechlabs.com/og-image.png",
  "copyrightYear": 2026,
  "sameAs": ["https://github.com/calvariotechlabs/escaque"],
  "creator": { "@type": "Organization", "name": "CalvarioTechLabs", "url": "https://calvariotechlabs.com/" },
  "copyrightHolder": { "@type": "Organization", "name": "CalvarioTechLabs", "url": "https://calvariotechlabs.com/" }
}
</script>
```

Notas para B7 y B6:
- Un bloque `application/ld+json` es un dato, no se ejecuta, así que la CSP (`script-src`) no lo bloquea. B6 debe comprobarlo igualmente con la cabecera real.
- No se pone `twitter:site` ni `twitter:creator`: no hay cuenta conocida.
- Opcional, no dibujado: añadir «by CalvarioTechLabs» a la imagen `og-image` (bajo el título). Dime si lo quieres.

## 3. Revisión (crítica de diseño, accesibilidad, textos)

Crítica de diseño: la firma se lee en segundo plano (tono secundario, 14 px) y no compite con «Escaque» (32 px, tinta de marca) ni con el tablero. El separador fino une la firma al nombre sin añadir un logotipo. Riesgo menor: en 720 a 760 px la cabecera va justa (firma + navegación); por eso la regla de ocultar la firma por debajo de 720 px.

Accesibilidad (WCAG 2.1 AA, valores en la lámina `FirmaMarca`): `ink-muted` 5,7:1 en claro y 7,2:1 en oscuro sobre `surface`; enlaces del pie 15,7:1 y 14,4:1; foco `accent` 3 px (5,2:1 y 9,2:1). Enlaces con 44 px de alto, subrayados, con `aria-current` en «Acerca de». «by» lleva `lang="en"`. Enlace externo con aviso «(se abre en una pestaña nueva)», como el de GitHub. Pie como `footer` con nombre «Información». Colores forzados cubiertos. Pendiente de humano: probar con lector de pantalla y en dispositivo real (se sumará a la lista de B6).

Textos: tuteo y frases cortas como el resto de la interfaz. Las afirmaciones de «Acerca de» (sin cuentas, sin analítica, sin cookies de seguimiento, funciona sin conexión, licencia MIT) coinciden con el README y la LICENSE; B6 las comprobará contra el producto desplegado.

## 4. Preguntas abiertas

1. Nombre legal: la LICENSE dice «Calvario TechLabs» y el encargo dice «CalvarioTechLabs». El diseño usa «CalvarioTechLabs» en todo. ¿Se queda así, incluido el © del pie?
2. ¿Quieres la firma también en la imagen de vista previa (og-image)?
