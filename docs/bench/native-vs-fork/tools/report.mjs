// Medians of the native-vs-fork runs, printed as Markdown tables.
//   node report.mjs <raw-dir>/web            web dumps (web-ab.mjs)
//   node report.mjs <raw-dir>/ios --ios      iOS dumps (ios-ab.sh)
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const dir = process.argv[2];
const ios = process.argv.includes("--ios");
const argAfter = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index > 0 ? process.argv[index + 1] : fallback;
};
// Sides of each "a → b" cell; defaults compare native with the fork.
const A = argAfter("--a", "native");
const B = argAfter("--b", "fork");
const FIXTURES = [
  "codeblock-streaming",
  "diff-large",
  "history-100",
  "markdown-long",
  "mixed-turn",
  "reads-20",
  "reasoning-long-prose",
  "reasoning-long-sections",
  "shell-log-large",
  "table-streaming",
  "tool-expanded-streaming",
];
const KINDS = ["user", "assistant", "reasoning", "tool", "todo"];

const runs = [];
for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const raw = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
  const [, mode, ...rest] = file.replace(/\.json$/, "").split("-");
  const rep = rest.pop();
  const fixture = rest.join("-");
  const probe = raw.probe ?? raw;
  runs.push({ mode, fixture, rep, probe, cdp: raw.cdp, streamMs: raw.streamMs });
}

const median = (values) => {
  const sorted = values.filter((v) => v != null && !Number.isNaN(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const pick = (fixture, mode, get) =>
  median(runs.filter((r) => r.fixture === fixture && r.mode === mode).map(get));
const count = (fixture, mode) => runs.filter((r) => r.fixture === fixture && r.mode === mode).length;
const fmt = (value, digits = 1) =>
  value == null ? "n/m" : Number(value.toFixed(digits)).toLocaleString("en-US");
const delta = (native, fork) => {
  if (native == null || fork == null || native === 0) return "";
  const change = (fork - native) / native;
  return `${change > 0 ? "+" : ""}${Math.round(change * 100)}%`;
};
const table = (title, columns, rows) => {
  console.log(`\n#### ${title}\n`);
  console.log(`| ${columns.join(" | ")} |`);
  console.log(`| ${columns.map((_, i) => (i ? "---:" : "---")).join(" | ")} |`);
  for (const row of rows) console.log(`| ${row.join(" | ")} |`);
};
const pair = (fixture, get, digits = 1) => {
  const n = pick(fixture, A, get);
  const f = pick(fixture, B, get);
  return [`${fmt(n, digits)} → ${fmt(f, digits)}`, delta(n, f)];
};
const fixtures = FIXTURES.filter((f) => count(f, A) && count(f, B));

console.log(`runs: ${runs.length}; per cell: ${fixtures.map((f) => `${f} ${count(f, A)}/${count(f, B)}`).join(", ")}`);

table(
  `行渲染耗时（Profiler actualDuration，所有行，ms）${A} → ${B}`,
  ["场景", "p50", "", "p95", "", "max", "", "合计", ""],
  fixtures.map((f) => [
    f,
    ...pair(f, (r) => r.probe.allRows.p50, 2),
    ...pair(f, (r) => r.probe.allRows.p95, 2),
    ...pair(f, (r) => r.probe.allRows.max),
    ...pair(f, (r) => r.probe.allRows.sum, 0),
  ]),
);
table(
  `每次 React 提交里所有行的耗时之和（ms）与提交次数 ${A} → ${B}`,
  ["场景", "p95", "", "max", "", "行提交次数", ""],
  fixtures.map((f) => [
    f,
    ...pair(f, (r) => r.probe.perCommit.p95, 2),
    ...pair(f, (r) => r.probe.perCommit.max),
    ...pair(f, (r) => r.probe.allRows.n, 0),
  ]),
);
for (const kind of KINDS) {
  const rows = fixtures
    .filter((f) => runs.some((r) => r.fixture === f && r.probe.kinds[kind]))
    .map((f) => [
      f,
      ...pair(f, (r) => r.probe.kinds[kind]?.commits, 0),
      ...pair(f, (r) => r.probe.kinds[kind]?.p50, 2),
      ...pair(f, (r) => r.probe.kinds[kind]?.p95, 2),
      ...pair(f, (r) => r.probe.kinds[kind]?.sum, 0),
    ]);
  table(`${kind} 行 ${A} → ${B}`, ["场景", "提交", "", "p50", "", "p95", "", "合计", ""], rows);
}
table(
  `帧 ${A} → ${B}`,
  ["场景", "掉帧比例", "", "最长帧 ms", ""],
  fixtures.map((f) => [
    f,
    ...pair(f, (r) => r.probe.frames.droppedRatio * 100, 1),
    ...pair(f, (r) => r.probe.frames.longestMs, 0),
  ]),
);
if (!ios) {
  table(
    `主线程 CPU（CDP，s）${A} → ${B}`,
    ["场景", "Task", "", "Script", "", "Layout+Style", ""],
    fixtures.map((f) => [
      f,
      ...pair(f, (r) => r.cdp.delta.TaskDuration, 2),
      ...pair(f, (r) => r.cdp.delta.ScriptDuration, 2),
      ...pair(f, (r) => r.cdp.delta.LayoutDuration + r.cdp.delta.RecalcStyleDuration, 2),
    ]),
  );
  table(
    `长任务、布局偏移、内存 ${A} → ${B}`,
    ["场景", "长任务数", "", "长任务合计 ms", "", "布局偏移", "", "JS 堆 MB", "", "DOM 节点", ""],
    fixtures.map((f) => [
      f,
      ...pair(f, (r) => r.probe.longTasks.count, 0),
      ...pair(f, (r) => r.probe.longTasks.totalMs, 0),
      ...pair(f, (r) => r.probe.layoutShift, 3),
      ...pair(f, (r) => r.cdp.jsHeapUsedMB, 0),
      ...pair(f, (r) => r.cdp.nodes, 0),
    ]),
  );
}
