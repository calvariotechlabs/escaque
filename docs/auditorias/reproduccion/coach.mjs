// Uso: node coach.mjs <repo con dist/ compilado> <casos.json>
// Reproduce coach findings from both audits at the real COACH_LIMITS (deterministic depth 4; time large).
const R = process.argv[2];
const { Position, START_FEN, moveToUci } = await import(R + "/dist/src/core/index.js");
const { analyzeMove } = await import(R + "/dist/src/coach/index.js");
const map = { C: "N", A: "B", T: "R", D: "Q", R: "K" };
const es2en = (s) => s.replace(/^[CATDR]/, (c) => map[c]).replace(/=([CATD])/, (m, c) => "=" + map[c]);
function game(text) {
  const toks = text.replace(/\d+\.(\.\.)?/g, " ").split(/\s+/).filter(Boolean).filter(t=>!/^(0-1|1-0|\*)$/.test(t));
  const p = Position.fromFen(START_FEN); const ucis = [];
  for (const t of toks) { const m = p.moveFromSan(es2en(t.replace(/[+#?!]+$/, ""))); if (!m) throw new Error("bad " + t + " after " + ucis.length); ucis.push(moveToUci(m)); p.makeMove(m); }
  return ucis;
}
const cases = JSON.parse((await import("node:fs")).readFileSync(process.argv[3], "utf8"));
for (const c of cases) {
  const all = game(c.pgn);
  const idx = c.ply; // index of the move to analyze (0-based)
  const t0 = performance.now();
  const r = analyzeMove({ fen: START_FEN, moves: all.slice(0, idx) }, all[idx], { limits: { maxDepth: 4 } });
  const ms = Math.round(performance.now() - t0);
  console.log(`\n### ${c.id} ${c.label}  (${ms} ms, depth ${r.depth})`);
  console.log(` jugada=${r.move.san} best=${r.best.san} loss=${r.loss} verdict=${r.title}`);
  console.log(` summary: ${r.summary}`);
  console.log(` before: ${r.before.text} | after: ${r.after.text}`);
  console.log(` why: ${r.why}`);
  console.log(` line: ${r.line}`);
  for (const f of r.findings) console.log(` finding[${f.kind}]: ${f.message}`);
}
