// Panel del coach (diseño: docs/design/design-system/components/Coach y lienzo «Coach …»).
// Pinta los estados del coach sobre el esqueleto de index.html. Todo el texto
// entra con textContent; solo los iconos son marcado fijo. El panel nunca toma
// el foco, y solo el veredicto (`role="status"`) se anuncia: al cambiar de
// estado se reescribe el contenido de esa misma región, que no se destruye.
import type { SquareMark } from "../coach/index.js";
import { COACH_TEXT, type EvaluationView, type FindingView, type ReportView } from "./coach.js";

const SVG = (inner: string): string =>
  `<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">${inner}</svg>`;
const STROKE = 'fill="none" stroke="currentColor" stroke-width="1.8"';
const ICON_GRAVE = SVG(`<path d="M10 2 18.5 17.5H1.5Z" ${STROKE} stroke-linejoin="round"/><path d="M10 7.5v5M10 14.6v.4" ${STROKE} stroke-linecap="round"/>`);
const ICON_DUDOSA = SVG(`<circle cx="10" cy="10" r="8" ${STROKE} stroke-dasharray="3 2.4"/><path d="M10 6v4.5M10 13.2v.4" ${STROKE} stroke-linecap="round"/>`);
const ICON_BUENA = SVG(`<circle cx="10" cy="10" r="8" ${STROKE}/><path d="m6 10.3 2.8 2.8L14.2 7.5" ${STROKE} stroke-linecap="round" stroke-linejoin="round"/>`);
const ICON_MATE = SVG(`<path d="M7 3h6M10 3v3M6 17h8M7.5 17l.8-7a3 3 0 1 1 3.4 0l.8 7" ${STROKE} stroke-linecap="round" stroke-linejoin="round"/>`);
const SEVERITY_ICON = { grave: ICON_GRAVE, dudosa: ICON_DUDOSA, buena: ICON_BUENA } as const;
const FINDING_ICON = { "mate-en-1": ICON_MATE, "pieza-colgando": ICON_GRAVE, "captura-gratis": ICON_DUDOSA } as const;

export interface CoachPanel {
  /** Antes de la primera jugada (o sin jugada que revisar). */
  showEmpty(): void;
  showReviewing(label: string): void;
  showFailed(label: string): void;
  showReport(view: ReportView): void;
  /** Quita las casillas marcadas por «Ver en el tablero». */
  clearMarks(): void;
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

export function createCoachPanel(onMarks: (marks: readonly SquareMark[]) => void): CoachPanel {
  const root = byId<HTMLElement>("coach");
  const move = byId<HTMLElement>("coach-jugada");
  const verdict = byId<HTMLElement>("coach-veredicto");
  const summary = byId<HTMLElement>("coach-resumen");
  const side = byId<HTMLElement>("coach-avisos");
  let active: number | null = null;
  let findings: readonly FindingView[] = [];

  const setMove = (label: string): void => {
    move.hidden = label === "";
    move.replaceChildren(document.createTextNode("Jugada revisada: "), el("span", "coach__san", label));
  };

  /** Deja la región viva vacía: lo que no es un veredicto no se anuncia. */
  const clearVerdict = (): void => {
    verdict.replaceChildren();
    // Sin `hidden`: una región viva que pasa de display:none a visible junto a su texto puede no anunciarse.
    verdict.className = "coach__veredicto coach__veredicto--vacio";
  };

  const reset = (): void => {
    active = null;
    findings = [];
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
    showEmpty() {
      reset();
      root.removeAttribute("aria-busy");
      setMove("");
      clearVerdict();
      summary.replaceChildren(el("p", "coach__vacio", COACH_TEXT.empty));
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

    showReport(view) {
      reset();
      root.removeAttribute("aria-busy");
      setMove(view.label);
      // Región viva: se reescribe su contenido, no se reemplaza el elemento.
      verdict.className = `coach__veredicto${view.severity === "grave" ? " coach__veredicto--grave" : view.severity === "dudosa" ? " coach__veredicto--dudosa" : ""}`;
      const icon = el("span");
      icon.innerHTML = SEVERITY_ICON[view.severity]; // marcado fijo, sin datos
      const text = el("span");
      text.append(el("strong", undefined, view.verdictTitle), document.createTextNode(view.verdictText));
      verdict.replaceChildren(icon.firstElementChild!, text);

      const parts: Node[] = [];
      if (view.best !== null) {
        const best = el("p", "coach__mejor");
        best.append(document.createTextNode("Mejor jugada: "), el("span", "coach__san", view.best));
        parts.push(best);
      }
      const block = el("div");
      const list = el("dl", "coach__eval");
      list.append(...evaluationRows("Antes", view.before), ...evaluationRows("Después", view.after));
      block.append(el("h3", "coach__sub", "Evaluación"), list, el("p", "coach__leyenda", COACH_TEXT.legend));
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
        const title = el("h3", "coach__aviso-titulo");
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

    clearMarks() {
      if (active === null) return;
      active = null;
      syncActive();
      onMarks([]);
    },
  };
}
