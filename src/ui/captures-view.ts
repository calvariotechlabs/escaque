// Panel «Capturas» en el DOM: pinta `capturesMarkup` y, en móvil apaisado, lo cambia de sitio.
import type { Color } from "../core/index.js";
import { captureSummary, capturesMarkup } from "./captures.js";
import type { PlayedMove } from "./notation.js";
import { COMPACT_LANDSCAPE, onCompactLandscapeChange } from "./scroll-region.js";

export interface CapturesView {
  /** Pinta las capturas de estas jugadas; `bottom` es el bando que está abajo en el tablero. */
  render(moves: readonly PlayedMove[], bottom: Color): void;
}

/** Texto fijo y marcado propio (nunca datos del usuario): se puede escribir con `innerHTML`. */
export function createCapturesView(content: HTMLElement): CapturesView {
  let last = "";
  return {
    render(moves, bottom) {
      const html = capturesMarkup(captureSummary(moves), bottom);
      if (html === last) return; // el texto del lector de pantalla no se vuelve a escribir si no cambia
      last = html;
      content.innerHTML = html;
    },
  };
}

/** En móvil apaisado no hay hueco bajo el tablero: el panel pasa al principio de la región con scroll. */
export function placeCapturesInLandscape(section: HTMLElement, home: HTMLElement, landscapeAfter: () => void): void {
  const place = (compact: boolean): void => {
    if (compact) landscapeAfter();
    else home.append(section);
  };
  place(window.matchMedia(COMPACT_LANDSCAPE).matches);
  onCompactLandscapeChange(place);
}
