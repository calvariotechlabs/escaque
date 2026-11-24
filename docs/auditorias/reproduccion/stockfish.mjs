import { spawn } from "node:child_process";
// Uso: node stockfish.mjs <repo> <binario de Stockfish> <casos.json>. Solo referencia de validación en desarrollo.
const [R, SF, casesJson] = process.argv.slice(2);
const { Position, START_FEN, moveToUci } = await import(R + "/dist/src/core/index.js");
const map = { C: "N", A: "B", T: "R", D: "Q", R: "K" };
const es2en = (s) => s.replace(/^[CATDR]/, (c) => map[c]).replace(/=([CATD])/, (m, c) => "=" + map[c]);
const eng = spawn(SF); let buf = ""; const waiters = [];
eng.stdout.on("data", d => { buf += d; let i; while ((i = buf.indexOf("\n")) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); waiters.forEach(w => w(l)); } });
const send = s => eng.stdin.write(s + "\n");
const go = (fen, extra) => new Promise(res => { let last = null; const w = l => { if (l.startsWith("info") && l.includes(" score ") && l.includes(" pv ")) last = l; if (l.startsWith("bestmove")) { waiters.splice(waiters.indexOf(w), 1); const m = last.match(/score (cp|mate) (-?\d+)/); res({ best: l.split(" ")[1], kind: m[1], v: +m[2] }); } }; waiters.push(w); send("position fen " + fen); send("go depth 20" + extra); });
send("uci"); send("setoption name Threads value 1"); send("setoption name Hash value 64"); send("isready");
const fmt = r => r.kind === "mate" ? `M${r.v}` : (r.v / 100).toFixed(2);
for (const c of JSON.parse((await import("node:fs")).readFileSync(casesJson, "utf8"))) {
  const toks = c.pgn.replace(/\d+\.(\.\.)?/g, " ").split(/\s+/).filter(Boolean);
  const p = Position.fromFen(START_FEN); const ucis = [];
  for (const t of toks) { const m = p.moveFromSan(es2en(t.replace(/[+#?!]+$/, ""))); ucis.push(moveToUci(m)); p.makeMove(m); }
  const q = Position.fromFen(START_FEN); for (const u of ucis.slice(0, c.ply)) q.makeMove(q.moveFromUci(u));
  const fen = q.toFen(); const played = ucis[c.ply];
  const all = await go(fen, ""); const mine = await go(fen, " searchmoves " + played);
  console.log(`${c.id.padEnd(12)} ${c.label.padEnd(10)} SF best=${all.best} ${fmt(all)} | played ${played} ${fmt(mine)}  (mover's view)  fen=${fen}`);
}
send("quit");
