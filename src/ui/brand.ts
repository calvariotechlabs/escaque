// Piezas de marca de la interfaz (CAL-398): el sello del resultado, la celebración y los estados vacíos.
// Diseño: «Identidad visual (CAL-398)» del lienzo. Estilos en src/ui/identidad.css. Sin estilos en línea (CSP).
import { CONFETTI_COUNT, type ResultKind } from "./identity.js";

const SVG_NS = "http://www.w3.org/2000/svg";

// Silueta del alfil del logo y el recorte de su cabeza (los mismos trazos que favicon.svg).
const BISHOP = "M32 5 L43 17 C49 24 50 29 47 35 C45 39 41 41 39 42 V45 L47 45 L53 57 H11 L17 45 H25 V42 C20 40 17 37 16 32 C14 25 18 20 22 16 Z";
const HEAD = "M32 5 L43 17 C49 24 50 29 47 35 C45 39 41 41 39 42 H25 C20 40 17 37 16 32 C14 25 18 20 22 16 Z";
const DIAGONAL = "M17 18 L21 14 L49 41 L44 46 Z";

let clipCount = 0;

function svgNode<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Readonly<Record<string, string>>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
}

/** Variante del sello: el logo con la diagonal en latón (logro), el logo tal cual (neutro) o un escaque partido (tablas). */
export type SealKind = "logro" | "neutro" | "tablas";

export function sealKindFor(result: ResultKind): SealKind {
  return result === "gana" ? "logro" : result === "pierde" ? "neutro" : "tablas";
}

/** SVG del sello, decorativo. Los colores van en clases (identidad.css). */
export function sealSvg(kind: SealKind): SVGSVGElement {
  const svg = svgNode("svg", { viewBox: "0 0 64 64", "aria-hidden": "true", focusable: "false" });
  svg.append(svgNode("rect", { width: "64", height: "64", rx: "12", class: "sello__fondo" }));
  if (kind === "tablas") {
    svg.append(svgNode("path", { d: "M14 14 H50 V50 H14 Z", class: "sello__marco" }), svgNode("path", { d: "M14 14 H50 L14 50 Z", class: "sello__pieza" }));
    return svg;
  }
  const id = `sello-recorte-${++clipCount}`;
  const clip = svgNode("clipPath", { id });
  clip.append(svgNode("path", { d: HEAD }));
  const defs = svgNode("defs", {});
  defs.append(clip);
  svg.append(
    defs,
    svgNode("path", { d: BISHOP, class: "sello__pieza" }),
    svgNode("path", { d: DIAGONAL, "clip-path": `url(#${id})`, class: kind === "logro" ? "sello__diagonal sello__diagonal--logro" : "sello__diagonal" }),
  );
  return svg;
}

/** Pone en `host` (un `.sello`) el sello de `kind`, sin celebración. */
export function setSeal(host: HTMLElement, kind: SealKind): void {
  host.replaceChildren(sealSvg(kind));
  host.classList.remove("sello--aparece");
}

/**
 * Celebración discreta: diez escaques salen del sello una vez (700 ms). Con «reducir movimiento»
 * no hay confeti: el sello aparece con un fundido corto. No anuncia nada al lector de pantalla.
 */
export function celebrate(host: HTMLElement, reducedMotion: boolean): void {
  host.querySelectorAll(".sello__confeti").forEach((node) => node.remove());
  host.classList.remove("sello--aparece");
  if (reducedMotion) {
    void host.offsetWidth; // reinicia la animación del fundido
    host.classList.add("sello--aparece");
    return;
  }
  const pieces: HTMLSpanElement[] = [];
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const piece = document.createElement("span");
    piece.className = "sello__confeti";
    piece.setAttribute("aria-hidden", "true");
    pieces.push(piece);
  }
  host.append(...pieces);
  // Se quitan al acabar; el temporizador cubre el caso de que la animación no llegue a correr.
  const clear = (): void => pieces.forEach((piece) => piece.remove());
  pieces[pieces.length - 1]!.addEventListener("animationend", clear, { once: true });
  window.setTimeout(clear, 1200);
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Estado vacío: un trozo de tablero de 3x3 (decorativo) con un título y una frase que dice qué va a pasar. */
export function emptyState(title: string, text: string, className = ""): HTMLElement {
  const box = document.createElement("div");
  box.className = className === "" ? "vacio" : `vacio ${className}`;
  box.append(miniBoard(), emptyText(title, text));
  return box;
}

function miniBoard(): HTMLElement {
  const mini = document.createElement("span");
  mini.className = "vacio__mini";
  mini.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 9; i++) mini.append(document.createElement("span"));
  return mini;
}

function emptyText(title: string, text: string): HTMLElement {
  const wrap = document.createElement("span");
  wrap.className = "vacio__txt";
  const t = document.createElement("span");
  t.className = "vacio__titulo";
  t.textContent = title;
  const p = document.createElement("span");
  p.className = "vacio__texto";
  p.textContent = ` ${text}`;
  wrap.append(t, p);
  return wrap;
}
