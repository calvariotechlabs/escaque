// Móvil apaisado: el panel de la derecha tiene scroll propio. Para que se pueda usar con teclado y
// con lector de pantalla, solo en ese caso se convierte en una región con nombre que recibe el foco.

/** Mismo criterio que las reglas de maquetación de page.css y lecciones.css. */
export const COMPACT_LANDSCAPE = "(orientation: landscape) and (max-height: 500px)";

/** Llama a `listener` al entrar o salir del móvil apaisado. */
export function onCompactLandscapeChange(listener: (matches: boolean) => void): void {
  const query = window.matchMedia(COMPACT_LANDSCAPE);
  query.addEventListener("change", (event) => listener(event.matches));
}

/** Región con scroll: con rol, nombre y foco de teclado solo en móvil apaisado. */
export function bindScrollRegion(element: HTMLElement, label: string): void {
  const query = window.matchMedia(COMPACT_LANDSCAPE);
  const apply = (matches: boolean): void => {
    if (matches) {
      element.setAttribute("role", "region");
      element.setAttribute("aria-label", label);
      element.tabIndex = 0;
    } else {
      element.removeAttribute("role");
      element.removeAttribute("aria-label");
      element.removeAttribute("tabindex");
    }
  };
  apply(query.matches);
  query.addEventListener("change", (event) => apply(event.matches));
}
