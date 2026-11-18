// Pantallas de las lecciones guiadas: la lista y cada lección (diseño: docs/design, componente Lessons).
// Los datos y la validación son de `src/lessons`; aquí solo se pinta, se lleva el progreso
// (guardado en el dispositivo) y se conecta el tablero. Todo el texto se escribe con
// textContent o atributos, nunca como HTML.
import type { Lesson, LessonGroup } from "../lessons/types.js";
import { attachBoardInput } from "./board-input.js";
import { createBoard, type BoardView, type Mark } from "./board.js";
import { Interaction, type Outcome } from "./interaction.js";
import { LessonSession, type CheckLessonMove, type Feedback } from "./lesson-session.js";
import { completeLesson, completedCount, loadProgress, openLesson, saveProgress, stateOf, type LessonProgress, type LessonState } from "./lessons-progress.js";
import * as text from "./lessons-text.js";
import { ENGINE_NAME, moveAnnouncement, statusMessage } from "./notation.js";
import type { PromotionDialog } from "./promotion.js";
import { lessonHash, LESSONS_HASH, PLAY_HASH } from "./routes.js";
import type { KeyValueStore } from "./save.js";
import { COMPACT_LANDSCAPE, onCompactLandscapeChange } from "./scroll-region.js";

export interface LessonsDeps {
  readonly lessons: readonly Lesson[];
  readonly check: CheckLessonMove;
  readonly store: KeyValueStore | null;
  readonly promotion: PromotionDialog;
}

export interface LessonsScreen {
  /** Enseña la lista de lecciones. Devuelve el título de la pantalla (para el título de la pestaña). */
  showList(focus: boolean): string;
  /** Enseña una lección. Devuelve el título de la pantalla, o `null` si no existe (entonces enseña la lista). */
  showLesson(id: string, focus: boolean): string | null;
  hide(): void;
  /** El progreso guardado, tal como lo lleva la pantalla (también si no se pudo guardar en el dispositivo). */
  progress(): LessonProgress;
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Falta el elemento #${id}`);
  return el as T;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, content?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

// --- Iconos (del diseño): el estado se ve por la forma, no solo por el color ---

type IconKind = "vacio" | "medio" | "marca" | "cruz" | "siguiente";

const SVG_NS = "http://www.w3.org/2000/svg";

function svgPath(d: string, fill: boolean): SVGPathElement {
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", d);
  if (fill) path.setAttribute("fill", "currentColor");
  else {
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.8");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
  }
  return path;
}

function icon(kind: IconKind): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const circle = document.createElementNS(SVG_NS, "circle");
  circle.setAttribute("cx", "10");
  circle.setAttribute("cy", "10");
  circle.setAttribute("r", "8");
  circle.setAttribute("fill", "none");
  circle.setAttribute("stroke", "currentColor");
  circle.setAttribute("stroke-width", "1.8");
  svg.append(circle);
  if (kind === "medio") svg.append(svgPath("M10 2a8 8 0 0 1 0 16z", true));
  if (kind === "marca") svg.append(svgPath("M6 10.5l2.8 2.8L14 7.5", false));
  if (kind === "cruz") svg.append(svgPath("M7 7l6 6M13 7l-6 6", false));
  if (kind === "siguiente") svg.append(svgPath("M7.5 10h5M10.5 7.5l2.5 2.5-2.5 2.5", false));
  return svg;
}

const STATE_ICON: Readonly<Record<LessonState, IconKind>> = { "sin-empezar": "vacio", "en-curso": "medio", completada: "marca" };

// --- Progreso ------------------------------------------------------------------

/** Progreso de un grupo: un segmento por lección. */
function renderProgress(box: HTMLElement, lessons: readonly Lesson[], progress: LessonProgress, open: string | null, legend: boolean): void {
  const done = completedCount(progress, lessons.map((l) => l.id));
  const sentence = text.progressSentence(done, lessons.length);
  const label = el("p", "progreso__texto");
  label.append(el("strong", undefined, sentence.count), ` ${sentence.rest}`);
  const bar = el("div", "progreso__barra");
  bar.setAttribute("aria-hidden", "true");
  // CSSOM, no un atributo style: la CSP no deja estilos en línea.
  bar.style.setProperty("--n", String(lessons.length));
  for (const lesson of lessons) {
    const completed = progress.done.has(lesson.id);
    const seg = el("span", "progreso__seg");
    if (completed) seg.classList.add("progreso__seg--hecho");
    else if (lesson.id === open) seg.classList.add("progreso__seg--actual");
    bar.append(seg);
  }
  box.replaceChildren(label, bar);
  if (legend) box.append(el("p", "progreso__leyenda", text.PROGRESS_LEGEND));
}

const GROUPS: readonly LessonGroup[] = ["primeros-pasos", "tacticas"];

export function createLessonsScreen(deps: LessonsDeps): LessonsScreen {
  const { lessons, check, store, promotion } = deps;
  const ids = lessons.map((l) => l.id);
  let progress: LessonProgress = loadProgress(store, ids);
  const groupOf = (group: LessonGroup): readonly Lesson[] => lessons.filter((l) => l.group === group);

  const listScreen = byId<HTMLElement>("pantalla-lecciones");
  const listTitle = byId<HTMLElement>("titulo-lecciones");
  const listIntro = byId<HTMLElement>("lecciones-intro");
  const groupsBox = byId<HTMLElement>("lecciones-grupos");

  const lessonScreen = byId<HTMLElement>("pantalla-leccion");
  const position = byId<HTMLElement>("leccion-posicion");
  const title = byId<HTMLElement>("leccion-titulo");
  const lessonProgress = byId<HTMLElement>("leccion-progreso");
  const goal = byId<HTMLElement>("leccion-objetivo");
  const howBox = byId<HTMLElement>("leccion-como");
  const howText = byId<HTMLElement>("leccion-como-texto");
  const counter = byId<HTMLElement>("leccion-contador");
  const helpBox = byId<HTMLElement>("leccion-ayuda");
  const helpStatus = byId<HTMLElement>("leccion-ayuda-estado");
  const helpButton = byId<HTMLButtonElement>("leccion-ver-casillas");
  const legendGoal = byId<HTMLElement>("leccion-leyenda-meta");
  const turnDot = byId<HTMLElement>("leccion-turno");
  const turnText = byId<HTMLElement>("leccion-estado-texto");
  const boardBox = byId<HTMLElement>("leccion-tablero");
  const feedback = byId<HTMLElement>("leccion-retro");
  const hintList = byId<HTMLOListElement>("leccion-pistas");
  const noHints = byId<HTMLElement>("leccion-sin-pistas");
  const hintButton = byId<HTMLButtonElement>("leccion-pedir-pista");
  const restartButton = byId<HTMLButtonElement>("leccion-reiniciar");
  const announcer = byId<HTMLElement>("leccion-anuncio");
  const goalSection = byId<HTMLElement>("leccion-objetivo").closest("section")!;

  // En móvil apaisado la columna derecha no cabe entera: «Cómo se mueve» pasa a la región con scroll,
  // tras la retroalimentación; en el resto, va sobre el objetivo, como en el lienzo.
  const placeHowItMoves = (compact: boolean): void => {
    if (compact) feedback.after(howBox);
    else goalSection.before(howBox);
  };
  placeHowItMoves(window.matchMedia(COMPACT_LANDSCAPE).matches);
  onCompactLandscapeChange(placeHowItMoves);

  let view: BoardView | null = null;
  let session: LessonSession | null = null;
  let ui: Interaction | null = null;

  function persist(next: LessonProgress): void {
    progress = next;
    saveProgress(store, progress);
  }

  function announce(message: string): void {
    announcer.textContent = message;
  }

  // --- Lista -----------------------------------------------------------------------

  function card(lesson: Lesson): HTMLLIElement {
    const state = stateOf(progress, lesson.id);
    const link = el("a", "leccion");
    link.href = lessonHash(lesson.id);
    if (state === "completada") link.classList.add("leccion--hecha");
    if (state === "en-curso") link.classList.add("leccion--curso");
    const num = el("span", "leccion__num", String(lesson.number));
    num.setAttribute("aria-hidden", "true");
    const heading = el("span", "leccion__titulo");
    heading.append(el("span", "oculto", text.groupLessonLabel(lesson.group, lesson.number)), lesson.title);
    const status = el("span", "leccion__estado");
    status.append(icon(STATE_ICON[state]), text.stateLabel(state, progress.done.get(lesson.id) ?? 0, progress.helped.has(lesson.id)));
    const body = el("span", "leccion__cuerpo");
    body.append(heading, el("span", "leccion__resumen", lesson.summary), el("span", "leccion__meta", text.movesLabel(lesson.steps.length)), status);
    link.append(num, body);
    const item = el("li");
    item.append(link);
    return item;
  }

  /** Un grupo de la lista: título, descripción, su progreso y sus lecciones. La leyenda del progreso va solo en el primero. */
  function groupSection(group: LessonGroup, first: boolean): HTMLElement {
    const members = groupOf(group);
    const section = el("section", "grupo");
    const headingId = `grupo-${group}`;
    section.setAttribute("aria-labelledby", headingId);
    const head = el("div", "grupo__cab");
    const txt = el("div", "grupo__txt");
    const h = el("h3", "grupo__titulo", text.GROUP_TITLE[group]);
    h.id = headingId;
    txt.append(h, el("p", "grupo__desc", text.groupDescription(group, members.length)));
    const box = el("div", "grupo__progreso");
    const progressBox = el("div", "progreso");
    renderProgress(progressBox, members, progress, progress.current, first);
    box.append(progressBox);
    head.append(txt, box);
    const list = el("ol", "lecciones");
    list.setAttribute("aria-label", text.groupListLabel(group));
    list.append(...members.map(card));
    section.append(head, list);
    return section;
  }

  function renderList(): void {
    listIntro.textContent = text.LIST_INTRO;
    const present = GROUPS.filter((g) => groupOf(g).length > 0);
    groupsBox.replaceChildren(...present.map((g, i) => groupSection(g, i === 0)));
  }

  // --- Una lección ----------------------------------------------------------------

  function ensureBoard(): BoardView {
    if (view !== null) return view;
    const board = createBoard(boardBox);
    view = board;
    attachBoardInput({
      view: board,
      interaction: () => ui!,
      handle,
      render,
      focusBoard,
      syncTabIndex,
      promotionOpen: () => promotion.isOpen,
      enabled: () => session !== null && !session.solved,
    });
    return board;
  }

  function focusBoard(): void {
    // Resuelta la lección, el foco se queda en «Siguiente lección».
    if (session !== null && session.solved) return;
    if (view !== null && ui !== null) view.squareElement(ui.focus).focus({ preventScroll: true });
  }

  function syncTabIndex(): void {
    if (view === null || ui === null) return;
    for (const cell of view.element.querySelectorAll<HTMLElement>("[data-square]")) {
      cell.tabIndex = cell.dataset["square"] === ui.focus ? 0 : -1;
    }
  }

  function marks(): Map<string, Mark[]> {
    const s = session!;
    const all: Map<string, Mark[]> = ui!.marks();
    const add = (square: string, mark: Mark): void => {
      const existing = all.get(square);
      if (existing === undefined) all.set(square, [mark]);
      else if (!existing.includes(mark)) existing.push(mark);
    };
    // Tras un paso sin respuesta la partida se rehace: la última jugada la guarda la sesión.
    if (s.game.lastMove === null && s.lastMove !== null) {
      add(s.lastMove.from, "last-move");
      add(s.lastMove.to, "last-move");
    }
    const hint = s.hintMarks();
    if (hint !== null) {
      add(hint.from, "selected");
      add(hint.to, "target");
    }
    const targets = s.helpTargets();
    if (s.helpOn && s.helpSquare !== null) {
      add(s.helpSquare, "selected");
      for (const square of targets) add(square, s.game.pieceAt(square) === null ? "target" : "capture");
    }
    const goalSquare = s.goalSquare();
    if (goalSquare !== null) add(goalSquare, "meta");
    return all;
  }

  function render(): void {
    if (view === null || session === null || ui === null) return;
    const game = session.game;
    view.setOrientation(ui.orientation);
    view.setPosition(game.fen);
    view.setMarks(marks());
    syncTabIndex();
    turnDot.className = `estado__turno estado__turno--${game.turn}`;
    turnText.textContent = statusMessage(game.status, game.turn, game.inCheck);
    renderHintControls();
    renderHelp();
    renderCounter();
  }

  function renderHelp(): void {
    const s = session!;
    helpBox.hidden = s.lesson.helpPiece === undefined;
    helpButton.setAttribute("aria-pressed", String(s.helpOn));
    helpButton.disabled = s.solved;
  }

  function renderCounter(): void {
    const s = session!;
    const noun = s.lesson.counter;
    counter.hidden = noun === undefined;
    if (noun === undefined) return;
    const total = s.totalSteps;
    const dots = el("span", "contador__puntos");
    dots.setAttribute("aria-hidden", "true");
    for (let i = 0; i < total; i++) dots.append(el("span", i < s.captures ? "contador__punto contador__punto--hecho" : "contador__punto"));
    const sentence = text.counterSentence(s.captures, total, noun);
    const words = el("span");
    words.append(el("strong", undefined, sentence.count));
    if (sentence.rest !== "") words.append(` ${sentence.rest}`);
    counter.replaceChildren(dots, words);
  }

  /** Texto de la ayuda bajo el tablero (región de estado): las casillas marcadas, o nada si está apagada. */
  function updateHelpStatus(): void {
    const s = session!;
    helpStatus.textContent = s.helpOn ? text.helpAnnouncement(s.helpTargets(), s.goalSquare()) : "";
  }

  function renderHintControls(): void {
    const s = session!;
    hintButton.textContent = text.hintButtonLabel(s.hintsShown, s.lesson.hints.length);
    hintButton.disabled = !s.canAskHint;
    noHints.hidden = s.hintsShown > 0;
    hintList.hidden = s.hintsShown === 0;
  }

  function lessonHeader(lesson: Lesson): void {
    const members = groupOf(lesson.group);
    position.textContent = text.groupLessonPosition(lesson.group, lesson.number, members.length);
    title.textContent = lesson.title;
    renderProgress(lessonProgress, members, progress, lesson.id, false);
  }

  /** Interacción nueva sobre la partida de la sesión (al empezar y tras un paso sin respuesta, que rehace la partida). */
  function bindInteraction(focus: string | null): void {
    const s = session!;
    ui = new Interaction(s.game);
    ui.player = s.lesson.side;
    ui.orientation = s.lesson.side;
    if (focus === null) ui.focusKing(s.lesson.side);
    else ui.focus = focus;
  }

  function startRun(lesson: Lesson): void {
    const board = ensureBoard();
    session = new LessonSession(lesson, check);
    // La pieza de la ayuda es la del ejercicio: el foco del teclado empieza en ella.
    bindInteraction(lesson.helpPiece ?? null);
    board.setOrientation(lesson.side);
    feedback.replaceChildren();
    hintList.replaceChildren();
    goal.textContent = lesson.goal;
    howBox.hidden = lesson.howItMoves === undefined;
    howText.textContent = lesson.howItMoves ?? "";
    legendGoal.hidden = !lesson.steps.some((step) => step.kind === "reach" && step.marked);
    helpStatus.textContent = "";
    lessonHeader(lesson);
    render();
  }

  function addHint(number: number, body: string): void {
    const total = session!.lesson.hints.length;
    const item = el("li");
    item.append(el("strong", undefined, text.hintTitle(number, total)), body);
    hintList.append(item);
  }

  function retroBox(kind: IconKind, failed: boolean, heading: string): { box: HTMLElement; add(node: HTMLElement): void } {
    const box = el("section", failed ? "retro retro--fallo" : "retro");
    const h = el("h3", "retro__titulo");
    h.append(icon(kind), heading);
    box.append(h);
    return { box, add: (node) => box.append(node) };
  }

  /** La siguiente lección sin completar de su mismo grupo, dando la vuelta; `null` si el grupo está completo. */
  function nextLesson(current: Lesson): Lesson | null {
    const members = groupOf(current.group);
    const start = members.indexOf(current);
    for (let step = 1; step < members.length; step++) {
      const candidate = members[(start + step) % members.length]!;
      if (!progress.done.has(candidate.id)) return candidate;
    }
    return null;
  }

  function actionLink(label: string, href: string, primary: boolean): HTMLAnchorElement {
    const a = el("a", primary ? "boton boton--principal boton--enlace" : "boton boton--enlace", label);
    a.href = href;
    return a;
  }

  function actionButton(label: string, primary: boolean, onClick: () => void): HTMLButtonElement {
    const b = el("button", primary ? "boton boton--principal" : "boton", label);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }

  function showSolved(hints: number, helped: boolean): void {
    const s = session!;
    helpStatus.textContent = ""; // la ayuda se apaga al resolver: sus casillas ya no están marcadas
    const lesson = s.lesson;
    const members = groupOf(lesson.group);
    persist(completeLesson(progress, lesson.id, hints, helped));
    renderProgress(lessonProgress, members, progress, lesson.id, false);
    const next = nextLesson(lesson);
    const groupDone = completedCount(progress, members.map((l) => l.id)) === members.length;
    const usedSentence = lesson.helpPiece === undefined ? text.hintsUsed(hints) : text.helpUsedSentence(hints, helped);
    let focusTarget: HTMLElement;
    if (groupDone && lesson.group === "primeros-pasos") {
      // Final del bloque de iniciación: de aquí se pasa a las tácticas o a jugar.
      const { box, add } = retroBox("marca", false, text.BLOCK_DONE_TITLE);
      add(el("p", "retro__texto", text.BLOCK_DONE_TEXT));
      add(el("p", "retro__meta", text.blockDoneMeta(members.length)));
      const actions = el("div", "retro__acciones");
      const tactics = groupOf("tacticas");
      const firstTactic = tactics.find((l) => !progress.done.has(l.id)) ?? tactics[0];
      const primary = firstTactic === undefined ? actionLink(text.PLAY_GAME, PLAY_HASH, true) : actionLink(text.START_TACTICS, lessonHash(firstTactic.id), true);
      actions.append(primary);
      if (firstTactic !== undefined) actions.append(actionLink(text.PLAY_GAME, PLAY_HASH, false));
      actions.append(actionLink(text.ALL_LESSONS, LESSONS_HASH, false));
      add(actions);
      feedback.replaceChildren(box);
      focusTarget = primary;
    } else if (groupDone) {
      const { box, add } = retroBox("marca", false, text.ALL_DONE_TITLE(members.length));
      add(el("p", "retro__texto", `${text.CORRECT} ${lesson.success}`));
      add(el("p", "retro__texto", text.ALL_DONE_TEXT));
      add(el("p", "retro__meta", usedSentence));
      const actions = el("div", "retro__acciones");
      const play = actionLink(text.PLAY_ENGINE, PLAY_HASH, true);
      actions.append(play, actionButton(text.REPEAT_LESSON, false, () => restart(true)), actionLink(text.ALL_LESSONS, LESSONS_HASH, false));
      add(actions);
      feedback.replaceChildren(box);
      focusTarget = play;
    } else {
      const { box, add } = retroBox("marca", false, text.CORRECT);
      add(el("p", "retro__texto", lesson.success));
      add(el("p", "retro__meta", usedSentence));
      const actions = el("div", "retro__acciones");
      const nextAction = next === null ? actionLink(text.ALL_LESSONS, LESSONS_HASH, true) : actionLink(text.nextLessonLabel(next.title), lessonHash(next.id), true);
      actions.append(nextAction, actionButton(text.REPEAT_LESSON, false, () => restart(true)));
      if (next !== null) actions.append(actionLink(text.ALL_LESSONS, LESSONS_HASH, false));
      add(actions);
      feedback.replaceChildren(box);
      focusTarget = nextAction;
    }
    render();
    focusTarget.focus();
  }

  function showFeedback(result: Feedback, from: string): void {
    const s = session!;
    switch (result.kind) {
      case "correcto":
        showSolved(result.hints, result.helped);
        return;
      case "sigue": {
        // El rival no mueve: la partida se ha rehecho con el turno del alumno.
        bindInteraction(ui!.focus);
        const { box, add } = retroBox("siguiente", false, text.intermediateTitle(result.step, s.totalSteps));
        add(el("p", "retro__texto", text.NO_REPLY));
        feedback.replaceChildren(box);
        if (s.helpOn) updateHelpStatus();
        break;
      }
      case "paso": {
        const { box, add } = retroBox("siguiente", false, text.intermediateTitle(result.step, s.totalSteps));
        add(el("p", "retro__texto", text.rivalReply(ENGINE_NAME, result.reply.san)));
        feedback.replaceChildren(box);
        break;
      }
      case "fallo": {
        const { box, add } = retroBox("cruz", true, text.INCORRECT);
        add(el("p", "retro__texto", result.reason));
        add(el("p", "retro__meta", text.attemptLabel(result.attempt)));
        feedback.replaceChildren(box);
        ui!.focus = from;
        break;
      }
    }
    render();
  }

  function handle(outcome: Outcome): void {
    const s = session;
    const u = ui;
    if (s === null || u === null) return;
    switch (outcome.kind) {
      case "focus":
        syncTabIndex();
        return;
      case "moved": {
        u.focus = outcome.record.to;
        announce(moveAnnouncement(outcome.record));
        showFeedback(s.judge(outcome.record), outcome.record.from);
        return;
      }
      case "promotion":
        render();
        openPromotion();
        return;
      default:
        break;
    }
    render();
  }

  function openPromotion(): void {
    promotion.open(session!.game.turn, {
      choose: (piece) => closePromotion(() => ui!.choosePromotion(piece)),
      cancel: () => closePromotion(() => ui!.cancel()),
    });
  }

  function closePromotion(action: () => Outcome): void {
    const origin = ui!.pendingPromotion?.from;
    const outcome = action();
    promotion.close();
    if (outcome.kind === "deselected" && origin !== undefined) ui!.focus = origin;
    handle(outcome);
    focusBoard();
  }

  function restart(focusBoardAfter: boolean): void {
    if (session === null) return;
    const lesson = session.lesson;
    promotion.close();
    startRun(lesson);
    announce(text.RESTARTED);
    if (focusBoardAfter) focusBoard();
  }

  hintButton.addEventListener("click", () => {
    const s = session;
    if (s === null) return;
    const hint = s.askHint();
    if (hint === null) return;
    addHint(hint.number, hint.text);
    render();
    // Al pedir la última pista el botón se desactiva: el foco pasa al tablero para no perderse.
    if (!s.canAskHint) focusBoard();
  });

  restartButton.addEventListener("click", () => restart(true));

  helpButton.addEventListener("click", () => {
    const s = session;
    if (s === null) return;
    s.toggleHelp();
    updateHelpStatus();
    render();
  });

  // --- Pantallas ---------------------------------------------------------------------

  return {
    showList(focus) {
      lessonScreen.hidden = true;
      promotion.close();
      renderList();
      listScreen.hidden = false;
      if (focus) listTitle.focus({ preventScroll: false });
      return text.LESSONS_TITLE;
    },
    showLesson(id, focus) {
      const lesson = lessons.find((l) => l.id === id);
      if (lesson === undefined) {
        this.showList(focus);
        return null;
      }
      listScreen.hidden = true;
      persist(openLesson(progress, lesson.id));
      lessonScreen.hidden = false;
      startRun(lesson);
      if (focus) title.focus({ preventScroll: false });
      return lesson.title;
    },
    progress() {
      return progress;
    },
    hide() {
      promotion.close();
      listScreen.hidden = true;
      lessonScreen.hidden = true;
    },
  };
}
