// Before/after tables for docs/bench/final-report.md.
//   node docs/bench/tools/final-report.mjs <layer>      layer: offline-current | offline-cached | ios | web
// before = docs/bench/raw (offline runs) and docs/bench/raw-host (host dumps, baseline commit);
// after  = docs/bench/raw-final and docs/bench/raw-host-final. Every cell reads "before -> after".
import { readdirSync, readFileSync, existsSync } from "node:fs";

const layer = process.argv[2];
const median = (v) => { const n = v.filter((x) => typeof x === "number" && Number.isFinite(x)).sort((a, b) => a - b); if (!n.length) return null; const i = n.length >> 1; return n.length % 2 ? n[i] : (n[i - 1] + n[i]) / 2; };
const fmt = (v, d = 1) => (v === null || v === undefined ? "n/m" : Number.isInteger(v) ? String(v) : v.toFixed(d));
const sum = (o) => Object.values(o ?? {}).reduce((a, b) => a + b, 0);

function loadOffline(dir, host) {
  const by = new Map();
  if (!existsSync(dir)) return by;
  for (const f of readdirSync(dir)) {
    const m = new RegExp(`^(.+)\\.${host}\\.run\\d+\\.snapshot\\.json$`).exec(f);
    if (!m) continue;
    const r = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
    by.set(m[1], [...(by.get(m[1]) ?? []), norm(r.settled, r, r.idle?.animations?.mounted, r.heapAfter, r.events, r.hostRowsStreaming)]);
  }
  return by;
}
function loadHost(dir, platform) {
  const by = new Map();
  if (!existsSync(dir)) return by;
  const files = readdirSync(dir).filter((f) => f.startsWith(`${platform}-`) && f.endsWith(".json")).sort();
  for (const f of files) {
    const m = new RegExp(`^${platform}-(.+)-\\d{4}-\\d\\d-\\d\\dT[\\d-]+Z\\.json$`).exec(f);
    if (!m) continue;
    const r = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
    by.set(m[1], [norm(r.snapshot, r, r.snapshot.animations.mounted, r.heapBytes, null, null)]); // last file wins
  }
  return by;
}
function norm(s, raw, loopsEnd, heap, events, hostRows) {
  const k = s.renders.byKind;
  const total = sum(k);
  const active = hostRows ? sum(Object.fromEntries(Object.entries(hostRows).map(([a, v]) => [a, v.active]))) : null;
  const inactive = hostRows ? sum(Object.fromEntries(Object.entries(hostRows).map(([a, v]) => [a, v.inactive]))) : null;
  return {
    renders: k, total, hostActive: active, hostInactive: inactive, events,
    // Renders of the plugin beyond the host-driven active updates: an upper bound on non-active plugin renders.
    pluginExtra: active === null ? null : Math.max(0, total - active),
    commit: s.commitMs, parses: s.markdown.parses, parseMs: s.markdown.parseMs.total, flips: s.markdown.formatFlips,
    hd: s.heightDecreases.count, hdStream: s.heightDecreases.whileStreaming, hl: s.highlightRpc.count,
    loopsEnd, loopsPeak: s.animations.peak, dropped: s.frames.droppedRatio, longest: s.frames.longestMs,
    longTasks: s.longTasks.count ? s.longTasks.count : null, cls: s.layoutShifts.count ? s.layoutShifts.total : null,
    heap: heap == null ? null : heap / 1048576, counters: s.counters ?? {},
  };
}
const med = (runs, f) => (runs ? median(runs.map(f)) : null);
const pair = (b, a, f, d) => `${fmt(med(b, f), d)} -> ${fmt(med(a, f), d)}`;

let before, after, label;
if (layer.startsWith("offline-")) {
  const host = layer.slice(8);
  before = loadOffline("docs/bench/raw", host); after = loadOffline("docs/bench/raw-final", host); label = `offline replay, host mode ${host}, median of 3`;
} else {
  before = loadHost("docs/bench/raw-host", layer); after = loadHost("docs/bench/raw-host-final", layer); label = `${layer}, 1 run`;
}
const names = [...new Set([...before.keys(), ...after.keys()])].sort();
const table = (title, headers, rows) => {
  console.log(`\n#### ${title}\n`);
  console.log(`| ${headers.join(" | ")} |`);
  console.log(`|${headers.map((_, i) => (i === 0 ? " --- " : " ---: ")).join("|")}|`);
  for (const r of rows) console.log(`| ${r.join(" | ")} |`);
};
console.log(`Cells read \`before -> after\` (${label}).`);
const kinds = ["user_message", "assistant", "reasoning", "tool_call", "todo"];
const hostLayer = !layer.startsWith("offline-");
table("Render counts (plugin probe, whole run)", ["fixture", "events", ...kinds, "total", ...(hostLayer ? [] : ["non-active host-driven row renders", "plugin renders beyond host-active updates"])],
  names.map((n) => { const b = before.get(n), a = after.get(n); return [n, fmt((a ?? b)?.[0]?.events ?? null), ...kinds.map((k) => pair(b, a, (r) => r.renders[k] ?? 0)), pair(b, a, (r) => r.total), ...(hostLayer ? [] : [pair(b, a, (r) => r.hostInactive), pair(b, a, (r) => r.pluginExtra)])]; }));
const busiest = (runs) => { const c = {}; for (const r of runs ?? []) for (const [k, s] of Object.entries(r.commit)) c[k] = (c[k] ?? 0) + s.count; return Object.entries(c).sort((x, y) => y[1] - x[1])[0]?.[0] ?? null; };
table("Commit time of the busiest card kind (ms)", ["fixture", "kind (before / after)", "p50", "p95", "max"],
  names.map((n) => { const b = before.get(n), a = after.get(n); const kb = busiest(b), ka = busiest(a); return [n, `${kb ?? "-"} / ${ka ?? "-"}`, `${fmt(kb ? med(b, (r) => r.commit[kb]?.p50) : null)} -> ${fmt(ka ? med(a, (r) => r.commit[ka]?.p50) : null)}`, `${fmt(kb ? med(b, (r) => r.commit[kb]?.p95) : null)} -> ${fmt(ka ? med(a, (r) => r.commit[ka]?.p95) : null)}`, `${fmt(kb ? med(b, (r) => r.commit[kb]?.max) : null)} -> ${fmt(ka ? med(a, (r) => r.commit[ka]?.max) : null)}`]; }));
table("Markdown, layout, RPC, loops", ["fixture", "md parses", "md parse ms", "format flips", "height decreases (streaming)", "highlight RPC", "loops at end", "loops peak", "md.finalRerender"],
  names.map((n) => { const b = before.get(n), a = after.get(n); return [n, pair(b, a, (r) => r.parses), pair(b, a, (r) => r.parseMs), pair(b, a, (r) => r.flips), `${pair(b, a, (r) => r.hd)} (${fmt(med(b, (r) => r.hdStream))} -> ${fmt(med(a, (r) => r.hdStream))})`, pair(b, a, (r) => r.hl), pair(b, a, (r) => r.loopsEnd), pair(b, a, (r) => r.loopsPeak), `n/m -> ${fmt(med(a, (r) => ("md.blockRender" in r.counters ? (r.counters["md.finalRerender"] ?? 0) : null)))}`]; }));
table("Frames, long tasks, layout shift, heap", ["fixture", "dropped ratio", "longest frame ms", "long tasks", "layout shift", "JS heap MB"],
  names.map((n) => { const b = before.get(n), a = after.get(n); return [n, pair(b, a, (r) => r.dropped, 3), pair(b, a, (r) => r.longest, 0), pair(b, a, (r) => r.longTasks), pair(b, a, (r) => r.cls, 3), pair(b, a, (r) => r.heap)]; }));
