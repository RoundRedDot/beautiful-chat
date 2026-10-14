// A/A and candidate-vs-baseline pairs per scenario (plan §P0 "当前 A/A 配对差异", §5).
//   node pairs.mjs <rawDir> <scenario>
// Per rep: AA = base2 - base1; CB1 = cand - base1; CB2 = cand - base2.
// Verdict per metric: max(|median CB1|, |median CB2|) <= max |AA| -> "not exceeded".
import { readdirSync, readFileSync } from "node:fs";
const [dir, scenario] = process.argv.slice(2);
const runs = readdirSync(dir).filter((f) => f.startsWith(scenario + "-") && f.endsWith(".json")).map((f) => JSON.parse(readFileSync(`${dir}/${f}`, "utf8")));
const M = {
  "Task ms": (r) => r.cdp.delta.TaskDuration * 1000,
  "Script ms": (r) => r.cdp.delta.ScriptDuration * 1000,
  "Layout+Style ms": (r) => (r.cdp.delta.LayoutDuration + r.cdp.delta.RecalcStyleDuration) * 1000,
  "row p95 ms": (r) => r.probe.allRows.p95,
  "per-commit p95 ms": (r) => r.probe.perCommit.p95,
  "row sum ms": (r) => r.probe.allRows.sum,
  "long tasks ms": (r) => r.probe.longTasks.totalMs,
  "CLS": (r) => r.probe.layoutShift,
  "GC heap MB": (r) => r.cdp.jsHeapUsedMB,
  "GC nodes": (r) => r.cdp.nodes,
};
const by = {};
for (const r of runs) (by[r.rep] ??= {})[r.mode] = r;
const reps = Object.keys(by).map(Number).sort((a, b) => a - b).filter((k) => by[k].base1 && by[k].base2 && by[k].cand);
const med = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const f = (x) => (Math.abs(x) >= 100 ? x.toFixed(0) : Math.abs(x) >= 1 ? x.toFixed(2) : x.toFixed(4));
const pct = (d, base) => (base ? ((d / base) * 100).toFixed(1) + "%" : "n/a");
console.log(`scenario ${scenario}; complete reps ${reps.join(",")} (n=${reps.length})`);
console.log("| metric | base1 med | base2 med | cand med | A/A per pair (abs, rel) | max abs A/A | cand-base1 med | cand-base2 med | verdict |");
console.log("|---|---:|---:|---:|---|---:|---:|---:|---|");
const out = {};
for (const [name, get] of Object.entries(M)) {
  const b1 = reps.map((k) => get(by[k].base1)), b2 = reps.map((k) => get(by[k].base2)), c = reps.map((k) => get(by[k].cand));
  const aa = reps.map((_, i) => b2[i] - b1[i]);
  const cb1 = reps.map((_, i) => c[i] - b1[i]), cb2 = reps.map((_, i) => c[i] - b2[i]);
  const maxAA = Math.max(...aa.map(Math.abs));
  const cand = Math.max(Math.abs(med(cb1)), Math.abs(med(cb2)));
  const signs = new Set(aa.filter((x) => x !== 0).map(Math.sign));
  const verdict = cand <= maxAA ? "not exceeded" : "EXCEEDED";
  out[name] = { b1, b2, c, aa, cb1, cb2, maxAA, candMedDiff: [med(cb1), med(cb2)], verdict };
  console.log(`| ${name} | ${f(med(b1))} | ${f(med(b2))} | ${f(med(c))} | ${aa.map((d, i) => `${f(d)} (${pct(d, b1[i])})`).join("; ")} | ${f(maxAA)} | ${f(med(cb1))} (${pct(med(cb1), med(b1))}) | ${f(med(cb2))} (${pct(med(cb2), med(b2))}) | ${verdict}${signs.size > 1 ? "" : " (A/A one-sided)"} |`);
}
console.log("\nload:", runs.map((r) => `${r.mode}r${r.rep}:${r.machine.uptimeBefore.match(/load averages?: ([\d.]+)/)?.[1]}`).join(" "));
console.log(JSON.stringify(out));
