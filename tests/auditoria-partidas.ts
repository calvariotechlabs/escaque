// Partidas de las dos auditorías externas (24-nov-2026), en UCI, para las
// pruebas del coach (coherencia, B1, y calidad del análisis, B3).
import { Position, START_FEN, moveToUci } from "../src/core/index.js";

const LETTERS: Readonly<Record<string, string>> = { C: "N", A: "B", T: "R", D: "Q", R: "K" };

/** Partida en notación española («1. e4 e5 2. Cf3») → jugadas en UCI. */
export function spanishGame(text: string): string[] {
  const tokens = text
    .replace(/\d+\.(\.\.)?/g, " ")
    .split(/\s+/)
    .filter((t) => t !== "" && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t));
  const position = Position.fromFen(START_FEN);
  const moves: string[] = [];
  for (const token of tokens) {
    const san = token
      .replace(/[+#?!]+$/, "")
      .replace(/^[CATDR]/, (c) => LETTERS[c]!)
      .replace(/=([CATD])/, (_, c: string) => `=${LETTERS[c]!}`);
    const move = position.moveFromSan(san);
    if (move === null) throw new Error(`${token} no es legal tras ${moves.length} medias jugadas`);
    moves.push(moveToUci(move));
    position.makeMove(move);
  }
  return moves;
}

/** Partida de la auditoría de Claude (Fegatello, 1.e4 e5 … 35…Dxh2#). */
export const CLAUDE_GAME = spanishGame(
  "1. e4 e5 2. Cf3 Cc6 3. Ac4 Cf6 4. Cg5 d5 5. exd5 Cxd5 6. Cxf7 Rxf7 7. Df3+ Re6 8. Cc3 Cb4 9. De4 c6 10. a3 Da5 11. d4 Ad6 " +
    "12. dxe5 Ac7 13. O-O Ca6 14. Td1 Td8 15. b4 Cxb4 16. Ab2 Ca6 17. Dg4+ Rf7 18. e6+ Axe6 19. Df3+ Rg8 20. Axd5 cxd5 " +
    "21. De3 Cc5 22. Ce2 Ce4 23. Cd4 Ab6 24. Dh3 Axh3 25. gxh3 Td6 26. Cf5 Tg6+ 27. Cg3 Axf2+ 28. Rg2 Dc7 29. Rf1 Dc4+ " +
    "30. Rg2 Dxc2 31. Tac1 De2 32. Tc8+ Txc8 33. Tf1 Axg3+ 34. Tf2 Dxf2+ 35. Rh1 Dxh2#",
);

/** Partida de la auditoría de ChatGPT (1.e4 e5 … 40…Tf4#). */
export const CHATGPT_GAME = spanishGame(
  "1. e4 e5 2. Cf3 Cc6 3. Ac4 Cf6 4. Cg5 d5 5. exd5 Cxd5 6. Cxf7 Rxf7 7. Df3+ Re6 8. Cc3 Cb4 9. a3 Cxc2+ 10. Rd1 Cxa1 " +
    "11. Cxd5 Rd6 12. Cb4 Df6 13. Dd5+ Re7 14. Dc5+ Re8 15. Dxc7 Ad6 16. Ab5+ Rf8 17. Dc4 a6 18. Cd5 axb5 19. Cxf6 bxc4 " +
    "20. Ce4 Re7 21. Cxd6 Rxd6 22. d4 cxd3 23. Ae3 Cb3 24. Te1 Ag4+ 25. f3 Ae6 26. Ad2 The8 27. Ab4+ Rd5 28. Txe5+ Rxe5 " +
    "29. Ac3+ Rd5 30. Axg7 Tg8 31. f4 Ag4+ 32. Re1 d2+ 33. Rf2 Txg7 34. h3 Ad7 35. g4 d1=D 36. f5 Dd2+ 37. Rf3 Cd4+ " +
    "38. Rg3 Cxf5+ 39. Rf3 Ta4 40. gxf5 Tf4#",
);
