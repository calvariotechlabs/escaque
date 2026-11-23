// Pantalla «Repaso de la partida» (diseño: docs/design/design-system/components/Review
// y lienzo «Repaso …»). Pinta sobre el esqueleto de index.html lo que calcula
// review.ts y pide al Worker del coach, jugada a jugada, el informe de cada una.
// Todo el texto entra con textContent; solo los iconos son marcado fijo.
import type { Color } from "../core/index.js";
import type { CoachReport, SquareMark, Verdict } from "../coach/index.js";
import { createBoard, type Mark } from "./board.js";
import { reportView, reviewKey, withCoachMarks } from "./coach.js";
import { createCoachPanel } from "./coach-panel.js";
import type { Game } from "./game.js";
import {
  curveLabel,
  curveLeft,
  curveNote,
  curveView,
  keyMoments,
  listMarker,
  nextToAnalyze,
  progressText,
  REVIEW_TEXT,
  reviewIntro,
  reviewMoves,
  spokenPrefix,
  stepKeyError,
  tally,
  type Marker,
  type ReviewItem,
  type ReviewMove,
} from "./review.js";
import { bindScrollRegion } from "./scroll-region.js";
import { PGN_TEXT } from "./pgn.js";
import { createCoachClient } from "../worker/coach-client.js";
import { EngineCancelledError } from "../worker/client.js";

export interface ReviewScreenOptions {
  /** Informes ya calculados (los del coach de la partida), por `reviewKey`. Se comparten. */
  readonly cache: Map<string, CoachReport>;
  readonly onBack: () => void;
  readonly onRematch: () => void;
  readonly onNewGame: () => void;
}

/**
 * De dónde viene la partida: la que se acaba de jugar (con revancha y nueva
 * partida) o una cargada de un PGN, que solo tiene «Volver a la partida».
 */
export type ReviewSource = { readonly kind: "partida" } | { readonly kind: "pgn"; readonly intro: string };

export interface ReviewScreen {
  /** Enseña el repaso de `game` y empieza (o sigue) el análisis. */
  open(game: Game, orientation: Color, source?: ReviewSource): void;
  /** Deja de analizar; lo revisado se conserva para la próxima vez. */
  hide(): void;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const TRIANGLE = "M10 2 18.5 17.5H1.5Z";
const CIRCLE = "M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 1 0 0-15Z";
const ROWS: readonly (readonly [Verdict, string])[] = [
  ["mejor", "Mejores jugadas"],
  ["buena", "Buenas jugadas"],
  ["imprecision", "Imprecisiones"],
  ["error", "Errores"],
  ["error-grave", "Errores graves"],
];
const SIDE: Readonly<Record<Color, string>> = { w: "blancas", b: "negras" };
const CACHE_LIMIT = 300;

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`Falta el elemento #${id}`);
  return node as T;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Triángulo o círculo discontinuo. `fill`: «b» o «n» (curva, según el bando) o «lista» (color del texto). */
function shape(marker: Marker, fill: "b" | "n" | "lista", size = 20): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("class", `forma forma--${fill}${marker === "imprecision" ? " forma--dudosa" : ""}`);
  path.setAttribute("d", marker === "error" ? TRIANGLE : CIRCLE);
  svg.append(path);
  return svg;
}

function svgPath(className: string, d: string): SVGPathElement {
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("class", className);
  path.setAttribute("d", d);
  return path;
}

/** Media jugada del botón (o de su antecesor) con `data-ply`, si lo hay. */
function plyOf(target: EventTarget | null): number | null {
  const button = target instanceof Element ? target.closest<HTMLElement>("[data-ply]") : null;
  return button === null ? null : Number(button.dataset["ply"]);
}

export function createReviewScreen(options: ReviewScreenOptions): ReviewScreen {
  const screen = byId<HTMLElement>("pantalla-repaso");
  const title = byId<HTMLElement>("repaso-titulo");
  const intro = byId<HTMLElement>("repaso-intro");
  const board = createBoard(byId("repaso-tablero"));
  const steps = byId<HTMLElement>("repaso-paso");
  const failure = byId<HTMLElement>("repaso-fallo");
  const curveBox = byId<HTMLElement>("repaso-curva");
  const curveTitle = byId<HTMLElement>("repaso-curva-titulo");
  const progress = byId<HTMLElement>("repaso-avance");
  const progressLabel = byId<HTMLElement>("repaso-avance-texto");
  const progressBar = byId<HTMLElement>("repaso-avance-barra");
  const progressNote = byId<HTMLElement>("repaso-avance-nota");
  const stopButton = byId<HTMLButtonElement>("repaso-parar");
  const canvas = byId<HTMLElement>("repaso-lienzo");
  const axis = byId<HTMLElement>("repaso-ejex");
  const caption = byId<HTMLElement>("repaso-pie");
  const summary = byId<HTMLElement>("repaso-resumen");
  const keyList = byId<HTMLUListElement>("repaso-clave");
  const keyNote = byId<HTMLElement>("repaso-clave-nota");
  const keyEmpty = byId<HTMLElement>("repaso-clave-vacio");
  const more = byId<HTMLDetailsElement>("repaso-mas");
  const moreTitle = byId<HTMLElement>("repaso-mas-titulo");
  const minorList = byId<HTMLUListElement>("repaso-imprecisiones");
  const moveList = byId<HTMLOListElement>("repaso-lista");
  const announcer = byId<HTMLElement>("repaso-anuncio");
  // Móvil apaisado: todo menos el tablero va en una región con scroll propio (patrón del coach).
  bindScrollRegion(byId<HTMLElement>("repaso-panel"), "Repaso: pasos, curva, jugada seleccionada, errores clave y jugadas");

  let coachMarks: readonly SquareMark[] = [];
  const panel = createCoachPanel(
    (marks) => {
      coachMarks = marks;
      drawBoard();
    },
    {
      prefix: "rep-coach",
      subheading: "h4",
      moveLine: (label) => {
        const [san = label, side = ""] = label.split(" · ");
        return [el("span", "coach__san", san), document.createTextNode(` · ${side}`)];
      },
    },
  );

  let client: ReturnType<typeof createCoachClient> | null = null;
  let gameKey = "";
  let game: Game | null = null;
  /** Partida que hay pintada en el tablero del repaso (ver `drawBoard`). */
  let drawnGame: Game | null = null;
  let source: ReviewSource = { kind: "partida" };
  let moves: ReviewMove[] = [];
  let reports = new Map<number, CoachReport>();
  let selected = 1;
  let orientation: Color = "w";
  /** Hay una petición en curso al Worker. */
  let busy = false;
  /** La pantalla está a la vista y el análisis puede avanzar. */
  let visible = false;
  let stopped = false;
  let failed = false;
  /** Cada análisis lleva su número; la respuesta de uno que ya no vale se ignora. */
  let token = 0;
  /** Lo que enseña ahora el panel del coach: así no se repinta (ni se vuelve a anunciar) sin cambios. */
  let panelKey = "";
  let key: ReviewItem[] = [];
  /** La lista de jugadas tiene que llevar la seleccionada a la vista en el próximo repintado. */
  let scrollPending = true;

  const total = (): number => moves.length;
  const complete = (): boolean => reports.size >= moves.length;
  const moveAt = (ply: number): ReviewMove | undefined => moves[ply - 1];

  // --- Análisis --------------------------------------------------------------

  function stopWorker(): void {
    token++;
    busy = false;
    client?.cancel();
  }

  /** Pide el informe de la siguiente jugada que falte, si se puede. */
  function pump(): void {
    if (!visible || busy || stopped || failed || game === null) return;
    // Lo que ya revisó el coach durante la partida no se vuelve a pedir.
    let fromCache = false;
    for (;;) {
      const ply = nextToAnalyze(moves, reports, selected);
      if (ply === null) {
        if (fromCache) {
          announce(doneAnnouncement());
          render();
        }
        return;
      }
      const move = moveAt(ply)!;
      const cached = options.cache.get(reviewKey(move.job));
      if (cached === undefined) break;
      reports.set(ply, cached);
      fromCache = true;
    }
    const ply = nextToAnalyze(moves, reports, selected)!;
    const move = moveAt(ply)!;
    const current = ++token;
    busy = true;
    client ??= createCoachClient();
    client.analyze(move.job).then(
      (report) => {
        if (current !== token) return;
        busy = false;
        // Se olvida el informe más antiguo, no todos: los del coach de la partida siguen sirviendo.
        if (options.cache.size >= CACHE_LIMIT) options.cache.delete(options.cache.keys().next().value!);
        options.cache.set(reviewKey(move.job), report);
        reports.set(ply, report);
        if (complete()) announce(doneAnnouncement());
        render();
        pump();
      },
      (error: unknown) => {
        if (current !== token || error instanceof EngineCancelledError) return;
        busy = false;
        failed = true;
        render();
      },
    );
    render();
  }

  function doneAnnouncement(): string {
    const errors = keyMoments(moves, reports).key.length;
    return errors === 0 ? "Análisis terminado. No hay errores clave." : `Análisis terminado. ${errors === 1 ? "Hay 1 error clave" : `Hay ${errors} errores clave`}.`;
  }

  function announce(text: string): void {
    announcer.textContent = text;
  }

  // --- Pintar ----------------------------------------------------------------

  function drawBoard(): void {
    // Con otra partida (al terminar una o cargar un PGN) el tablero cambia de golpe; dentro de la misma,
    // un paso adelante o atrás se anima y los saltos de varias jugadas no (lo decide el tablero).
    if (game !== drawnGame) {
      drawnGame = game;
      board.withoutAnimation(drawBoardNow);
    } else drawBoardNow();
  }

  function drawBoardNow(): void {
    const move = moveAt(selected);
    board.setOrientation(orientation);
    if (move === undefined || game === null) {
      if (game !== null) board.setPosition(game.startFen);
      board.setMarks(new Map());
      return;
    }
    board.setPosition(move.fenAfter);
    const base = new Map<string, Mark[]>([
      [move.from, ["last-move-from"]],
      [move.to, ["last-move-to"]],
    ]);
    board.setMarks(withCoachMarks(base, coachMarks));
  }

  function drawSteps(): void {
    const last = total();
    const disabled: Record<string, boolean> = {
      inicio: selected <= 1,
      anterior: selected <= 1,
      siguiente: selected >= last,
      final: selected >= last,
      "error-anterior": stepKeyError(selected, key, -1) === null,
      "error-siguiente": stepKeyError(selected, key, 1) === null,
    };
    for (const button of steps.querySelectorAll<HTMLButtonElement>("[data-paso]")) {
      // aria-disabled en vez de disabled: el botón conserva el foco al llegar al límite.
      if (disabled[button.dataset["paso"]!]) button.setAttribute("aria-disabled", "true");
      else button.removeAttribute("aria-disabled");
    }
  }

  function drawProgress(): void {
    // El botón de parar desaparece al terminar o fallar: su foco no se pierde.
    const hadFocus = document.activeElement === stopButton;
    failure.hidden = !failed;
    curveBox.hidden = failed;
    const done = complete();
    curveTitle.textContent = done ? "Evaluación de la partida" : REVIEW_TEXT.analyzingTitle;
    progress.hidden = done;
    stopButton.hidden = done;
    if (hadFocus && (done || failed)) (failed ? byId<HTMLButtonElement>("repaso-reintentar") : title).focus();
    if (done) return;
    progressLabel.textContent = progressText(reports.size, total());
    progressBar.setAttribute("aria-valuemax", String(total()));
    progressBar.setAttribute("aria-valuenow", String(reports.size));
    progressBar.querySelector<HTMLElement>("span")!.style.width = `${(reports.size / Math.max(1, total())) * 100}%`;
    progressNote.textContent = stopped ? REVIEW_TEXT.stoppedNote : REVIEW_TEXT.analyzingNote;
    stopButton.textContent = stopped ? REVIEW_TEXT.resume : REVIEW_TEXT.stop;
  }

  function drawCurve(): void {
    if (game === null) return;
    const view = curveView(moves, reports);
    canvas.setAttribute("aria-label", curveLabel(moves, reports, game.status));
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "curva__svg");
    svg.setAttribute("viewBox", "0 0 640 200");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.append(
      svgPath("curva__area", view.area),
      svgPath("curva__igualdad curva__igualdad--a", "M0 100.0 H640"),
      svgPath("curva__igualdad curva__igualdad--b", "M0 100.0 H640"),
    );
    if (view.pending !== null) svg.append(svgPath("curva__pendiente", view.pending));
    const parts: Element[] = [svg];
    if (view.veil !== null) {
      const veil = el("span", "curva__velo");
      veil.style.left = `${view.veil}%`; // por CSSOM: la CSP bloquea el atributo style
      parts.push(veil);
    }
    for (const mark of view.marks) {
      const span = el("span", mark.ply === selected ? "marca marca--sel" : "marca");
      span.style.left = `${mark.left}%`;
      span.style.top = `${mark.top}%`;
      span.append(shape(mark.marker, mark.color === "w" ? "b" : "n"));
      parts.push(span);
    }
    const cursor = el("span", "curva__cursor");
    cursor.style.left = `${curveLeft(selected, Math.max(1, total()))}%`;
    parts.push(cursor);
    canvas.replaceChildren(...parts);
    axis.replaceChildren(
      ...view.axis.map((label) => {
        const span = el("span", undefined, label.text);
        span.style.left = `${label.left}%`;
        return span;
      }),
    );
    const note = complete() ? curveNote(moves, reports, game.status) : null;
    caption.textContent = note === null ? REVIEW_TEXT.curveCaption : `${REVIEW_TEXT.curveCaption} ${note}`;
  }

  function drawSummary(): void {
    const counts = tally(moves, reports);
    summary.replaceChildren(
      ...ROWS.map(([verdict, name]) => {
        const row = el("tr");
        const head = el("th", undefined, name);
        head.scope = "row";
        row.append(head);
        for (const color of ["w", "b"] as const) {
          const value = counts[color][verdict];
          row.append(el("td", value === 0 ? "resumen__cero" : undefined, String(value)));
        }
        return row;
      }),
    );
  }

  function itemButton(item: ReviewItem): HTMLLIElement {
    const li = el("li");
    const button = el("button", "clave__item");
    button.type = "button";
    button.dataset["ply"] = String(item.ply);
    if (item.ply === selected) button.setAttribute("aria-current", "true");
    const text = el("span");
    text.append(el("span", "clave__san", item.label), document.createTextNode(" · "), el("span", "clave__tit", item.title), document.createTextNode(` · ${item.side}`));
    button.append(shape(item.marker, "lista"), text, el("span", "clave__eval", `Evaluación: ${item.evaluation}`));
    li.append(button);
    return li;
  }

  function drawKeyMoments(): void {
    const moments = keyMoments(moves, reports);
    key = moments.key;
    keyList.replaceChildren(...moments.key.map(itemButton));
    keyList.hidden = moments.key.length === 0;
    keyNote.hidden = moments.key.length === 0;
    keyEmpty.hidden = moments.key.length > 0;
    keyEmpty.textContent = complete() ? REVIEW_TEXT.noKey : REVIEW_TEXT.noKeyYet;
    more.hidden = moments.minor.length === 0;
    moreTitle.textContent = `Imprecisiones (${moments.minor.length})`;
    minorList.replaceChildren(...moments.minor.map(itemButton));
  }

  function drawMoveList(): void {
    const rows = new Map<number, HTMLLIElement>();
    for (const move of moves) {
      let row = rows.get(move.number);
      if (row === undefined) {
        row = el("li");
        // display:contents en los li del diseño: se repite el rol para los lectores de pantalla.
        row.setAttribute("role", "listitem");
        row.append(el("span", "jugadas__n", `${move.number}.`));
        if (move.color === "b") {
          const gap = el("span", undefined, "…");
          gap.setAttribute("aria-hidden", "true");
          row.append(gap);
        }
        rows.set(move.number, row);
      }
      const button = el("button", "jugada");
      button.type = "button";
      button.dataset["ply"] = String(move.ply);
      const marker = listMarker(reports.get(move.ply));
      if (marker !== null) button.append(shape(marker.marker, "lista"));
      button.append(document.createTextNode(move.san));
      button.setAttribute("aria-label", `${move.number}, ${SIDE[move.color]}: ${move.san}${marker === null ? "" : `, ${marker.text}`}`);
      if (move.ply === selected) button.setAttribute("aria-current", "true");
      row.append(button);
    }
    moveList.replaceChildren(...rows.values());
    // Solo al cambiar de jugada: si no, cada informe que llega devolvería la lista a la seleccionada.
    if (scrollPending) scrollListToSelected();
    scrollPending = false;
  }

  /** Lleva la jugada seleccionada a la vista dentro de la lista, sin mover la página. */
  function scrollListToSelected(): void {
    const button = moveList.querySelector<HTMLElement>('[aria-current="true"]');
    if (button === null || moveList.scrollHeight <= moveList.clientHeight) return;
    const top = button.offsetTop - moveList.offsetTop;
    if (top < moveList.scrollTop) moveList.scrollTop = top;
    else if (top + button.offsetHeight > moveList.scrollTop + moveList.clientHeight) moveList.scrollTop = top + button.offsetHeight - moveList.clientHeight;
  }

  function drawPanel(): void {
    const move = moveAt(selected);
    if (move === undefined) return;
    const report = reports.get(selected);
    const state = report !== undefined ? "informe" : failed ? "fallo" : stopped ? "sin-revisar" : "revisando";
    const next = `${gameKey}|${selected}|${state}`;
    if (next === panelKey) return;
    panelKey = next;
    const label = `${move.label} · ${SIDE[move.color]}`;
    const spoken = spokenPrefix(move);
    if (report !== undefined) panel.showReport(reportView(report, label), spoken);
    else if (state === "revisando") panel.showWaiting(label, `${spoken}${REVIEW_TEXT.reviewing}`, REVIEW_TEXT.reviewingText, true);
    else {
      const text = failed ? REVIEW_TEXT.failedMove : REVIEW_TEXT.notReviewed;
      panel.showWaiting(label, `${spoken}${text}`, text, false);
    }
  }

  /** Repinta todo sin perder el foco de un botón de jugada que se reconstruye. */
  function render(): void {
    if (game === null) return;
    const active = document.activeElement;
    const focusedPly = active instanceof HTMLElement && screen.contains(active) ? plyOf(active) : null;
    const focusedList = focusedPly === null ? null : active!.closest("ul, ol");
    const base = reviewIntro(game.status, total(), reports.size);
    intro.textContent = source.kind === "pgn" ? `${source.intro} ${base}` : base;
    drawKeyMoments(); // antes que los pasos: el salto de error en error usa la lista
    drawBoard();
    drawSteps();
    drawProgress();
    drawCurve();
    drawSummary();
    drawMoveList();
    drawPanel();
    if (focusedPly !== null && focusedList !== null && focusedList.id !== "") {
      document.getElementById(focusedList.id)?.querySelector<HTMLElement>(`[data-ply="${focusedPly}"]`)?.focus({ preventScroll: true });
    }
  }

  // --- Moverse ---------------------------------------------------------------

  function select(ply: number | null): void {
    if (ply === null || ply < 1 || ply > total() || ply === selected) return;
    selected = ply;
    scrollPending = true;
    coachMarks = [];
    render();
    pump(); // si la nueva jugada no está revisada, pasa la primera
  }

  function step(action: string | undefined): void {
    switch (action) {
      case "inicio":
        return select(1);
      case "anterior":
        return select(selected - 1);
      case "siguiente":
        return select(selected + 1);
      case "final":
        return select(total());
      case "error-anterior":
        return select(stepKeyError(selected, key, -1));
      case "error-siguiente":
        return select(stepKeyError(selected, key, 1));
      default:
        return;
    }
  }

  steps.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLElement>("[data-paso]");
    if (button !== null && button.getAttribute("aria-disabled") !== "true") step(button.dataset["paso"]);
  });

  // Con el foco en los botones de paso: ← → Inicio y Fin (aria-keyshortcuts). No hay atajos globales.
  const KEYS: Readonly<Record<string, string>> = { ArrowLeft: "anterior", ArrowRight: "siguiente", Home: "inicio", End: "final" };
  steps.addEventListener("keydown", (event) => {
    const action = KEYS[event.key];
    if (action === undefined || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    step(action);
  });

  for (const list of [keyList, minorList, moveList]) {
    list.addEventListener("click", (event) => select(plyOf(event.target)));
  }

  stopButton.addEventListener("click", () => {
    stopped = !stopped;
    if (stopped) stopWorker();
    render();
    pump();
  });

  byId<HTMLButtonElement>("repaso-reintentar").addEventListener("click", () => {
    failed = false;
    render();
    pump();
    title.focus(); // el aviso desaparece con el botón: el foco no se pierde
  });

  const backButtons = [...screen.querySelectorAll<HTMLButtonElement>("[data-volver]")];
  const backLabel = backButtons[0]?.textContent ?? "";
  const rematchButton = byId<HTMLButtonElement>("repaso-revancha");
  const newGameButton = byId<HTMLButtonElement>("repaso-nueva");
  for (const button of backButtons) button.addEventListener("click", () => options.onBack());
  rematchButton.addEventListener("click", () => options.onRematch());
  newGameButton.addEventListener("click", () => options.onNewGame());

  /** Botones según el origen: una partida cargada no tiene revancha ni nueva partida. */
  function applySource(): void {
    const imported = source.kind === "pgn";
    for (const button of backButtons) button.textContent = imported ? PGN_TEXT.back : backLabel;
    rematchButton.hidden = imported;
    newGameButton.hidden = imported;
  }

  return {
    open(next, side, from = { kind: "partida" }) {
      source = from;
      applySource();
      const list = reviewMoves(next);
      const nextKey = `${next.startFen}|${list.map((m) => m.job.move).join(" ")}`;
      if (nextKey !== gameKey) {
        gameKey = nextKey;
        reports = new Map();
        selected = 1;
        stopped = false;
        panelKey = "";
        announce("");
      }
      const wasVisible = visible;
      game = next;
      moves = list;
      orientation = side;
      failed = false;
      visible = true;
      coachMarks = [];
      scrollPending = true;
      render();
      pump();
      if (!wasVisible) title.focus(); // solo al aparecer: repintar con la pantalla a la vista no mueve el foco
    },

    hide() {
      visible = false;
      stopWorker();
      panelKey = ""; // al volver se repinta el panel
    },
  };
}
