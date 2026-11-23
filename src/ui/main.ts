// Pantallas de Escaque: ajustes de la partida y partida (a dos jugadores en el
// mismo dispositivo o contra la máquina, Alfil Beta en un Worker).
// Traduce clics, arrastres y teclas a llamadas de `Interaction` y pinta el
// resultado con `BoardView`. Todo el texto se escribe con textContent o
// atributos, nunca como HTML. La carga el navegador como módulo ES nativo.
import { START_FEN, parsePgn } from "../core/index.js";
import { attachBoardInput } from "./board-input.js";
import { createBoard } from "./board.js";
import { Game } from "./game.js";
import { Interaction, type Outcome } from "./interaction.js";
import { minPly, normalizePly, redoTarget, requestMachineMove, undoTarget } from "./machine.js";
import {
  ENGINE_NAME,
  machineHeading,
  machineMoveAnnouncement,
  moveAnnouncement,
  newGameWarning,
  resultMessage,
  sanToSpanish,
  statusMessage,
} from "./notation.js";
import { applyBoardTheme, isBoardTheme, loadBoardTheme, saveBoardTheme } from "./board-theme.js";
import { createPromotionDialog } from "./promotion.js";
import { celebrate, prefersReducedMotion, sealKindFor, setSeal } from "./brand.js";
import { finishedParts, machineStatusParts, resultView, shouldCelebrate, type ResultKind } from "./identity.js";
import { browserStore, createAutosave, loadFromStorage } from "./save.js";
import {
  choiceOf,
  DEFAULT_CHOICE,
  LEVEL_NAME,
  parseChoice,
  resolveSetup,
  TWO_PLAYERS,
  type GameSetup,
  type SetupChoice,
} from "./settings.js";
import type { CoachReport, SquareMark } from "../coach/index.js";
import type { Arrow } from "./arrows.js";
import {
  NO_HINTS,
  HINTS_TOTAL,
  hintMarks,
  hintsView,
  previousNote,
  reportView,
  reviewJob,
  reviewKey,
  reviewPosition,
  reviewViewText,
  withCoachMarks,
} from "./coach.js";
import type { HintsAvailability, HintsState, ReportView, ReviewJob } from "./coach.js";
import type { Mark } from "./board.js";
import { historyUci } from "./machine.js";
import { createCoachPanel } from "./coach-panel.js";
import { createReviewScreen } from "./review-screen.js";
import { exportGame, fileTooLarge, gameFromPgn, importIntro, loadError, PGN_TEXT } from "./pgn.js";
import { createEngineClient, EngineCancelledError } from "../worker/client.js";
import { createCoachClient } from "../worker/coach-client.js";
import { startPwa } from "../pwa/pwa.js";
import { checkLessonMove, LESSONS } from "../lessons/index.js";
import { createLessonsScreen } from "./lessons-screen.js";
import { dismissBeginner, isBeginnerDismissed, showBeginnerNotice } from "./lessons-progress.js";
import { LESSONS_TITLE } from "./lessons-text.js";
import { parseRoute, type Route } from "./routes.js";
import { createCapturesView, placeCapturesInLandscape } from "./captures-view.js";
import { bindScrollRegion, onCompactLandscapeChange } from "./scroll-region.js";

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Falta el elemento #${id}`);
  return el as T;
}

const settingsScreen = byId<HTMLElement>("pantalla-ajustes");
const gameScreen = byId<HTMLElement>("pantalla-partida");
const reviewScreenRoot = byId<HTMLElement>("pantalla-repaso");
const reviewButton = byId<HTMLButtonElement>("repasar");
const settingsForm = byId<HTMLFormElement>("ajustes");
const levelGroup = byId<HTMLFieldSetElement>("grupo-nivel");
const colorGroup = byId<HTMLFieldSetElement>("grupo-color");
const headingSub = byId<HTMLParagraphElement>("cabecera-sub");
const linkPlay = byId<HTMLAnchorElement>("enlace-jugar");
const linkLessons = byId<HTMLAnchorElement>("enlace-lecciones");
const headingLong = byId<HTMLSpanElement>("cabecera-largo");
const headingShort = byId<HTMLSpanElement>("cabecera-corto");
const thinkingBar = byId<HTMLSpanElement>("pensando");
const resultBox = byId<HTMLElement>("resultado");
const resultTitle = byId<HTMLElement>("resultado-titulo");
const resultKicker = byId<HTMLElement>("resultado-antetitulo");
const resultSeal = byId<HTMLElement>("resultado-sello");
const resultText = byId<HTMLElement>("resultado-texto");
const rematchButton = byId<HTMLButtonElement>("revancha");
const statusBox = byId<HTMLParagraphElement>("estado");
const statusTurn = byId<HTMLSpanElement>("estado-turno");
const statusText = byId<HTMLElement>("estado-texto");
const statusExtra = byId<HTMLSpanElement>("estado-extra");
const statusCause = byId<HTMLSpanElement>("estado-causa");
const statusCheck = byId<HTMLSpanElement>("estado-jaque");
const statusYourTurn = byId<HTMLSpanElement>("estado-toca");
const statusLevel = byId<HTMLSpanElement>("estado-nivel");
const newGameButton = byId<HTMLButtonElement>("nueva");
const rotateButton = byId<HTMLButtonElement>("girar");
const undoButton = byId<HTMLButtonElement>("deshacer");
const redoButton = byId<HTMLButtonElement>("rehacer");
const confirmDialog = byId<HTMLDialogElement>("confirmar-nueva");
const confirmText = byId<HTMLParagraphElement>("texto-confirmar");
const keepPlayingButton = byId<HTMLButtonElement>("seguir-jugando");
const startButton = byId<HTMLButtonElement>("empezar");
const moveList = byId<HTMLOListElement>("lista-jugadas");
const noMoves = byId<HTMLElement>("sin-jugadas");
const announcer = byId<HTMLParagraphElement>("anuncio");
const promotionDialog = byId<HTMLDialogElement>("coronacion");
const exportPgnButton = byId<HTMLButtonElement>("exportar-pgn");
const loadPgnButton = byId<HTMLButtonElement>("cargar-pgn");
const exportNotice = byId<HTMLParagraphElement>("pgn-aviso");
const exportFile = byId<HTMLElement>("pgn-aviso-archivo");
const pgnDialog = byId<HTMLDialogElement>("dialogo-pgn");
const pgnField = byId<HTMLTextAreaElement>("pgn-campo");
const pgnChoose = byId<HTMLButtonElement>("pgn-elegir");
const pgnFile = byId<HTMLInputElement>("pgn-archivo");
const pgnFileName = byId<HTMLParagraphElement>("pgn-archivo-nombre");
const pgnError = byId<HTMLParagraphElement>("pgn-error");
const pgnErrorText = byId<HTMLSpanElement>("pgn-error-texto");
const pgnCancel = byId<HTMLButtonElement>("pgn-cancelar");
const pgnLoad = byId<HTMLButtonElement>("pgn-cargar");
/** Partida cargada de un PGN que se está repasando; `null` si se repasa la partida en curso. */
let imported: { readonly game: Game; readonly intro: string } | null = null;
/** Posición en la que se exportó la partida: el aviso se quita cuando cambia. */
let exportedFen: string | null = null;
/** Cuenta las lecturas de archivo: solo la última escribe en el campo. */
let pgnFileToken = 0;
const promotionOptions = byId<HTMLDivElement>("opciones-coronacion");
const view = createBoard(byId("tablero"));
const promotion = createPromotionDialog(promotionDialog, promotionOptions);
const lessonsScreen = createLessonsScreen({
  lessons: LESSONS,
  check: checkLessonMove,
  store: browserStore(),
  promotion,
});
createBoard(byId("vista-previa")).setPosition(START_FEN);

// La partida en curso se guarda en el dispositivo y se recupera al abrir o al actualizar la app.
const store = browserStore();

// Tablero elegido (Bosque o Nogal), recordado en el dispositivo (CAL-397). Solo cambia colores, nunca la partida.
{
  const picker = byId<HTMLFieldSetElement>("tema-tablero");
  const theme = loadBoardTheme(store);
  applyBoardTheme(document.documentElement, theme);
  for (const input of picker.querySelectorAll<HTMLInputElement>('input[name="tablero"]')) input.checked = input.value === theme;
  picker.addEventListener("change", (event) => {
    const value = (event.target as HTMLInputElement).value;
    if (!isBoardTheme(value)) return;
    applyBoardTheme(document.documentElement, value);
    saveBoardTheme(store, value);
  });
}
const recovered = loadFromStorage(store);
const autosave = createAutosave(store);

// Aviso «¿Nunca has jugado?» en la pantalla de nueva partida: solo sin progreso de lecciones y sin haberlo descartado.
const beginnerNotice = byId<HTMLElement>("aviso-novato");
const settingsTitle = byId<HTMLElement>("titulo-ajustes");
let beginnerDismissed = isBeginnerDismissed(store);

function syncBeginnerNotice(): void {
  beginnerNotice.hidden = !showBeginnerNotice(lessonsScreen.progress(), beginnerDismissed);
}

byId<HTMLButtonElement>("aviso-novato-ahora-no").addEventListener("click", () => {
  beginnerDismissed = true;
  dismissBeginner(store);
  syncBeginnerNotice();
  // El botón desaparece con el aviso: el foco pasa al título de la pantalla para no perderse.
  settingsTitle.focus();
});
let setup: GameSetup = recovered?.setup ?? TWO_PLAYERS;
let game = recovered?.game ?? new Game();
let ui = newInteraction(game, setup);
if (recovered !== null) ui.orientation = recovered.orientation;

// La máquina: un Worker propio, creado la primera vez que hace falta.
let engine: ReturnType<typeof createEngineClient> | null = null;
/** Cada petición lleva su número; la respuesta de una que ya no vale se ignora. */
let generation = 0;
let thinking = false;
/** «Está pensando» solo se muestra si tarda más de esto, para no parpadear con las jugadas rápidas. */
const THINKING_DELAY_MS = 300;
let thinkingVisible = false;
let thinkingTimer: ReturnType<typeof setTimeout> | null = null;
let machineFailed = false;

// El coach: revisa en su propio Worker la última jugada de la persona (o la última, en partida a dos).
let coachClient: ReturnType<typeof createCoachClient> | null = null;
const coachCache = new Map<string, CoachReport>();
/** Lo que enseña el panel ahora: la clave de la jugada revisada, `""` si no hay jugadas o `null` si hay que repintar. */
let coachKey: string | null = null;
let coachToken = 0;
let coachMarks: readonly SquareMark[] = [];
/** Nota de «jugada anterior» que enseña ahora el panel del coach (`null`: ninguna). */
let coachNote: string | null = null;
/** Posición en la que se pidieron las marcas de «Ver en el tablero»: si cambia, se quitan. */
let coachMarksFen = "";
const coachPanel = createCoachPanel(
  (marks) => {
    coachMarks = marks;
    coachMarksFen = game.fen;
    applyMarks();
  },
  { onBest: (active) => (active ? openPeek() : closePeek(false)), onHint: () => requestHint() },
);

// --- Coach mejorado (CAL-394): la posición de antes con flechas y las pistas ----------------

/** Informe que enseña ahora el panel del coach, con su jugada. */
let shownReport: { readonly view: ReportView; readonly job: ReviewJob } | null = null;

/** Vista de la posición de antes de la jugada revisada, con la mejor jugada y la tuya en flechas. `null`: la partida. */
let peek: {
  readonly fen: string;
  readonly marks: ReadonlyMap<string, readonly Mark[]>;
  readonly arrows: readonly Arrow[];
  readonly grid: string;
  /** Posición de la partida al abrirla: si cambia, la vista se cierra sola. */
  readonly gameFen: string;
} | null = null;

const peekBanner = byId<HTMLElement>("vista-revision");
const peekLegend = byId<HTMLElement>("vista-leyenda");

function openPeek(): void {
  if (shownReport === null || shownReport.view.bestArrow === null || shownReport.view.best === null) return;
  const { view: report, job } = shownReport;
  const before = reviewPosition(job);
  const marks = new Map<string, Mark[]>();
  if (before.lastMove !== null) {
    marks.set(before.lastMove.from, ["last-move-from"]);
    marks.set(before.lastMove.to, ["last-move-to"]);
  }
  const text = reviewViewText(job.label);
  peek = {
    fen: before.fen,
    marks,
    arrows: [
      { ...report.bestArrow!, kind: "mejor" },
      { ...report.playedArrow, kind: "tuya" },
    ],
    grid: text.grid,
    gameFen: game.fen,
  };
  byId("vista-revision-titulo").textContent = text.title;
  byId("vista-revision-texto").textContent = text.text;
  byId("vista-leyenda-mejor").textContent = report.best!;
  byId("vista-leyenda-tuya").textContent = job.label.replace(/^\d+(\.|…) /, "");
  peekBanner.hidden = false;
  peekLegend.hidden = false;
  announce(`${text.title}. Mejor jugada: ${report.best!}.`);
  paintBoard();
}

/**
 * Vuelve a la partida. `fromBanner`: el foco pasa al tablero, porque el botón del aviso desaparece.
 * `silent`: sin anuncio (la partida ha cambiado y ya se anuncia lo que ha pasado).
 */
function closePeek(fromBanner: boolean, silent = false): void {
  if (peek === null) return;
  peek = null;
  peekBanner.hidden = true;
  peekLegend.hidden = true;
  coachPanel.setBestActive(false);
  if (!silent) announce("De vuelta a la partida.");
  paintBoard();
  if (fromBanner) focusBoard();
}

byId("vista-revision-volver").addEventListener("click", () => closePeek(true));
document.addEventListener("keydown", (event) => {
  if (peek === null || event.key !== "Escape" || event.defaultPrevented || document.querySelector("dialog[open]") !== null) return;
  event.preventDefault();
  closePeek(peekBanner.contains(document.activeElement));
});

/** Pistas para la posición de la partida en pantalla; se reinician al cambiar la posición. */
let hints: HintsState = NO_HINTS;
let hintsFen = "";
let hintsGame: Game | null = null;
let hintToken = 0;
let hintClient: ReturnType<typeof createCoachClient> | null = null;

function hintsAvailability(): HintsAvailability {
  if (game.isOver) return "hidden";
  if (setup.mode === "maquina" && (game.turn !== setup.player || thinking)) {
    // «Está pensando» solo si piensa o va a pensar; si no puede (falló o se mira una jugada pasada), nada.
    return thinking || (!machineFailed && !game.canRedo) ? "waiting" : "hidden";
  }
  return "available";
}

function renderHints(): void {
  if (hintsFen !== game.fen || hintsGame !== game) {
    hintsFen = game.fen;
    hintsGame = game;
    hints = NO_HINTS;
    hintToken++;
    hintClient?.cancel();
  }
  coachPanel.setHints(hintsView(hints, hintsAvailability()));
}

function requestHint(): void {
  if (hintsAvailability() !== "available" || hints.pending || hints.shown >= HINTS_TOTAL) return;
  closePeek(false);
  if (hints.hint !== null) {
    hints = { ...hints, shown: hints.shown + 1 };
    renderHints();
    applyMarks();
    return;
  }
  hints = { ...hints, pending: true, failed: false };
  renderHints();
  const token = ++hintToken;
  hintClient ??= createCoachClient();
  hintClient.hint({ fen: game.startFen, moves: historyUci(game) }).then(
    (hint) => {
      if (token !== hintToken) return;
      hints = { shown: 1, hint, pending: false, failed: false };
      renderHints();
      applyMarks();
    },
    (error: unknown) => {
      if (token !== hintToken || error instanceof EngineCancelledError) return;
      hints = { ...NO_HINTS, failed: true };
      renderHints();
    },
  );
}

// Repaso de la partida terminada: su propia pantalla, con los informes del coach compartidos.
const review = createReviewScreen({
  cache: coachCache,
  onBack: () => {
    const fromPgn = imported !== null;
    imported = null;
    showScreen("partida");
    (fromPgn ? loadPgnButton : reviewButton).focus();
  },
  onRematch: () => startGame(setup.mode === "maquina" ? { ...setup } : setup),
  onNewGame: () => openSettings(),
});

/** Deja de revisar en el coach de la partida (otra pantalla a la vista). */
function stopCoach(): void {
  closePeek(false, true);
  coachToken++;
  coachKey = null;
  coachClient?.cancel();
}

function applyMarks(): void {
  if (peek !== null) {
    view.setMarks(peek.marks);
    view.setArrows(peek.arrows);
    return;
  }
  const hint = hintMarks(hints);
  view.setMarks(withCoachMarks(withCoachMarks(ui.marks(), coachMarks), hint.marks));
  view.setArrows(hint.arrow === null ? [] : [{ ...hint.arrow, kind: "mejor" }]);
}

/** Pinta en el tablero la partida o, si está abierta, la vista de la posición de antes. */
function paintBoard(): void {
  if (peek !== null) {
    view.withoutAnimation(() => view.setPosition(peek!.fen));
    view.setGridLabel(peek.grid);
  } else {
    if (game === drawnGame && view.element.dataset["vista"] !== "revision") view.setPosition(game.fen);
    else view.withoutAnimation(() => view.setPosition(game.fen));
    view.setGridLabel(null);
    drawnGame = game;
  }
  view.element.dataset["vista"] = peek === null ? "partida" : "revision";
  applyMarks();
  syncTabIndex();
}

function newInteraction(forGame: Game, forSetup: GameSetup): Interaction {
  const interaction = new Interaction(forGame);
  interaction.player = forSetup.mode === "maquina" ? forSetup.player : null;
  return interaction;
}

// --- Pintar ------------------------------------------------------------------

/** Partida que hay pintada: con una partida nueva (o recuperada) el tablero cambia de golpe, sin animar. */
let drawnGame: Game | null = null;

function render(): void {
  view.setOrientation(ui.orientation);
  // La vista de la posición de antes se cierra sola si la partida cambia (jugada de la máquina, deshacer…).
  if (peek !== null && (peek.gameFen !== game.fen || game !== drawnGame)) closePeek(false, true);
  else paintBoard();
  captures.render(game.history, ui.orientation);
  renderCoach();
  renderHints();
  applyMarks();
  syncTabIndex();
  renderStatus();
  renderMoveList();
  const undoPossible = setup.mode === "maquina" ? undoTarget(game, setup.player) !== null : game.ply > 0;
  const redoPossible = setup.mode === "maquina" ? redoTarget(game, setup.player) !== null : game.canRedo;
  undoButton.disabled = thinking || !undoPossible;
  redoButton.disabled = thinking || !redoPossible;
  autosave(game, ui.orientation, setup);
  if (exportedFen !== null && exportedFen !== game.fen) hideExportNotice();
  maybeThink();
}

const coachRoot = byId<HTMLElement>("coach");

// Capturas bajo el tablero; en móvil apaisado van al principio del panel con scroll.
const captures = createCapturesView(byId<HTMLElement>("capturas-contenido"));
placeCapturesInLandscape(byId<HTMLElement>("capturas"), byId<HTMLElement>("partida-izq"), () => byId<HTMLElement>("partida-panel").prepend(byId<HTMLElement>("capturas")));

// Móvil apaisado: el panel (coach, botones y jugadas) y el de las lecciones tienen scroll propio.
// Al girar el móvil el coach aparece o desaparece sin que cambie la partida, así que se vuelve a revisar.
bindScrollRegion(byId<HTMLElement>("partida-panel"), "Capturas, coach, botones y jugadas");
bindScrollRegion(byId<HTMLElement>("leccion-panel"), "Retroalimentación, pistas y acciones");
onCompactLandscapeChange(() => renderCoach());

function renderCoach(): void {
  if (coachMarks.length > 0 && coachMarksFen !== game.fen) coachPanel.clearMarks();
  // Con el panel oculto (pantalla de ajustes, móvil apaisado) no se gasta CPU en revisar; al volver a verse se repinta.
  if (coachRoot.getClientRects().length === 0) {
    coachKey = null;
    coachToken++;
    coachClient?.cancel();
    return;
  }
  const job = reviewJob(game, setup.mode === "maquina" ? setup.player : null);
  const key = job === null ? "" : reviewKey(job);
  // «Jugada anterior»: la máquina ya ha respondido a la jugada que se revisa (CAL-390).
  const note = job !== null && job.previous ? previousNote(!game.isOver && setup.mode === "maquina" && game.turn === setup.player) : null;
  if (key === coachKey) {
    // El panel ya enseña esta jugada: no se repinta (ni se pierden los avisos abiertos ni se repite el veredicto).
    if (note !== coachNote) {
      coachNote = note;
      coachPanel.setPrevious(note);
    }
    return;
  }
  coachKey = key;
  shownReport = null;
  coachNote = note;
  coachPanel.setPrevious(note);
  const token = ++coachToken;
  coachClient?.cancel();
  if (job === null) {
    coachPanel.showEmpty();
    return;
  }
  /** Un fallo no deja la partida sin pintar y se reintenta en el próximo repintado. */
  const fail = (): void => {
    coachKey = null;
    coachPanel.showFailed(job.label);
  };
  try {
    const cached = coachCache.get(key);
    if (cached !== undefined) {
      showCoachReport(cached, job);
      return;
    }
    coachPanel.showReviewing(job.label);
    coachClient ??= createCoachClient();
    coachClient.analyze(job).then(
      (report) => {
        if (token !== coachToken) return;
        try {
          if (coachCache.size >= 300) coachCache.clear();
          coachCache.set(key, report);
          showCoachReport(report, job);
        } catch {
          fail();
        }
      },
      (error: unknown) => {
        if (token !== coachToken || error instanceof EngineCancelledError) return;
        fail();
      },
    );
  } catch {
    fail();
  }
}

function showCoachReport(report: CoachReport, job: ReviewJob): void {
  const shown = reportView(report, job.label);
  shownReport = { view: shown, job };
  coachPanel.showReport(shown);
}

// Al girar el móvil el panel puede pasar de oculto a visible (y al revés).
window.matchMedia("(orientation: landscape) and (max-height: 500px)").addEventListener("change", () => renderCoach());

/** Tabindex itinerante: solo la casilla con el foco entra en el orden de tabulación. */
function syncTabIndex(): void {
  for (const cell of view.element.querySelectorAll<HTMLElement>("[data-square]")) {
    cell.tabIndex = cell.dataset["square"] === ui.focus ? 0 : -1;
  }
}

/** Resultado a la vista en el último pintado: `undefined` hasta el primero (así no se celebra al abrir una partida terminada). */
let shownResult: ResultKind | null | undefined;
/** Partida cuya victoria ya se celebró (o que se abrió ya ganada): no se celebra dos veces. */
let celebratedGame: Game | null = null;

function renderStatus(): void {
  // Al terminar, el escaque es el de quien gana (o partido en dos, en tablas), no el del turno.
  const status = game.status;
  const swatch = status.kind === "ongoing" ? game.turn : status.kind === "checkmate" ? status.winner : "azar";
  statusTurn.className = `estado__turno estado__turno--${swatch}`;
  const result = setup.mode === "maquina" ? resultView(game.status, setup.player) : null;
  // Dos jugadores: en el mismo dispositivo siempre «te toca», así que no hay etiqueta.
  const humanTurn = setup.mode === "dos" || game.turn === setup.player;
  const parts = machineStatusParts(game.status, game.turn, game.inCheck, humanTurn, thinkingVisible);
  const finished = setup.mode === "maquina" ? null : finishedParts(game.status);
  statusText.textContent = finished?.title ?? parts.text;
  statusCause.textContent = finished === null ? "" : ` ${finished.text}`;
  statusYourTurn.hidden = !(setup.mode === "maquina" && parts.yourTurn);
  statusCheck.hidden = !parts.check;
  // La etiqueta «Jaque» se lee solo cuando el texto no lo dice ya («sal del jaque»).
  statusCheck.setAttribute("aria-hidden", String(parts.yourTurn));
  // Con la máquina, los anuncios los da la región `#anuncio`: así no se leen dos veces.
  if (setup.mode === "maquina") statusBox.setAttribute("aria-live", "off");
  else statusBox.removeAttribute("aria-live");
  if (ui.pendingPromotion !== null) statusExtra.textContent = " Elige la pieza para coronar.";
  else if (machineFailed) statusExtra.textContent = ` ${ENGINE_NAME} no ha podido elegir jugada. Prueba con «Deshacer jugada» o empieza otra partida.`;
  else statusExtra.textContent = "";
  statusBox.classList.toggle("estado--fin", game.isOver);
  statusBox.classList.toggle("estado--jaque", parts.check);
  statusBox.classList.toggle("estado--pensando", thinkingVisible);
  thinkingBar.hidden = !thinkingVisible;
  // Al terminar contra la máquina, el resultado ocupa el lugar del estado.
  statusBox.hidden = result !== null;
  resultBox.hidden = result === null;
  const kind = result?.kind ?? null;
  if (result !== null) {
    resultTitle.textContent = result.title;
    resultText.textContent = result.text;
    resultKicker.textContent = result.kicker;
    resultBox.dataset["resultado"] = result.kind;
    if (kind !== shownResult) setSeal(resultSeal, sealKindFor(result.kind));
  }
  if (shouldCelebrate(shownResult, kind, celebratedGame === game)) celebrate(resultSeal, prefersReducedMotion());
  if (kind === "gana") celebratedGame = game;
  shownResult = kind;
  newGameButton.classList.toggle("boton--principal", result === null);
  renderHeading();
}

function renderHeading(): void {
  if (setup.mode === "maquina") {
    const level = LEVEL_NAME[setup.level];
    headingLong.textContent = machineHeading(level, false);
    headingShort.textContent = machineHeading(level, true);
    statusLevel.textContent = `Contra ${machineHeading(level, true)}`;
  } else {
    headingLong.textContent = "Partida a dos jugadores en este dispositivo";
    headingShort.textContent = "Dos jugadores";
    statusLevel.textContent = "Dos jugadores";
  }
}

function moveButton(entry: { readonly san: string; readonly ply: number }, label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "jugada";
  button.textContent = entry.san;
  button.dataset["ply"] = String(entry.ply);
  button.setAttribute("aria-label", `${label}: ${entry.san}`);
  if (entry.ply === game.ply) button.setAttribute("aria-current", "true");
  return button;
}

function renderMoveList(): void {
  const rows = game.moveList();
  noMoves.hidden = rows.length > 0;
  moveList.hidden = rows.length === 0; // sin «lista vacía» para los lectores de pantalla
  const items = rows.map((row) => {
    const item = document.createElement("li");
    // El diseño pone display:contents en los li, y algunos lectores pierden entonces el rol de elemento de lista.
    item.setAttribute("role", "listitem");
    const number = document.createElement("span");
    number.className = "jugadas__n";
    number.textContent = `${row.number}.`;
    item.append(number);
    if (row.white !== null) item.append(moveButton(row.white, `${row.number}, blancas`));
    else {
      // Partida que empieza con las negras: hueco en la columna de las blancas.
      const gap = document.createElement("span");
      gap.setAttribute("aria-hidden", "true");
      gap.textContent = "…";
      item.append(gap);
    }
    if (row.black !== null) item.append(moveButton(row.black, `${row.number}, negras`));
    return item;
  });
  moveList.replaceChildren(...items);
}

function focusBoard(): void {
  view.squareElement(ui.focus).focus({ preventScroll: true });
}

function announce(text: string): void {
  announcer.textContent = text;
}

// --- La máquina ----------------------------------------------------------------

/** Añade al anuncio cómo ha acabado la partida, si contra la máquina ya ha acabado. */
function withResult(text: string): string {
  const result = setup.mode === "maquina" ? resultMessage(game.status, setup.player) : null;
  return result === null ? text : `${text} ${result.title} ${result.text}`;
}

function finishThinking(): void {
  thinking = false;
  thinkingVisible = false;
  if (thinkingTimer !== null) clearTimeout(thinkingTimer);
  thinkingTimer = null;
}

/** Descarta lo que la máquina esté pensando: su respuesta, si llega, se ignora. */
function stopThinking(): void {
  generation++;
  finishThinking();
  engine?.cancel();
}

/** Si le toca a la máquina y no está ya pensando, le pide su jugada. */
function maybeThink(): void {
  if (setup.mode !== "maquina" || thinking || machineFailed || game.isOver || game.canRedo || game.turn === setup.player) return;
  const token = ++generation;
  const { level } = setup;
  thinking = true;
  engine ??= createEngineClient();
  thinkingTimer = setTimeout(() => {
    if (token !== generation) return;
    thinkingVisible = true;
    renderStatus();
    announce(`${ENGINE_NAME} está pensando.`);
  }, THINKING_DELAY_MS);
  requestMachineMove(engine, game, level).then(
    (move) => {
      if (token !== generation) return;
      finishThinking();
      const record = move === null ? null : game.play(move.from, move.to, move.promotion);
      if (record === null) {
        machineFailed = !game.isOver;
        render();
        return;
      }
      announce(withResult(machineMoveAnnouncement(record.san, statusMessage(game.status, game.turn, game.inCheck))));
      render();
    },
    () => {
      if (token !== generation) return;
      finishThinking();
      machineFailed = true;
      announce(`${ENGINE_NAME} no ha podido elegir jugada.`);
      render();
    },
  );
}

// --- Resultados --------------------------------------------------------------

function handle(outcome: Outcome): void {
  switch (outcome.kind) {
    case "focus":
      // Solo se mueve el foco: no hace falta repintar nada más.
      syncTabIndex();
      return;
    case "moved":
      ui.focus = outcome.record.to;
      announce(withResult(moveAnnouncement(outcome.record)));
      break;
    case "undone":
      announce(`Jugada deshecha: ${sanToSpanish(outcome.record.san)}.`);
      break;
    case "redone":
      announce(moveAnnouncement(outcome.record));
      break;
    case "jumped": {
      const last = game.history[game.ply - 1];
      announce(last === undefined ? "Posición inicial." : `Posición tras ${sanToSpanish(last.san)}.`);
      break;
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

// --- Coronación ----------------------------------------------------------------

function openPromotion(): void {
  promotion.open(game.turn, {
    choose: (piece) => closePromotion(() => ui.choosePromotion(piece)),
    cancel: () => closePromotion(() => ui.cancel()),
  });
}

function closePromotion(action: () => Outcome): void {
  const origin = ui.pendingPromotion?.from;
  const outcome = action();
  promotion.close();
  if (outcome.kind === "deselected" && origin !== undefined) ui.focus = origin;
  handle(outcome);
  focusBoard();
}

// --- Tablero: clic, arrastre y teclado -----------------------------------------

attachBoardInput({
  view,
  interaction: () => ui,
  handle,
  render,
  focusBoard,
  syncTabIndex,
  promotionOpen: () => promotion.isOpen,
  // Viendo la posición de antes de la jugada revisada no se mueve (CAL-394).
  enabled: () => peek === null,
});

// --- Lista de jugadas y botones -------------------------------------------------

moveList.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("[data-ply]");
  if (button === null) return;
  jumpTo(Number(button.dataset["ply"]));
  moveList.querySelector<HTMLButtonElement>(`[data-ply="${game.ply}"]`)?.focus();
});

/** Salta a una jugada de la lista. Contra la máquina no se queda el tablero en un turno suyo ni antes de tu primera jugada. */
function jumpTo(ply: number): void {
  if (setup.mode === "maquina") {
    machineFailed = false;
    stopThinking();
    handle(ui.goTo(Math.max(ply, minPly(game, setup.player))));
    normalizePly(game, setup.player);
    render();
    return;
  }
  handle(ui.goTo(ply));
}

/** Empieza una partida con estos ajustes (el azar ya está decidido). */
function startGame(next: GameSetup): void {
  stopThinking();
  hideExportNotice(); // el aviso era de la partida anterior
  machineFailed = false;
  setup = next;
  game = new Game();
  ui = newInteraction(game, setup);
  if (setup.mode === "maquina") {
    ui.orientation = setup.player;
    ui.focusKing(setup.player);
  }
  announce(setup.mode === "maquina" && setup.player === "b" ? `Nueva partida. Juegas con las negras.` : "Nueva partida.");
  showScreen("partida"); // pinta la partida al enseñarla
  if (setup.mode === "maquina") focusBoard();
}

// --- Ajustes -------------------------------------------------------------------

/** Pantalla de jugar que toca enseñar cuando la ruta es «jugar»: la de ajustes o la de la partida. */
let playScreen: "ajustes" | "partida" | "repaso" = "ajustes";
let route: Route = parseRoute(location.hash);
/** ¿Se están enseñando las lecciones? Así se sabe cuándo se vuelve de ellas. */
let onLessons = false;
const BASE_TITLE = document.title;

function showScreen(screen: "ajustes" | "partida" | "repaso"): void {
  playScreen = screen;
  applyRoute(false);
}

/** Enseña la pantalla que toca según la ruta (el fragmento de la URL). */
function applyRoute(moveFocus: boolean): void {
  route = parseRoute(location.hash);
  const onPlay = route.kind === "jugar";
  settingsScreen.hidden = !onPlay || playScreen !== "ajustes";
  gameScreen.hidden = !onPlay || playScreen !== "partida";
  reviewScreenRoot.hidden = !onPlay || playScreen !== "repaso";
  // El subtítulo describe la partida en curso: no vale para una partida cargada.
  headingSub.hidden = !(onPlay && playScreen !== "ajustes" && !(playScreen === "repaso" && imported !== null));
  if (!onPlay || playScreen !== "repaso") review.hide();
  linkPlay.removeAttribute("aria-current");
  linkLessons.removeAttribute("aria-current");
  (onPlay ? linkPlay : linkLessons).setAttribute("aria-current", "page");
  if (onPlay) {
    lessonsScreen.hide();
    syncBeginnerNotice();
    document.title = BASE_TITLE;
    // Al enseñar la partida (nueva, recuperada o de vuelta de las lecciones) se pinta y se reanuda lo que hubiera:
    // el coach y, si le toca, la máquina.
    if (playScreen === "partida") render();
    if (playScreen === "repaso") {
      stopCoach();
      stopThinking(); // al volver a la partida, render() reanuda a la máquina si le toca
      if (imported !== null) review.open(imported.game, "w", { kind: "pgn", intro: imported.intro });
      else review.open(game, ui.orientation);
    }
    onLessons = false;
    return;
  }
  onLessons = true;
  // Al irse a las lecciones se suelta lo que hubiera a medias en el tablero (selección, coronación, el diálogo) y
  // la máquina deja de pensar y el coach de revisar; al volver se retoman.
  promotion.close();
  ui.cancel();
  stopThinking();
  coachToken++;
  coachKey = null;
  coachClient?.cancel();
  closePeek(false, true);
  hintsGame = null; // al volver, las pistas empiezan de cero
  hintToken++;
  hintClient?.cancel();
  const shown = route.kind === "leccion" ? lessonsScreen.showLesson(route.id, moveFocus) : lessonsScreen.showList(moveFocus);
  document.title = shown === null || route.kind !== "leccion" ? `${LESSONS_TITLE} · Escaque` : `${shown} · ${LESSONS_TITLE} · Escaque`;
}

function checkedValue(name: string): string | undefined {
  return settingsForm.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value;
}

/** Con «Dos jugadores» desaparecen nivel y color. */
function syncSettingsGroups(): void {
  const twoPlayers = checkedValue("modo") === "dos";
  levelGroup.hidden = twoPlayers;
  colorGroup.hidden = twoPlayers;
}

function fillSettings(choice: SetupChoice): void {
  for (const [name, value] of [["modo", choice.mode], ["nivel", choice.level], ["color", choice.color]] as const) {
    for (const input of settingsForm.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)) input.checked = input.value === value;
  }
  syncSettingsGroups();
}

function openSettings(): void {
  stopThinking();
  stopCoach();
  fillSettings(choiceOf(setup));
  showScreen("ajustes");
  settingsForm.querySelector<HTMLInputElement>('input[name="modo"]:checked')?.focus();
}

settingsForm.addEventListener("change", syncSettingsGroups);
settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const choice = parseChoice({ mode: checkedValue("modo"), level: checkedValue("nivel"), color: checkedValue("color") });
  startGame(resolveSetup(choice));
});

// Con una partida a medias se pide confirmación; el foco empieza en «Seguir jugando», la opción segura.
// Si no hay jugadas, o la partida ya terminó, no hay nada que perder.
newGameButton.addEventListener("click", () => {
  if (game.totalPlies === 0 || game.isOver) {
    openSettings();
    return;
  }
  confirmText.textContent = newGameWarning(game.totalPlies);
  confirmDialog.showModal();
  keepPlayingButton.focus();
});

reviewButton.addEventListener("click", () => showScreen("repaso"));

// --- PGN: exportar la partida a la vista y cargar una para repasarla ---------

exportPgnButton.addEventListener("click", () => {
  const { filename, text } = exportGame(game, setup, new Date());
  const url = URL.createObjectURL(new Blob([text], { type: "application/x-chess-pgn" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  // Se libera después: algunos navegadores leen el blob tras el clic.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  exportedFen = game.fen;
  exportFile.textContent = filename;
  exportNotice.hidden = false;
  announce(`Partida descargada como ${filename}.`);
});

function hideExportNotice(): void {
  exportedFen = null;
  exportNotice.hidden = true;
}

function showPgnError(message: string): void {
  pgnErrorText.textContent = message;
  pgnError.hidden = false;
  pgnField.setAttribute("aria-invalid", "true");
  pgnField.setAttribute("aria-describedby", "pgn-ayuda pgn-error");
}

function clearPgnError(): void {
  pgnError.hidden = true;
  pgnErrorText.textContent = "";
  pgnField.removeAttribute("aria-invalid");
  pgnField.setAttribute("aria-describedby", "pgn-ayuda");
}

loadPgnButton.addEventListener("click", () => {
  clearPgnError();
  pgnDialog.showModal();
  pgnField.focus();
});

function closePgnDialog(): void {
  pgnFileToken++; // una lectura de archivo a medias ya no escribe en el campo
  pgnDialog.close();
  loadPgnButton.focus();
}

pgnCancel.addEventListener("click", closePgnDialog);
pgnDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closePgnDialog();
});

pgnChoose.addEventListener("click", () => pgnFile.click());
pgnFile.addEventListener("change", () => {
  const file = pgnFile.files?.[0];
  pgnFile.value = ""; // el mismo archivo se puede volver a elegir
  if (file === undefined) return;
  clearPgnError();
  pgnFileName.textContent = file.name;
  if (fileTooLarge(file.size)) {
    showPgnError(PGN_TEXT.tooLarge);
    return;
  }
  const token = ++pgnFileToken;
  file.text().then(
    (text) => {
      if (token !== pgnFileToken) return;
      pgnField.value = text;
      pgnField.focus();
    },
    () => {
      if (token === pgnFileToken) showPgnError(PGN_TEXT.unreadable);
    },
  );
});

pgnLoad.addEventListener("click", () => {
  let next: { game: Game; intro: string };
  try {
    const pgn = parsePgn(pgnField.value);
    const { game: loaded, cut } = gameFromPgn(pgn);
    next = { game: loaded, intro: importIntro(pgn, cut) };
  } catch (error) {
    showPgnError(loadError(error));
    return;
  }
  clearPgnError();
  pgnFileToken++;
  pgnDialog.close();
  imported = next;
  showScreen("repaso");
});

// La revancha repite modo, nivel y color.
rematchButton.addEventListener("click", () => startGame(setup.mode === "maquina" ? { ...setup } : setup));

function closeConfirm(start: boolean): void {
  confirmDialog.close();
  if (start) openSettings();
  else newGameButton.focus();
}

keepPlayingButton.addEventListener("click", () => closeConfirm(false));
startButton.addEventListener("click", () => closeConfirm(true));
// Escape equivale a seguir jugando.
confirmDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeConfirm(false);
});

rotateButton.addEventListener("click", () => {
  ui.orientation = ui.orientation === "w" ? "b" : "w";
  announce(`Tablero visto desde las ${ui.orientation === "w" ? "blancas" : "negras"}.`);
  render();
});

undoButton.addEventListener("click", () => {
  if (setup.mode === "maquina") {
    const target = undoTarget(game, setup.player);
    if (target === null) return;
    machineFailed = false;
    const steps = game.ply - target;
    handle(ui.goTo(target));
    announce(steps === 1 ? "Jugada deshecha." : "Jugadas deshechas.");
  } else handle(ui.undo());
  if (undoButton.disabled) redoButton.focus();
});

redoButton.addEventListener("click", () => {
  if (setup.mode === "maquina") {
    const target = redoTarget(game, setup.player);
    if (target === null) return;
    const steps = target - game.ply;
    handle(ui.goTo(target));
    announce(steps === 1 ? "Jugada rehecha." : "Jugadas rehechas.");
  } else handle(ui.redo());
  if (redoButton.disabled) undoButton.focus();
});

window.addEventListener("hashchange", () => applyRoute(true));

if (recovered !== null) {
  // Una partida contra la máquina guardada en pleno turno suyo se retoma: piensa y juega.
  if (setup.mode === "maquina") normalizePly(game, setup.player);
  showScreen("partida"); // pinta la partida al enseñarla
  if (game.totalPlies > 0) announce("Partida recuperada.");
} else {
  fillSettings(DEFAULT_CHOICE);
  showScreen("ajustes");
}

// App instalable: service worker y avisos de instalar, sin conexión y versión nueva.
// El aviso de instalar vive en la pantalla de inicio; si desaparece al pulsarlo, el foco pasa al título de la pantalla.
startPwa(byId("avisos"), byId("aviso-instalar"), () => settingsTitle.focus());
