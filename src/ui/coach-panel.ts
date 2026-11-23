// Panel del coach (diseño: docs/design/design-system/components/Coach y lienzo «Coach …»).
// Pinta los estados del coach sobre el esqueleto de index.html. Todo el texto
// entra con textContent; solo los iconos son marcado fijo. El panel nunca toma
// el foco, y solo el veredicto (`role="status"`) se anuncia: al cambiar de
// estado se reescribe el contenido de esa misma región, que no se destruye.
import { emptyState } from "./brand.js";
import type { SquareMark } from "../coach/index.js";
import { COACH_TEXT, type EvaluationView, type FindingView, type HintsView, type ReportView } from "./coach.js";

const SVG = (inner: string): string =>
  `<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">${inner}</svg>`;
const STROKE = 'fill="none" stroke="currentColor" stroke-width="1.8"';
const ICON_GRAVE = SVG(`<path d="M10 2 18.5 17.5H1.5Z" ${STROKE} stroke-linejoin="round"/><path d="M10 7.5v5M10 14.6v.4" ${STROKE} stroke-linecap="round"/>`);
const ICON_DUDOSA = SVG(`<circle cx="10" cy="10" r="8" ${STROKE} stroke-dasharray="3 2.4"/><path d="M10 6v4.5M10 13.2v.4" ${STROKE} stroke-linecap="round"/>`);
const ICON_BUENA = SVG(`<circle cx="10" cy="10" r="8" ${STROKE}/><path d="m6 10.3 2.8 2.8L14.2 7.5" ${STROKE} stroke-linecap="round" stroke-linejoin="round"/>`);
const ICON_MATE = SVG(`<path d="M7 3h6M10 3v3M6 17h8M7.5 17l.8-7a3 3 0 1 1 3.4 0l.8 7" ${STROKE} stroke-linecap="round" stroke-linejoin="round"/>`);
const SEVERITY_ICON = { grave: ICON_GRAVE, dudosa: ICON_DUDOSA, buena: ICON_BUENA } as const;
const FINDING_ICON = { "mate-en-1": ICON_MATE, "pieza-colgando": ICON_GRAVE, "captura-gratis": ICON_DUDOSA } as const;

/** Dónde está el panel y cómo se escribe la jugada. Por defecto, el coach de la partida. */
export interface CoachPanelOptions {
  /** Prefijo de los id del esqueleto: `<prefijo>`, `<prefijo>-jugada`, `-veredicto`, `-resumen` y `-avisos`. */
  readonly prefix?: string;
  /** Contenido de la línea de la jugada; por defecto, «Jugada revisada: 4. Cf3» (o «Tu jugada: 3. a3» si es la anterior). */
  readonly moveLine?: (label: string, previous: boolean) => Node[];
  /** Nivel de los subtítulos (Evaluación y avisos): un nivel por debajo del título del panel. Por defecto, h3. */
  readonly subheading?: "h3" | "h4";
  /**
   * «Ver en el tablero» de la mejor jugada (CAL-394): se llama con `true` al pedir la vista de la
   * posición de antes y con `false` al volver. Sin esta opción el bloque no lleva botón (repaso).
   */
  readonly onBest?: (active: boolean) => void;
  /** «Pedir pista» (CAL-394). Sin esta opción el panel no tiene pistas. */
  readonly onHint?: () => void;
}

export interface CoachPanel {
  /** Antes de la primera jugada (o sin jugada que revisar). */
  showEmpty(): void;
  showReviewing(label: string): void;
  showFailed(label: string): void;
  /**
   * Informe de una jugada. `spoken` es un texto oculto que se lee antes del
   * veredicto (en el repaso, «14. Th2, blancas. »).
   */
  showReport(view: ReportView, spoken?: string): void;
  /**
   * Jugada todavía sin informe (en el repaso): `spoken` se anuncia y `text` se
   * ve; con `busy`, la barra de «pensando».
   */
  showWaiting(label: string, spoken: string, text: string, busy: boolean): void;
  /**
   * La revisión es de tu jugada anterior (la máquina ya ha respondido): `note` es el texto de la nota,
   * o `null` si es la última jugada. No toca la región viva, así que no vuelve a anunciar el veredicto.
   */
  setPrevious(note: string | null): void;
  /** Quita las casillas marcadas por «Ver en el tablero». */
  clearMarks(): void;
  /** El botón de la mejor jugada dice «Volver a la partida» mientras se ve la posición de antes (CAL-394). */
  setBestActive(active: boolean): void;
  /** Pinta el bloque de pistas (CAL-394). */
  setHints(view: HintsView): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`Falta el elemento #${id}`);
  return node as T;
}

/** Texto con la jugada destacada en mono, como en el diseño. */
function textWithSan(text: string, san: string | null): Node[] {
  if (san === null || san === "") return [document.createTextNode(text)];
  const nodes: Node[] = [];
  let rest = text;
  for (let at = rest.indexOf(san); at >= 0; at = rest.indexOf(san)) {
    if (at > 0) nodes.push(document.createTextNode(rest.slice(0, at)));
    nodes.push(el("span", "coach__san", san));
    rest = rest.slice(at + san.length);
  }
  if (rest !== "") nodes.push(document.createTextNode(rest));
  return nodes;
}

/** Texto de una pista ya pintada («Pista 1 de 3» + el texto), para saber si ha cambiado. */
const hintItemText = (index: number, text: string | undefined): string => `Pista ${index + 1} de 3${text ?? ""}`;

function evaluationRows(label: string, evaluation: EvaluationView): [HTMLElement, HTMLElement] {
  const term = el("dt", undefined, label);
  const detail = el("dd");
  const bar = el("div", "coach__barra");
  bar.setAttribute("aria-hidden", "true");
  const fill = el("span");
  fill.style.width = `${evaluation.percent}%`; // por CSSOM: la CSP bloquea el atributo en línea
  bar.append(fill);
  detail.append(el("span", "coach__valor", evaluation.value), document.createTextNode(evaluation.rest), bar);
  return [term, detail];
}

export function createCoachPanel(onMarks: (marks: readonly SquareMark[]) => void, options: CoachPanelOptions = {}): CoachPanel {
  const prefix = options.prefix ?? "coach";
  const moveLine =
    options.moveLine ??
    ((label: string, previous: boolean): Node[] => [
      document.createTextNode(previous ? COACH_TEXT.previousMove : COACH_TEXT.reviewedMove),
      el("span", "coach__san", label),
    ]);
  const sub = options.subheading ?? "h3";
  const root = byId<HTMLElement>(prefix);
  const move = byId<HTMLElement>(`${prefix}-jugada`);
  const verdict = byId<HTMLElement>(`${prefix}-veredicto`);
  const summary = byId<HTMLElement>(`${prefix}-resumen`);
  const side = byId<HTMLElement>(`${prefix}-avisos`);

  // Pistas para la jugada que toca (CAL-394): solo en el coach de la partida.
  const hints =
    options.onHint === undefined
      ? null
      : {
          root: byId<HTMLElement>(`${prefix}-pistas`),
          note: byId<HTMLElement>(`${prefix}-pistas-nota`),
          list: byId<HTMLOListElement>(`${prefix}-pistas-lista`),
          bar: byId<HTMLElement>(`${prefix}-pistas-barra`),
          button: byId<HTMLButtonElement>(`${prefix}-pistas-boton`),
        };
  if (hints !== null) {
    hints.button.addEventListener("click", () => {
      if (hints.button.getAttribute("aria-disabled") !== "true") options.onHint?.();
    });
  }
  let active: number | null = null;
  let findings: readonly FindingView[] = [];
  let bestBlock: HTMLElement | null = null;
  let bestButton: HTMLButtonElement | null = null;
  let bestSan = "";
  let bestActive = false;

  // Etiqueta y nota de «jugada anterior»: solo existen en el coach de la partida.
  const tag = document.getElementById(`${prefix}-etiqueta`);
  const note = document.getElementById(`${prefix}-nota`);
  let currentLabel = "";
  let previousNote: string | null = null;

  const setMove = (label: string): void => {
    currentLabel = label;
    move.hidden = label === "";
    move.replaceChildren(...moveLine(label, previousNote !== null));
    if (tag !== null) tag.hidden = label === "" || previousNote === null;
    if (note !== null) {
      note.hidden = label === "" || previousNote === null;
      note.textContent = previousNote ?? "";
    }
  };

  /** Deja la región viva vacía: lo que no es un veredicto no se anuncia. */
  const clearVerdict = (): void => {
    verdict.replaceChildren();
    // Sin `hidden`: una región viva que pasa de display:none a visible junto a su texto puede no anunciarse.
    verdict.className = "coach__veredicto coach__veredicto--vacio";
  };

  const syncBest = (): void => {
    if (bestBlock === null || bestButton === null) return;
    bestBlock.classList.toggle("coach__alternativa--activa", bestActive);
    const text = bestActive ? COACH_TEXT.returnToGame : COACH_TEXT.show;
    bestButton.textContent = text;
    bestButton.setAttribute("aria-label", `${text}: mejor jugada, ${bestSan}`);
  };

  const reset = (): void => {
    active = null;
    findings = [];
    if (bestActive) options.onBest?.(false);
    bestActive = false;
    bestBlock = null;
    bestButton = null;
    onMarks([]);
    side.replaceChildren();
    side.hidden = true;
  };

  const syncActive = (): void => {
    side.querySelectorAll<HTMLElement>("[data-aviso]").forEach((item) => {
      const index = Number(item.dataset["aviso"]);
      const on = index === active;
      item.classList.toggle("coach__aviso--activo", on);
      const button = item.querySelector("button")!;
      const finding = findings[index]!;
      button.textContent = on ? COACH_TEXT.hide : COACH_TEXT.show;
      button.setAttribute("aria-label", `${on ? COACH_TEXT.hide : COACH_TEXT.show}: ${finding.label}`);
    });
  };

  side.addEventListener("click", (event) => {
    const item = (event.target as Element).closest<HTMLElement>("[data-aviso]");
    if (item === null || !(event.target as Element).closest("button")) return;
    const index = Number(item.dataset["aviso"]);
    active = active === index ? null : index;
    syncActive(); // sin reconstruir: el botón pulsado conserva el foco
    onMarks(active === null ? [] : findings[index]!.marks);
  });

  return {
    setPrevious(text) {
      previousNote = text;
      setMove(currentLabel);
    },

    showEmpty() {
      reset();
      previousNote = null;
      root.removeAttribute("aria-busy");
      setMove("");
      clearVerdict();
      summary.replaceChildren(emptyState(COACH_TEXT.emptyTitle, COACH_TEXT.emptyText, "coach__vacio-marca"));
    },

    showReviewing(label) {
      reset();
      root.setAttribute("aria-busy", "true");
      setMove(label);
      clearVerdict();
      const card = el("p", "coach__veredicto");
      const text = el("span");
      text.append(el("strong", undefined, COACH_TEXT.reviewingTitle), document.createTextNode(COACH_TEXT.reviewingText));
      card.append(text);
      const bar = el("div", "coach__barra-pensando");
      bar.setAttribute("aria-hidden", "true");
      summary.replaceChildren(card, bar, el("p", "coach__vacio", COACH_TEXT.reviewingHint));
    },

    showFailed(label) {
      reset();
      root.removeAttribute("aria-busy");
      setMove(label);
      // El fallo sí se anuncia: es lo que sustituye al veredicto que no llega.
      verdict.className = "coach__veredicto";
      const text = el("span");
      text.append(el("strong", undefined, COACH_TEXT.failedTitle), document.createTextNode(COACH_TEXT.failedText));
      verdict.replaceChildren(text);
      summary.replaceChildren();
    },

    showWaiting(label, spoken, text, busy) {
      reset();
      // Sin aria-busy: lo oculto de `spoken` tiene que anunciarse.
      root.removeAttribute("aria-busy");
      setMove(label);
      clearVerdict();
      verdict.append(el("span", "oculto", spoken));
      const parts: Node[] = [el("p", "coach__vacio", text)];
      if (busy) {
        const bar = el("div", "coach__barra-pensando");
        bar.setAttribute("aria-hidden", "true");
        parts.push(bar);
      }
      summary.replaceChildren(...parts);
    },

    showReport(view, spoken = "") {
      reset();
      root.removeAttribute("aria-busy");
      setMove(view.label);
      // Región viva: se reescribe su contenido, no se reemplaza el elemento.
      verdict.className = `coach__veredicto${view.severity === "grave" ? " coach__veredicto--grave" : view.severity === "dudosa" ? " coach__veredicto--dudosa" : ""}`;
      const icon = el("span");
      icon.innerHTML = SEVERITY_ICON[view.severity]; // marcado fijo, sin datos
      const text = el("span");
      if (spoken !== "") text.append(el("span", "oculto", spoken));
      text.append(el("strong", undefined, view.verdictTitle), document.createTextNode(view.verdictText));
      verdict.replaceChildren(icon.firstElementChild!, text);

      const parts: Node[] = [];
      if (view.best !== null) {
        const block = el("div", "coach__alternativa");
        const best = el("p", "coach__mejor");
        best.append(document.createTextNode(COACH_TEXT.bestPrefix), el("span", "coach__san", view.best));
        block.append(best);
        if (view.why !== "") {
          const why = el("p", "coach__porque");
          why.append(el("strong", undefined, COACH_TEXT.whyPrefix), ...textWithSan(view.why, view.best?.replace(/[+#]$/, "") ?? null));
          block.append(why);
        }
        if (view.line !== "") {
          const line = el("p", "coach__linea");
          line.append(document.createTextNode(COACH_TEXT.linePrefix), el("span", "coach__san", view.line));
          block.append(line);
        }
        if (options.onBest !== undefined) {
          const button = el("button", "boton");
          button.type = "button";
          button.addEventListener("click", () => {
            bestActive = !bestActive;
            syncBest(); // sin reconstruir: el botón conserva el foco
            options.onBest?.(bestActive);
          });
          block.append(button);
          bestButton = button;
        }
        bestBlock = block;
        bestSan = view.best;
        syncBest();
        parts.push(block);
      }
      const block = el("div");
      const list = el("dl", "coach__eval");
      list.append(...evaluationRows("Antes", view.before), ...evaluationRows("Después", view.after));
      block.append(el(sub, "coach__sub", "Evaluación"), list, el("p", "coach__leyenda", COACH_TEXT.legend));
      parts.push(block);
      summary.replaceChildren(...parts);

      side.hidden = false;
      findings = view.findings;
      if (findings.length === 0) {
        side.replaceChildren(el("p", "coach__vacio", COACH_TEXT.noWarnings));
        return;
      }
      const ul = el("ul", "coach__avisos");
      ul.setAttribute("aria-label", "Avisos del coach");
      findings.forEach((finding, index) => {
        const li = el("li", "coach__aviso");
        li.dataset["aviso"] = String(index);
        const title = el(sub, "coach__aviso-titulo");
        const iconHolder = el("span");
        iconHolder.innerHTML = FINDING_ICON[finding.kind];
        title.append(iconHolder.firstElementChild!, document.createTextNode(finding.title));
        const p = el("p");
        p.append(...textWithSan(finding.message, finding.san));
        const button = el("button", "boton");
        button.type = "button";
        li.append(title, p, button);
        ul.append(li);
      });
      side.replaceChildren(ul);
      syncActive();
    },

    setBestActive(on) {
      if (bestActive === on) return;
      bestActive = on;
      syncBest();
    },

    setHints(view) {
      if (hints === null) return;
      hints.root.hidden = !view.visible;
      hints.note.hidden = view.note === null;
      hints.note.textContent = view.note ?? "";
      hints.bar.hidden = !view.busy;
      // La lista es una región viva: solo se añade la pista nueva, para que no se relean las anteriores.
      const current = [...hints.list.children].map((li) => li.textContent ?? "");
      const same = current.every((text, i) => text === hintItemText(i, view.items[i]));
      if (!same || view.items.length < current.length) hints.list.replaceChildren();
      for (let i = hints.list.children.length; i < view.items.length; i++) {
        const li = el("li");
        li.append(el("strong", undefined, `Pista ${i + 1} de 3`), document.createTextNode(view.items[i]!));
        hints.list.append(li);
      }
      hints.list.hidden = view.items.length === 0;
      hints.button.hidden = view.button === null;
      if (view.button !== null) {
        hints.button.textContent = view.button.text;
        // aria-disabled y no `disabled`: un botón desactivado pierde el foco de quien acaba de pulsarlo.
        if (view.button.disabled) hints.button.setAttribute("aria-disabled", "true");
        else hints.button.removeAttribute("aria-disabled");
      }
    },

    clearMarks() {
      if (active === null) return;
      active = null;
      syncActive();
      onMarks([]);
    },
  };
}
