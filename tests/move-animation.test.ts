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
