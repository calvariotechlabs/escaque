// Pantallas de Escaque: ajustes de la partida y partida (a dos jugadores en el
// mismo dispositivo o contra la máquina, Alfil Beta en un Worker).
// Traduce clics, arrastres y teclas a llamadas de `Interaction` y pinta el
// resultado con `BoardView`. Todo el texto se escribe con textContent o
// atributos, nunca como HTML. La carga el navegador como módulo ES nativo.
import { START_FEN } from "../core/index.js";
import { attachBoardInput } from "./board-input.js";
import { createBoard } from "./board.js";
import { Game } from "./game.js";
import { Interaction, type Outcome } from "./interaction.js";
import { minPly, normalizePly, redoTarget, requestMachineMove, undoTarget } from "./machine.js";
import {
  ENGINE_NAME,
  machineHeading,
  machineMoveAnnouncement,
  machineStatusMessage,
  moveAnnouncement,
  newGameWarning,
  resultMessage,
  sanToSpanish,
  statusMessage,
} from "./notation.js";
import { createPromotionDialog } from "./promotion.js";
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
import { reportView, reviewJob, reviewKey, withCoachMarks } from "./coach.js";
import { createCoachPanel } from "./coach-panel.js";
import { createEngineClient, EngineCancelledError } from "../worker/client.js";
import { createCoachClient } from "../worker/coach-client.js";
import { startPwa } from "../pwa/pwa.js";
import { checkLessonMove, LESSONS } from "../lessons/index.js";
import { createLessonsScreen } from "./lessons-screen.js";
import { dismissBeginner, isBeginnerDismissed, showBeginnerNotice } from "./lessons-progress.js";
import { LESSONS_TITLE } from "./lessons-text.js";
import { parseRoute, type Route } from "./routes.js";
import { bindScrollRegion, onCompactLandscapeChange } from "./scroll-region.js";

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Falta el elemento #${id}`);
  return el as T;
}

const settingsScreen = byId<HTMLElement>("pantalla-ajustes");
const gameScreen = byId<HTMLElement>("pantalla-partida");
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
const resultText = byId<HTMLElement>("resultado-texto");
const rematchButton = byId<HTMLButtonElement>("revancha");
const statusBox = byId<HTMLParagraphElement>("estado");
const statusTurn = byId<HTMLSpanElement>("estado-turno");
const statusText = byId<HTMLElement>("estado-texto");
const statusExtra = byId<HTMLSpanElement>("estado-extra");
const newGameButton = byId<HTMLButtonElement>("nueva");
const rotateButton = byId<HTMLButtonElement>("girar");
const undoButton = byId<HTMLButtonElement>("deshacer");
const redoButton = byId<HTMLButtonElement>("rehacer");
const confirmDialog = byId<HTMLDialogElement>("confirmar-nueva");
const confirmText = byId<HTMLParagraphElement>("texto-confirmar");
const keepPlayingButton = byId<HTMLButtonElement>("seguir-jugando");
const startButton = byId<HTMLButtonElement>("empezar");
const moveList = byId<HTMLOListElement>("lista-jugadas");
const noMoves = byId<HTMLParagraphElement>("sin-jugadas");
const announcer = byId<HTMLParagraphElement>("anuncio");
const promotionDialog = byId<HTMLDialogElement>("coronacion");
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
/** Posición en la que se pidieron las marcas de «Ver en el tablero»: si cambia, se quitan. */
let coachMarksFen = "";
const coachPanel = createCoachPanel((marks) => {
  coachMarks = marks;
  coachMarksFen = game.fen;
  applyMarks();
});

function applyMarks(): void {
  view.setMarks(withCoachMarks(ui.marks(), coachMarks));
}

function newInteraction(forGame: Game, forSetup: GameSetup): Interaction {
  const interaction = new Interaction(forGame);
  interaction.player = forSetup.mode === "maquina" ? forSetup.player : null;
  return interaction;
}

// --- Pintar ------------------------------------------------------------------

function render(): void {
  view.setOrientation(ui.orientation);
  view.setPosition(game.fen);
  renderCoach();
  applyMarks();
  syncTabIndex();
  renderStatus();
  renderMoveList();
  const undoPossible = setup.mode === "maquina" ? undoTarget(game, setup.player) !== null : game.ply > 0;
  const redoPossible = setup.mode === "maquina" ? redoTarget(game, setup.player) !== null : game.canRedo;
  undoButton.disabled = thinking || !undoPossible;
  redoButton.disabled = thinking || !redoPossible;
  autosave(game, ui.orientation, setup);
  maybeThink();
}

const coachRoot = byId<HTMLElement>("coach");

// Móvil apaisado: el panel (coach, botones y jugadas) y el de las lecciones tienen scroll propio.
// Al girar el móvil el coach aparece o desaparece sin que cambie la partida, así que se vuelve a revisar.
bindScrollRegion(byId<HTMLElement>("partida-panel"), "Coach, botones y jugadas");
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
  if (key === coachKey) return; // el panel ya enseña esta jugada: no se repinta (ni se pierden los avisos abiertos)
  coachKey = key;
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
      coachPanel.showReport(reportView(cached, job.label));
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
          coachPanel.showReport(reportView(report, job.label));
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

// Al girar el móvil el panel puede pasar de oculto a visible (y al revés).
window.matchMedia("(orientation: landscape) and (max-height: 500px)").addEventListener("change", () => renderCoach());

/** Tabindex itinerante: solo la casilla con el foco entra en el orden de tabulación. */
function syncTabIndex(): void {
  for (const cell of view.element.querySelectorAll<HTMLElement>("[data-square]")) {
    cell.tabIndex = cell.dataset["square"] === ui.focus ? 0 : -1;
  }
}

function renderStatus(): void {
  statusTurn.className = `estado__turno estado__turno--${game.turn}`;
  const result = setup.mode === "maquina" ? resultMessage(game.status, setup.player) : null;
  if (setup.mode === "maquina") {
    statusText.textContent = machineStatusMessage(game.status, game.turn, game.inCheck, game.turn === setup.player, thinkingVisible);
    // Con la máquina, los anuncios los da la región `#anuncio`: así no se leen dos veces.
    statusBox.setAttribute("aria-live", "off");
  } else {
    statusText.textContent = statusMessage(game.status, game.turn, game.inCheck);
    statusBox.removeAttribute("aria-live");
  }
  if (ui.pendingPromotion !== null) statusExtra.textContent = " Elige la pieza para coronar.";
  else if (machineFailed) statusExtra.textContent = ` ${ENGINE_NAME} no ha podido elegir jugada. Prueba con «Deshacer jugada» o empieza otra partida.`;
  else statusExtra.textContent = "";
  statusBox.classList.toggle("estado--fin", game.isOver);
  statusBox.classList.toggle("estado--pensando", thinkingVisible);
  thinkingBar.hidden = !thinkingVisible;
  // Al terminar contra la máquina, el resultado ocupa el lugar del estado.
  statusBox.hidden = result !== null;
  resultBox.hidden = result === null;
  if (result !== null) {
    resultTitle.textContent = result.title;
    resultText.textContent = result.text;
  }
  newGameButton.classList.toggle("boton--principal", result === null);
  renderHeading();
}

function renderHeading(): void {
  if (setup.mode === "maquina") {
    const level = LEVEL_NAME[setup.level];
    headingLong.textContent = machineHeading(level, false);
    headingShort.textContent = machineHeading(level, true);
  } else {
    headingLong.textContent = "Partida a dos jugadores en este dispositivo";
    headingShort.textContent = "Dos jugadores";
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
let playScreen: "ajustes" | "partida" = "ajustes";
let route: Route = parseRoute(location.hash);
/** ¿Se están enseñando las lecciones? Así se sabe cuándo se vuelve de ellas. */
let onLessons = false;
const BASE_TITLE = document.title;

function showScreen(screen: "ajustes" | "partida"): void {
  playScreen = screen;
  applyRoute(false);
}

/** Enseña la pantalla que toca según la ruta (el fragmento de la URL). */
function applyRoute(moveFocus: boolean): void {
  route = parseRoute(location.hash);
  const onPlay = route.kind === "jugar";
  settingsScreen.hidden = !onPlay || playScreen !== "ajustes";
  gameScreen.hidden = !onPlay || playScreen !== "partida";
  headingSub.hidden = !(onPlay && playScreen === "partida");
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
  coachToken++;
  coachKey = null;
  coachClient?.cancel();
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
startPwa(byId("avisos"));
