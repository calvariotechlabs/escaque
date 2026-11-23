import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { planMoveAnimation } from "../src/ui/move-animation.js";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
const ITALIANA = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R";
const TRAS_BXF7 = "r1bqkbnr/pppp1Bpp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQK2R";

describe("planMoveAnimation", () => {
  test("una jugada normal desliza la pieza de su casilla a la de destino", () => {
    const plan = planMoveAnimation(START, "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R");
    assert.deepEqual(plan, {
      slides: [{ from: "g1", to: "f3", piece: { color: "w", type: "n" } }],
      fades: [],
      appears: [],
      promotion: null,
    });
  });

  test("en una captura la capturada se desvanece en la casilla de destino", () => {
    const plan = planMoveAnimation(ITALIANA, TRAS_BXF7);
    assert.deepEqual(plan?.slides, [{ from: "c4", to: "f7", piece: { color: "w", type: "b" } }]);
    assert.deepEqual(plan?.fades, [{ square: "f7", piece: { color: "b", type: "p" } }]);
  });

  test("en la captura al paso se desvanece el peón de al lado", () => {
    const plan = planMoveAnimation("rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR", "rnbqkbnr/ppp1p1pp/5P2/3p4/8/8/PPPP1PPP/RNBQKBNR");
    assert.deepEqual(plan?.slides, [{ from: "e5", to: "f6", piece: { color: "w", type: "p" } }]);
    assert.deepEqual(plan?.fades, [{ square: "f5", piece: { color: "b", type: "p" } }]);
  });

  test("en el enroque el rey y la torre se deslizan a la vez", () => {
    const plan = planMoveAnimation(ITALIANA, "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1");
    assert.deepEqual(
      plan?.slides.map((s) => `${s.from}${s.to}`).sort(),
      ["e1g1", "h1f1"],
    );
    assert.deepEqual(plan?.fades, []);
  });

  test("deshacer el enroque también desliza rey y torre", () => {
    const plan = planMoveAnimation("r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1", ITALIANA);
    assert.deepEqual(plan?.slides.map((s) => `${s.from}${s.to}`).sort(), ["f1h1", "g1e1"]);
  });

  test("en la coronación el peón viaja y se convierte en la pieza elegida al llegar", () => {
    const plan = planMoveAnimation("8/4P3/8/8/8/2k5/8/4K3", "4Q3/8/8/8/8/2k5/8/4K3");
    assert.deepEqual(plan, {
      slides: [{ from: "e7", to: "e8", piece: { color: "w", type: "p" } }],
      fades: [],
      appears: [],
      promotion: { square: "e8", piece: { color: "w", type: "q" } },
    });
  });

  test("una coronación con captura desvanece la capturada", () => {
    const plan = planMoveAnimation("3r4/4P3/8/8/8/2k5/8/4K3", "3N4/8/8/8/8/2k5/8/4K3");
    assert.deepEqual(plan?.slides, [{ from: "e7", to: "d8", piece: { color: "w", type: "p" } }]);
    assert.deepEqual(plan?.fades, [{ square: "d8", piece: { color: "b", type: "r" } }]);
    assert.deepEqual(plan?.promotion, { square: "d8", piece: { color: "w", type: "n" } });
  });

  test("las negras coronan en la primera fila", () => {
    const plan = planMoveAnimation("4k3/8/8/8/8/8/3p4/K7", "4k3/8/8/8/8/8/8/K2q4");
    assert.deepEqual(plan?.slides, [{ from: "d2", to: "d1", piece: { color: "b", type: "p" } }]);
    assert.deepEqual(plan?.promotion, { square: "d1", piece: { color: "b", type: "q" } });
  });

  test("deshacer una captura devuelve la pieza y hace reaparecer la capturada", () => {
    const plan = planMoveAnimation(TRAS_BXF7, ITALIANA);
    assert.deepEqual(plan?.slides, [{ from: "f7", to: "c4", piece: { color: "w", type: "b" } }]);
    assert.deepEqual(plan?.appears, [{ square: "f7", piece: { color: "b", type: "p" } }]);
    assert.deepEqual(plan?.fades, []);
  });

  test("deshacer una coronación devuelve un peón desde la casilla de coronación", () => {
    const plan = planMoveAnimation("4Q3/8/8/8/8/2k5/8/4K3", "8/4P3/8/8/8/2k5/8/4K3");
    assert.deepEqual(plan?.slides, [{ from: "e8", to: "e7", piece: { color: "w", type: "p" } }]);
    assert.equal(plan?.promotion, null);
  });

  test("la misma posición no se anima", () => {
    assert.equal(planMoveAnimation(START, START), null);
  });

  test("dos jugadas de golpe (deshacer contra la máquina, saltos del repaso) no se animan", () => {
    assert.equal(planMoveAnimation(START, "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR"), null);
    assert.equal(planMoveAnimation(START, "rnbqkbnr/pppppppp/8/8/8/2N2N2/PPPPPPPP/R1BQKB1R"), null);
  });

  test("una posición nueva sin relación (nueva partida, cargar un PGN) no se anima", () => {
    assert.equal(planMoveAnimation(TRAS_BXF7, START), null);
    assert.equal(planMoveAnimation("8/8/8/8/8/8/8/8", START), null);
  });

  test("acepta FEN completas, no solo la colocación", () => {
    const plan = planMoveAnimation(`${START} w KQkq - 0 1`, "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1");
    assert.equal(plan?.slides.length, 1);
  });
});

import { FADE_MS, MOVE_EASING, MOVE_MS, captureFrames, promotionFrames, revealFrames, slideFrames } from "../src/ui/move-animation.js";

describe("tiempos y fotogramas del lienzo", () => {
  test("200 ms de recorrido con la curva que frena al llegar; fundidos de 120 ms", () => {
    assert.equal(MOVE_MS, 200);
    assert.equal(FADE_MS, 120);
    assert.equal(MOVE_EASING, "cubic-bezier(0.16, 1, 0.3, 1)");
  });

  test("la pieza sale desplazada hasta su casilla de origen y termina en su sitio", () => {
    assert.deepEqual(slideFrames(-40, 80), [{ transform: "translate(-40px, 80px)" }, { transform: "translate(0px, 0px)" }]);
  });

  test("la capturada sigue entera hasta que faltan 120 ms y luego se desvanece encogiendo", () => {
    const frames = captureFrames();
    assert.deepEqual(frames[0], { opacity: 1, transform: "scale(1)", offset: 0 });
    assert.deepEqual(frames[1], { opacity: 1, transform: "scale(1)", offset: (MOVE_MS - FADE_MS) / MOVE_MS });
    assert.deepEqual(frames[2], { opacity: 0, transform: "scale(0.8)", offset: 1 });
  });

  test("lo que aparece (deshacer una captura, movimiento reducido) va de transparente a visible", () => {
    assert.deepEqual(revealFrames(), [{ opacity: 0 }, { opacity: 1 }]);
  });

  test("coronación: el peón se desvanece y la pieza nueva aparece después del recorrido", () => {
    const { pawn, piece, duration } = promotionFrames();
    assert.equal(duration, MOVE_MS + FADE_MS);
    const arrive = MOVE_MS / (MOVE_MS + FADE_MS);
    assert.deepEqual(pawn, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: arrive }, { opacity: 0, offset: 1 }]);
    assert.deepEqual(piece, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: arrive }, { opacity: 1, offset: 1 }]);
  });
});
