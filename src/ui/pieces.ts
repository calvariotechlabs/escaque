// Piezas de ajedrez en SVG, dibujadas a mano para Escaque (diseño propio: no se
// copia ningún juego de piezas existente). Estilo «volumen con degradado»:
// cada pieza lleva un degradado lateral que le da relieve y un contorno oscuro.
//
// Todas las piezas comparten viewBox 0 0 45 45 y una misma peana, así que
// quedan alineadas sobre la casilla. No usan atributos `style` ni scripts: el
// color sale de degradados definidos una vez por documento (`pieceDefsSvg`) y
// de clases CSS (`board.css`), compatible con una CSP estricta.
import type { Color, PieceType } from "../core/index.js";

/** Identificadores de los degradados; deben existir en el documento (ver `pieceDefsSvg`). */
export const GRADIENT_ID: Readonly<Record<Color, string>> = {
  w: "escaque-grad-blancas",
  b: "escaque-grad-negras",
};

/** Peana común a todas las piezas. */
const BASE = `<path d="M10.5 40.5v-2.3c0-1.3 1-2.2 2.2-2.2h19.6c1.2 0 2.2.9 2.2 2.2v2.3z"/>`;

/** Trazos del cuerpo de cada pieza, de atrás hacia delante. */
const BODY: Readonly<Record<PieceType, string>> = {
  p:
    `<path d="M18.700 21.500C18.700 26.500 16.500 30.500 14 36h17c-2.500-5.500-4.700-9.500-4.700-14.500z"/>` +
    `<path d="M16.200 19.700c0-1.100.9-2 2-2h8.600c1.100 0 2 .9 2 2s-.9 2-2 2h-8.600c-1.100 0-2-.9-2-2z"/>` +
    `<circle cx="22.500" cy="12.300" r="5"/>`,
  r:
    `<path d="M17.300 19.500L16.300 33.500h12.400l-1-14z"/>` +
    `<path d="M14.500 33.300h16l1.800 2.700H12.700z"/>` +
    `<path d="M13.500 8h4.100v3.100h2.800V8h4.200v3.100h2.800V8h4.100v8.800l-3 2.700h-12z"/>`,
  n:
    `<path d="M13.500 36c.4-7 2.200-11.500 6.800-14.700-2.500.4-4.700 1.900-6.600 4.100-1-1.300-.9-2.900.3-4.300l5.500-7.700-.4-4.600 3.700 2.500c1-1.300 2-2.200 3.200-2.800l.5 3.100c5.500 1.800 9.200 8 9.200 15.500 0 3-.3 5.800-.8 8.100z"/>` +
    `<circle class="ojo" cx="19.700" cy="14.800" r="1.200"/>`,
  b:
    `<path d="M18.500 26.500c0 4-1.500 6.700-4.200 9.500h16.400c-2.700-2.800-4.200-5.500-4.200-9.500z"/>` +
    `<path d="M16.200 23.300h12.600v3.200H16.200z"/>` +
    `<path d="M22.500 6c4.700 3.300 7.500 7.200 7.500 11 0 2.500-1.500 4.500-3.300 6.300h-8.400C16.500 21.500 15 19.500 15 17c0-3.800 2.800-7.700 7.500-11z"/>` +
    `<circle cx="22.500" cy="5" r="2"/>` +
    `<path class="marca" d="M25 10.500l-4.500 7M20 28.500h5"/>`,
  q:
    `<path d="M12 14.500l5.200 14.200 1.800-13.700 3.500 13.200 3.500-13.200 1.800 13.700L33 14.500l-1.800 19H13.800z"/>` +
    `<path d="M14 33h17l1.200 3H12.800z"/>` +
    `<circle cx="12" cy="12.500" r="2"/><circle cx="17.800" cy="9.500" r="2"/><circle cx="22.500" cy="8" r="2.200"/>` +
    `<circle cx="27.200" cy="9.500" r="2"/><circle cx="33" cy="12.500" r="2"/>`,
  k:
    `<path d="M22.500 14.500c-6.300 0-10.500 3.700-10.500 9 0 3.200 1.500 5.200 3 6.800L14 36h17l-1-5.700c1.500-1.600 3-3.600 3-6.800 0-5.300-4.200-9-10.500-9z"/>` +
    `<path d="M13.200 33.200h18.600l1 2.800H12.200z"/>` +
    `<path d="M21 3.500h3v3.500h3.500v3H24v3.500h-3V10h-3.500V7H21z"/>`,
};

const NAMES: Readonly<Record<PieceType, { name: string; feminine: boolean }>> = {
  p: { name: "peón", feminine: false },
  n: { name: "caballo", feminine: false },
  b: { name: "alfil", feminine: false },
  r: { name: "torre", feminine: true },
  q: { name: "dama", feminine: true },
  k: { name: "rey", feminine: false },
};

/** Nombre en español con el género correcto: «torre negra», «peón blanco». */
export function pieceName(color: Color, type: PieceType): string {
  const { name, feminine } = NAMES[type];
  const adjective = color === "w" ? "blanc" : "negr";
  return `${name} ${adjective}${feminine ? "a" : "o"}`;
}

/** Piezas en el orden en que se muestran: las seis de cada bando. */
export const PIECE_TYPES: readonly PieceType[] = ["k", "q", "r", "b", "n", "p"];

/**
 * Marcado SVG de una pieza (decorativo: el nombre accesible lo da la casilla
 * que la contiene). Necesita `pieceDefsSvg()` presente en el documento.
 */
export function pieceMarkup(color: Color, type: PieceType): string {
  return (
    `<svg class="pieza pieza--${color}" viewBox="0 0 45 45" aria-hidden="true" focusable="false">` +
    `<g fill="url(#${GRADIENT_ID[color]})">${BASE}${BODY[type]}</g></svg>`
  );
}

/**
 * SVG oculto con los degradados de las piezas; se inserta una vez por documento.
 * Las paradas leen los tokens `piece-*` mediante las clases `gw-*` y `gb-*` de
 * `board.css`, así que no llevan colores ni atributos `style` (CSP estricta).
 */
export function pieceDefsSvg(): string {
  return (
    `<svg id="escaque-defs" width="0" height="0" focusable="false" aria-hidden="true" class="oculto"><defs>` +
    `<linearGradient id="${GRADIENT_ID.w}" x1="0" x2="1" y1="0" y2="0">` +
    `<stop class="gw-0" offset="0"/><stop class="gw-1" offset=".55"/><stop class="gw-2" offset="1"/></linearGradient>` +
    `<linearGradient id="${GRADIENT_ID.b}" x1="0" x2="1" y1="0" y2="0">` +
    `<stop class="gb-0" offset="0"/><stop class="gb-1" offset=".5"/><stop class="gb-2" offset="1"/></linearGradient>` +
    `</defs></svg>`
  );
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** Inserta los degradados en el documento si aún no están. */
export function installPieceDefs(doc: Document = document): void {
  if (doc.getElementById("escaque-defs")) return;
  const holder = doc.createElement("div");
  holder.innerHTML = pieceDefsSvg();
  const defs = holder.firstElementChild;
  if (defs) doc.body.prepend(defs);
}

/** Elemento SVG de una pieza, listo para insertar (p. ej. al arrastrar). */
export function pieceSvg(color: Color, type: PieceType, doc: Document = document): SVGSVGElement {
  installPieceDefs(doc);
  const holder = doc.createElementNS(SVG_NS, "svg");
  holder.innerHTML = pieceMarkup(color, type);
  return holder.firstElementChild as SVGSVGElement;
}
