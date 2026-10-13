// Native-vs-fork bar charts for docs/perf, in the style of web-p95.svg / ios-p95.svg.
//   node chart.mjs web <raw-web-dir> <out.svg> [forkLabel]   Web main-thread Task seconds
//   node chart.mjs ios <raw-ios-dir>[,<dir>...] <out.svg>     iOS per-commit row total p95, ms
// The pale bar is native Paseo; the coloured bar starts at that length and settles at the
// fork's: green when it shrinks, oxide when it grows. Medians across runs.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [kind, dir, out, forkLabel = "fork", baseline = "native"] = process.argv.slice(2);
const SCENARIOS = [
  ["codeblock-streaming", "代码块流式"],
  ["diff-large", "大 diff"],
  ["history-100", "100 轮历史"],
  ["markdown-long", "长回复"],
  ["mixed-turn", "混合一轮"],
  ["reads-20", "读 20 个文件"],
  ["reasoning-long-prose", "思考散文"],
  ["reasoning-long-sections", "思考分节"],
  ["shell-log-large", "大段终端"],
  ["table-streaming", "表格流式"],
  ["tool-expanded-streaming", "展开的工具"],
];
const baselineName = baseline === "upstream" ? "Beautiful Chat" : "Paseo 原生";
const metric =
  kind === "web"
    ? { get: (r) => r.cdp.delta.TaskDuration, ticks: [0, 2, 4, 6, 8], unit: "s", digits: 2,
        title: `Web 生产构建，整段回放的主线程任务时间（秒）。淡色是 ${baselineName}，彩色收回或伸出后是本仓库。` }
    : { get: (r) => r.perCommit.p95, ticks: [0, 30, 60, 90, 120], unit: "ms", digits: 1,
        title: `iOS 模拟器开发版，单次提交里所有行之和的 p95（毫秒）。淡色是 ${baselineName}，彩色收回或伸出后是本仓库。` };

// File names are <platform>-<mode>-<fixture>-r<rep>.json. `dir` may list several
// directories, comma-separated: a fixture found in a later one replaces the earlier runs.
const loadDir = (one) =>
  readdirSync(one)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const [, mode, ...rest] = f.replace(/\.json$/, "").split("-");
      rest.pop();
      const raw = JSON.parse(readFileSync(path.join(one, f), "utf8"));
      return { mode, fixture: rest.join("-"), sample: kind === "web" ? raw : raw.probe ?? raw };
    });
let runs = [];
for (const one of dir.split(",")) {
  const next = loadDir(one);
  const replaced = new Set(next.map((r) => r.fixture));
  runs = [...runs.filter((r) => !replaced.has(r.fixture)), ...next];
}
const median = (values) => {
  const sorted = values.sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const value = (fixture, mode) =>
  median(runs.filter((r) => r.fixture === fixture && r.mode === mode).map((r) => metric.get(r.sample)));

const X0 = 132;
const WIDTH = 520;
const peak = Math.max(
  ...SCENARIOS.map(([fixture]) => value(fixture, baseline) ?? 0),
  ...SCENARIOS.map(([fixture]) => value(fixture, forkLabel) ?? 0),
);
if (kind === "web" && peak > 8) metric.ticks = [0, 3, 6, 9];
const max = metric.ticks[metric.ticks.length - 1];
const x = (v) => X0 + (Math.min(v, max) / max) * WIDTH;
const ROW = 34;
const TOP = 28;
const height = TOP + SCENARIOS.length * ROW + 44;
const SANS = "ui-sans-serif, system-ui, sans-serif";
const CJK = "PingFang SC, Hiragino Sans GB, Noto Sans SC, sans-serif";
const GREEN = "#1e5c4e";
const OXIDE = "#a33b32";
const GHOST = "#cdd8dc";
const fmt = (v) => v.toFixed(metric.digits);

const parts = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -8 848 ${height}" width="848" height="${height}" role="img">`,
  `<title>${metric.title}</title>`,
  `<style>\n.final { display: none; }\n@media (prefers-reduced-motion: reduce) {\n  .motion { display: none; }\n  .final { display: inline; }\n}\n</style>`,
];
const axisBottom = TOP + SCENARIOS.length * ROW;
for (const tick of metric.ticks) {
  if (tick > 0) {
    parts.push(`<line x1="${x(tick).toFixed(1)}" y1="${TOP}" x2="${x(tick).toFixed(1)}" y2="${axisBottom}" stroke="#d5e0e4" stroke-width="1"/>`);
  }
  parts.push(`<text x="${x(tick).toFixed(1)}" y="${axisBottom + 24}" text-anchor="middle" fill="#5c6e76" font-size="11" font-family="${SANS}">${tick}${metric.unit}</text>`);
}
SCENARIOS.forEach(([fixture, name], index) => {
  const native = value(fixture, baseline);
  const fork = value(fixture, forkLabel);
  const y = TOP + 14 + index * ROW;
  const better = fork <= native;
  const colour = better ? GREEN : OXIDE;
  const change = Math.round((Math.abs(fork - native) / native) * 100);
  const nw = (x(native) - X0).toFixed(1);
  const fw = (x(fork) - X0).toFixed(1);
  const begin = (index * 0.045).toFixed(3);
  parts.push(`<text x="120" y="${y + 10}" text-anchor="end" fill="#172226" font-size="13" font-family="${CJK}">${name}</text>`);
  parts.push(`<rect x="${X0}" y="${y}" width="${nw}" height="12" fill="${GHOST}"/>`);
  parts.push(`<rect class="motion" x="${X0}" y="${y}" width="${fw}" height="12" fill="${colour}"><animate attributeName="width" from="${nw}" to="${fw}" begin="${begin}s" dur="1.15s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.16 0.84 0.22 1"/></rect>`);
  parts.push(`<rect class="final" x="${X0}" y="${y}" width="${fw}" height="12" fill="${colour}"/>`);
  if (!better) {
    // A longer bar covers the native one; keep native's end visible as a tick.
    parts.push(`<line x1="${x(native).toFixed(1)}" y1="${y - 3}" x2="${x(native).toFixed(1)}" y2="${y + 15}" stroke="#172226" stroke-width="1.5"/>`);
  }
  const arrow = better
    ? `<polygon fill="${colour}" points="770,${y + 1} 776,${y + 9} 764,${y + 9}"/>`
    : `<polygon fill="${colour}" points="764,${y + 3} 776,${y + 3} 770,${y + 11}"/>`;
  parts.push(`<text text-anchor="end" x="752" y="${y + 10}" fill="#5c6e76" font-size="12" font-family="${SANS}">${fmt(native)} → ${fmt(fork)}</text>${arrow}<text x="780" y="${y + 10}" fill="${colour}" font-size="12" font-family="${SANS}">${change}%</text>`);
  console.log(`${fixture}\t${fmt(native)}\t${fmt(fork)}\t${better ? "-" : "+"}${change}%`);
});
parts.push("</svg>");
writeFileSync(out, parts.join("\n") + "\n");
