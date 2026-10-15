import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "docs/bench/before-after-2026-10-15/raw");
const outPath = process.argv[3] ?? path.join(root, "analysis.json");
const MODES = ["before", "before2", "after"];
const FIXTURES = [
  "codeblock-streaming", "diff-large", "history-100", "markdown-long", "mixed-turn",
  "reads-20", "reasoning-long-prose", "reasoning-long-sections", "shell-log-large",
  "table-streaming", "tool-expanded-streaming",
];

function filesUnder(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const file = path.join(dir, entry.name);
      return entry.isDirectory() ? filesUnder(file) : entry.name.endsWith(".json") ? [file] : [];
    });
  } catch {
    return [];
  }
}

function median(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const webRuns = [];
const webRawFiles = [...filesUnder(path.join(root, "web")), ...filesUnder(path.join(root, "web-special"))];
for (const file of webRawFiles) {
  const raw = JSON.parse(readFileSync(file, "utf8"));
  if (!MODES.includes(raw.mode)) continue;
  if (raw.scenario === "images-repeat") {
    for (const phase of ["live", "historyLoad"]) {
      webRuns.push({ mode: raw.mode, rep: raw.rep, scenario: `images-repeat-${phase === "live" ? "live" : "history"}`, probe: raw.details[phase].probe, cdp: raw.details[phase].cdp });
    }
  } else if (raw.scenario === "diff-expand") {
    webRuns.push({ mode: raw.mode, rep: raw.rep, scenario: raw.scenario, probe: raw.details.probe, cdp: raw.details.cdp });
  } else {
    webRuns.push({ mode: raw.mode, rep: raw.rep, scenario: raw.fixture, probe: raw.probe, cdp: raw.cdp });
  }
}

const webMetrics = [
  ["TaskDuration", "s", (run) => run.cdp?.delta?.TaskDuration],
  ["ScriptDuration", "s", (run) => run.cdp?.delta?.ScriptDuration],
  ["Layout+Style", "s", (run) => (run.cdp?.delta?.LayoutDuration ?? 0) + (run.cdp?.delta?.RecalcStyleDuration ?? 0)],
  ["host row p95", "ms", (run) => run.probe?.allRows?.p95],
  ["per-commit p95", "ms", (run) => run.probe?.perCommit?.p95],
  ["row render total", "ms", (run) => run.probe?.allRows?.sum],
  ["long task count", "count", (run) => run.probe?.longTasks?.count],
  ["long task total", "ms", (run) => run.probe?.longTasks?.totalMs],
  ["CLS", "ratio", (run) => run.probe?.layoutShift],
  ["post-GC JS heap", "MB", (run) => run.cdp?.jsHeapUsedMB],
  ["post-GC DOM", "nodes", (run) => run.cdp?.nodes],
];

function pairSeries(rows, scenario, metric, get) {
  const getOne = (mode, rep) => rows.find((run) => run.scenario === scenario && run.mode === mode && run.rep === rep);
  const reps = [...new Set(rows.filter((run) => run.scenario === scenario).map((run) => run.rep))].sort((a, b) => a - b);
  const valueAt = (mode, rep) => {
    const run = getOne(mode, rep);
    return run ? get(run) : null;
  };
  const values = Object.fromEntries(MODES.map((mode) => [mode, reps.map((rep) => valueAt(mode, rep)).filter(Number.isFinite)]));
  const medians = Object.fromEntries(MODES.map((mode) => [mode, median(values[mode])]));
  const pairedAA = reps.map((rep) => {
    const before = valueAt("before", rep);
    const before2 = valueAt("before2", rep);
    return Number.isFinite(before) && Number.isFinite(before2) ? { rep, delta: before2 - before } : { rep, delta: null };
  });
  const pairedAfter = reps.map((rep) => {
    const before = valueAt("before", rep);
    const after = valueAt("after", rep);
    return Number.isFinite(before) && Number.isFinite(after) ? { rep, delta: after - before } : { rep, delta: null };
  });
  const aaAbs = pairedAA.map((pair) => Math.abs(pair.delta)).filter(Number.isFinite);
  const maxAbsAA = aaAbs.length ? Math.max(...aaAbs) : null;
  const afterMinusBefore = medians.after == null || medians.before == null ? null : medians.after - medians.before;
  const signs = pairedAfter.map((pair) => Math.sign(pair.delta)).filter((sign) => sign !== 0 && Number.isFinite(sign));
  const signConsistent = signs.length === pairedAfter.length && signs.every((sign) => sign === signs[0]);
  let verdict = "within noise";
  if (maxAbsAA != null && afterMinusBefore != null && Math.abs(afterMinusBefore) > maxAbsAA && signConsistent) {
    verdict = afterMinusBefore < 0 ? "gain" : "loss";
  }
  return { metric, medians, pairedAA, maxAbsAA, pairedAfter, afterMinusBefore, signConsistent, verdict, counts: Object.fromEntries(MODES.map((mode) => [mode, values[mode].length])) };
}

function fmt(value, digits = 3) {
  if (value == null || !Number.isFinite(value)) return "n/m";
  return Number(value.toFixed(digits)).toString();
}

const webScenarios = [...new Set(webRuns.map((run) => run.scenario))].sort((a, b) => {
  const ordered = [...FIXTURES, "diff-expand", "images-repeat-live", "images-repeat-history"];
  return ordered.indexOf(a) - ordered.indexOf(b);
});
const webRows = [];
for (const scenario of webScenarios) {
  for (const [name, unit, get] of webMetrics) {
    const result = pairSeries(webRuns, scenario, name, get);
    result.unit = unit;
    if (name === "TaskDuration") {
      const replayOnly = FIXTURES.includes(scenario);
      const bothUnderHalfSecond = replayOnly && result.medians.before != null && result.medians.after != null && result.medians.before < 0.5 && result.medians.after < 0.5;
      const relative = result.medians.before ? Math.abs(result.afterMinusBefore / result.medians.before) : null;
      result.readmeEvenRule = bothUnderHalfSecond || (relative != null && relative < 0.1);
    }
    webRows.push({ scenario, ...result });
  }
}

const iosRuns = filesUnder(path.join(root, "ios"))
  .map((file) => JSON.parse(readFileSync(file, "utf8")))
  .filter((run) => MODES.includes(run.mode))
  .map((run) => ({ ...run, scenario: run.fixture }));
const iosRows = [];
for (const scenario of FIXTURES) {
  for (const [name, get] of [
    ["row render total", (run) => run.allRows?.sum],
    ["per-commit p95", (run) => run.perCommit?.p95],
  ]) {
    iosRows.push({ scenario, ...pairSeries(iosRuns, scenario, name, get), unit: "ms" });
  }
}

const probeRuns = filesUnder(path.join(root, "probes")).map((file) => JSON.parse(readFileSync(file, "utf8")));
const counterRows = [];
for (const scenario of ["diff-expand", "images-repeat"]) {
  const runs = probeRuns.filter((run) => run.scenario === scenario);
  if (scenario === "diff-expand") {
    const steps = ["expand", "show-all", "show-less", "theme-dark", "theme-light"];
    for (const step of steps) {
      for (const metric of ["highlightCacheKey", "codeMaxLineNumber"]) {
        const row = { scenario, step, metric, values: {} };
        for (const mode of MODES) row.values[mode] = runs.filter((run) => run.mode === mode).sort((a, b) => a.rep - b.rep).map((run) => run.steps.find((item) => item.step === step)?.[metric] ?? null);
        row.medians = Object.fromEntries(MODES.map((mode) => [mode, median(row.values[mode])]));
        counterRows.push(row);
      }
    }
  } else {
    for (const phase of ["live", "historyLoad", "afterExpandingReadRow"]) {
      for (const metric of ["imageRpc.count", "imageRpc.duplicatesInFlight"]) {
        const row = { scenario, phase, metric, values: {} };
        for (const mode of MODES) {
          row.values[mode] = runs.filter((run) => run.mode === mode).sort((a, b) => a.rep - b.rep).map((run) => {
            const snapshot = run[phase];
            if (!snapshot) return null;
            return metric.endsWith(".count") ? snapshot.imageRpc?.count ?? null : snapshot.imageRpc?.duplicatesInFlight ?? null;
          });
        }
        row.medians = Object.fromEntries(MODES.map((mode) => [mode, median(row.values[mode])]));
        counterRows.push(row);
      }
    }
  }
}

const validation = {
  webRunCounts: Object.fromEntries(webScenarios.map((scenario) => [scenario, Object.fromEntries(MODES.map((mode) => [mode, webRuns.filter((run) => run.scenario === scenario && run.mode === mode).length]))])),
  iosRunCounts: Object.fromEntries(FIXTURES.map((scenario) => [scenario, Object.fromEntries(MODES.map((mode) => [mode, iosRuns.filter((run) => run.fixture === scenario && run.mode === mode).length]))])),
  probeRunCounts: Object.fromEntries(["diff-expand", "images-repeat"].map((scenario) => [scenario, Object.fromEntries(MODES.map((mode) => [mode, probeRuns.filter((run) => run.scenario === scenario && run.mode === mode).length]))])),
  webPageErrors: webRawFiles.map((file) => JSON.parse(readFileSync(file, "utf8"))).reduce((all, run) => all + (run.pageErrors?.length ?? 0), 0),
  identityMismatches: [
    ...webRawFiles.map((file) => JSON.parse(readFileSync(file, "utf8"))).filter((run) => MODES.includes(run.mode) && (!run.identity?.host || !run.identity?.imageRpc || run.identity?.pluginPath !== `/private/tmp/bc-ba/${run.mode}`)),
    ...iosRuns.filter((run) => !run.identity?.host || !run.identity?.fork || run.identity?.pluginPath !== `/private/tmp/bc-ba/${run.mode}`),
    ...probeRuns.filter((run) => !run.identity?.host || !run.identity?.imageRpc || run.identity?.pluginPath !== `/private/tmp/bc-ba/${run.mode}`),
  ].length,
};

const analysis = { webRows, iosRows, counterRows, validation };
writeFileSync(outPath, JSON.stringify(analysis, null, 2));

function table(headers, rows) {
  return [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`, ...rows.map((row) => `| ${row.join(" | ")} |`)].join("\n");
}
const md = [];
md.push("### Web（中位数；差值均为 after − before）\n");
md.push(table(
  ["场景", "指标", "单位", "样本数 b/b2/a", "before", "before2", "after", "A/A：before2−before（按 rep）", "after−before（按 rep）", "max |A/A|", "after−before 中位差", "判定", "README 次级规则"],
  webRows.map((row) => [
    row.scenario, row.metric, row.unit, MODES.map((mode) => row.counts[mode]).join("/"),
    fmt(row.medians.before), fmt(row.medians.before2), fmt(row.medians.after),
    row.pairedAA.map((pair) => `r${pair.rep}:${fmt(pair.delta)}`).join(", "),
    row.pairedAfter.map((pair) => `r${pair.rep}:${fmt(pair.delta)}`).join(", "),
    fmt(row.maxAbsAA), fmt(row.afterMinusBefore), row.verdict,
    row.metric === "TaskDuration" ? (row.readmeEvenRule ? "even" : "different") : "—",
  ]),
));
md.push("\n### iOS（中位数；差值均为 after − before）\n");
md.push(table(
  ["场景", "指标", "样本数 b/b2/a", "before", "before2", "after", "A/A：before2−before（按 rep）", "after−before（按 rep）", "max |A/A|", "after−before 中位差", "判定"],
  iosRows.map((row) => [row.scenario, row.metric, MODES.map((mode) => row.counts[mode]).join("/"), fmt(row.medians.before), fmt(row.medians.before2), fmt(row.medians.after), row.pairedAA.map((pair) => `r${pair.rep}:${fmt(pair.delta)}`).join(", "), row.pairedAfter.map((pair) => `r${pair.rep}:${fmt(pair.delta)}`).join(", "), fmt(row.maxAbsAA), fmt(row.afterMinusBefore), row.verdict]),
));
md.push("\n### 未计时功能计数（3 次/构建；原始值）\n");
md.push(table(
  ["场景", "步骤/时机", "计数器", "before", "before2", "after", "中位数 before / before2 / after"],
  counterRows.map((row) => [row.scenario, row.step ?? row.phase, row.metric, ...MODES.map((mode) => row.values[mode].map((value) => value == null ? "n/m" : value).join(" / ")), MODES.map((mode) => fmt(row.medians[mode], 0)).join(" / ")]),
));
md.push("\n### 样本数\n");
md.push("```json\n" + JSON.stringify(validation, null, 2) + "\n```");
process.stdout.write(`${md.join("\n\n")}\n`);
