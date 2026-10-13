// Native Paseo rendering vs the beautiful-chat fork, production web build, same fixtures.
//
//   node web-ab.mjs --reps 3 --out <dir> [fixture:speed ...]
//
// Needs: the A/B daemon (~/.paseo-bench-ab, 127.0.0.1:6869) with bc-bench and
// beautiful-chat installed, and the instrumented web export served on :8092
// (serve-web.mjs). Mode "native" disables beautiful-chat in that daemon, mode
// "fork" enables it. Mode "upstream" enables it too, after retargeting
// BC_PLUGIN_LINK at BC_UPSTREAM_DIR (and "fork" at BC_FORK_DIR). The page is
// reloaded per run. Each run dumps the host probe (__hostPerf) plus CDP metrics.
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";

const HOME = `${process.env.HOME}/.paseo-bench-ab`;
const SERVER_ID = readFileSync(`${HOME}/server-id`, "utf8").trim();
const ORIGIN = "http://127.0.0.1:8092";
const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PROFILE = "/tmp/bcnp-web-profile";
const PROJECT = "/tmp/bcnp-proj";
const DEFAULT_FIXTURES = [
  "codeblock-streaming:1",
  "diff-large:1",
  "history-100:max",
  "markdown-long:1",
  "mixed-turn:1",
  "reads-20:1",
  "reasoning-long-prose:1",
  "reasoning-long-sections:1",
  "shell-log-large:1",
  "table-streaming:1",
  "tool-expanded-streaming:4",
];

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const [value] = args.splice(index, 2).slice(1);
  return value;
};
const reps = Number(flag("--reps", "1"));
const OUT = flag("--out", "/tmp/bcnp-web-out");
const modes = flag("--modes", "native,fork").split(",");
// --reduced-motion: emulate prefers-reduced-motion and label runs "<mode>rm" (attribution check).
const reducedMotion = args.includes("--reduced-motion");
// --fork-label <name>: file label for fork runs, e.g. to keep two plugin builds apart.
const forkLabel = flag("--fork-label", "fork");
// --init-script <js>: evaluated before the app on every page load (e.g. an experiment switch).
const initScript = flag("--init-script", "");
// --rep-start <n>: number the reps from n, so separate invocations can share one --out.
const repStart = Number(flag("--rep-start", "1"));
if (reducedMotion) args.splice(args.indexOf("--reduced-motion"), 1);
const fixtures = (args.length ? args : DEFAULT_FIXTURES).map((spec) => {
  const [name, speed] = spec.split(":");
  return { name, speed: speed ?? "1" };
});
mkdirSync(OUT, { recursive: true });

const paseo = (...rest) =>
  execFileSync("paseo", ["--home", HOME, ...rest], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

// Optional: one directory install whose symlink is retargeted per mode, so native,
// the current fork, and the upstream plugin share one daemon and one page.
//   BC_PLUGIN_LINK  symlink the daemon's beautiful-chat path points at
//   BC_FORK_DIR     worktree for mode "fork"
//   BC_UPSTREAM_DIR worktree for mode "upstream"
const PLUGIN_LINK = process.env.BC_PLUGIN_LINK ?? "";
const PLUGIN_TARGETS = {
  fork: process.env.BC_FORK_DIR ?? "",
  upstream: process.env.BC_UPSTREAM_DIR ?? "",
};

function pointPlugin(mode) {
  const target = PLUGIN_TARGETS[mode];
  if (!target) {
    if (mode !== "native" && mode !== "fork") throw new Error(`no plugin directory for mode ${mode}`);
    return false;
  }
  if (!PLUGIN_LINK) throw new Error("BC_PLUGIN_LINK is required to switch plugin builds");
  const next = realpathSync(target);
  const current = existsSync(PLUGIN_LINK) ? realpathSync(PLUGIN_LINK) : "";
  if (current === next) return false;
  execFileSync("ln", ["-sfn", target, PLUGIN_LINK]);
  return true;
}

function setMode(mode) {
  const pluginOn = mode !== "native";
  const swapped = pluginOn ? pointPlugin(mode) : false;
  const [now] = JSON.parse(paseo("plugin", "ls", "beautiful-chat", "--json"));
  if (now.enabled !== pluginOn) paseo("plugin", pluginOn ? "enable" : "disable", "beautiful-chat");
  // enable can keep the bundle compiled before the symlink moved, so reload after a swap.
  if (swapped && pluginOn) paseo("plugin", "reload", "beautiful-chat");
  for (let attempt = 0; attempt < 30; attempt++) {
    const [row] = JSON.parse(paseo("plugin", "ls", "beautiful-chat", "--json"));
    const ready = pluginOn ? row.status === "running" : row.enabled === false;
    if (ready) return;
    execFileSync("sleep", ["1"]);
  }
  throw new Error(`beautiful-chat did not reach mode ${mode}`);
}

const context = await chromium.launchPersistentContext(PROFILE, {
  executablePath: CHROME,
  headless: true,
  locale: "zh-CN",
  viewport: { width: 1280, height: 900 },
});
const page = context.pages()[0] ?? (await context.newPage());
// Never let the web app reach the user's daemons.
await page.routeWebSocket(/:(6767|6868)\//, (ws) => ws.close());
page.on("pageerror", (error) => console.log("pageerror", String(error).slice(0, 200)));
if (reducedMotion) await page.emulateMedia({ reducedMotion: "reduce" });
if (initScript) await page.addInitScript(initScript);
const cdp = await context.newCDPSession(page);
await cdp.send("Performance.enable", { timeDomain: "threadTicks" });

async function metrics() {
  const { metrics: list } = await cdp.send("Performance.getMetrics");
  return Object.fromEntries(list.map((m) => [m.name, m.value]));
}

async function ensureHost() {
  const direct = page.getByText("直接连接").first();
  if (await direct.isVisible().catch(() => false)) {
    await direct.click();
    await page.waitForTimeout(800);
    const inputs = page.locator("input");
    await inputs.nth(0).fill("127.0.0.1");
    await inputs.nth(1).fill("6869");
    await page.getByText("连接", { exact: true }).last().click();
    await page.waitForTimeout(5000);
  }
}

async function open(url) {
  await page.goto(url);
  await page.waitForTimeout(4000);
  await ensureHost();
  if (!page.url().includes("/agent/")) {
    await page.goto(url);
    await page.waitForTimeout(4000);
  }
}

async function run(fixture, mode, rep) {
  const label = mode === "fork" ? forkLabel : mode;
  const stem = `web-${label}${reducedMotion ? "rm" : ""}-${fixture.name}-r${rep}`;
  if (existsSync(`${OUT}/${stem}.json`)) throw new Error(`${stem}.json exists; use another --out`);
  const id = paseo(
    "run", "-d", "-q", "--provider", "bc-bench", "--cwd", PROJECT,
    "--title", `ab-${mode}-${fixture.name}-${rep}`, "list",
  ).trim().split("\n").pop();
  try {
    paseo("wait", id, "--timeout", "60");
  } catch {}
  await open(`${ORIGIN}/h/${SERVER_ID}/agent/${id}`);
  await page.waitForTimeout(1500);
  await page.evaluate(() => globalThis.__hostPerf.reset());
  const before = await metrics();
  const started = Date.now();
  paseo("send", id, `fixture:${fixture.name} speed:${fixture.speed}`);
  try {
    paseo("wait", id, "--timeout", "900");
  } catch (error) {
    console.log("wait failed", String(error).slice(0, 120));
  }
  const streamMs = Date.now() - started;
  await page.waitForTimeout(4000);
  const probe = await page.evaluate((label) => globalThis.__hostPerf.snapshot(label), fixture.name);
  const after = await metrics();
  // CDP counts detached DOM nodes and unreachable heap until a GC runs, so without one
  // the reading is bimodal (about 1.4k vs 2.5k nodes for the same run). Time metrics
  // above are read first; heap and nodes below are read after a forced collection.
  await cdp.send("HeapProfiler.collectGarbage");
  await page.waitForTimeout(300);
  const settled = await metrics();
  const cdpDelta = {};
  for (const key of ["TaskDuration", "ScriptDuration", "LayoutDuration", "RecalcStyleDuration", "LayoutCount", "RecalcStyleCount"]) {
    cdpDelta[key] = after[key] - before[key];
  }
  const result = {
    fixture: fixture.name,
    speed: fixture.speed,
    mode: mode === "fork" ? forkLabel : mode,
    reducedMotion,
    rep,
    agentId: id,
    streamMs,
    probe,
    cdp: {
      delta: cdpDelta,
      nodes: settled.Nodes,
      jsHeapUsedMB: settled.JSHeapUsedSize / 1048576,
      beforeGc: { nodes: after.Nodes, jsHeapUsedMB: after.JSHeapUsedSize / 1048576 },
    },
  };
  writeFileSync(`${OUT}/${stem}.json`, JSON.stringify(result, null, 2));
  await page.screenshot({ path: `${OUT}/${stem}.png` });
  try {
    paseo("archive", id);
  } catch {}
  console.log(
    `${stem}: rows plugin=${probe.rows.plugin} native=${probe.rows.native} ` +
      `p95=${probe.allRows.p95.toFixed(1)} task=${(cdpDelta.TaskDuration * 1000).toFixed(0)}ms`,
  );
}

console.log("chrome", context.browser()?.version(), "server", SERVER_ID);
// Modes alternate per fixture (ABBA across reps) so machine-load drift hits both sides.
let current = null;
for (let rep = repStart; rep < repStart + reps; rep++) {
  for (const [index, fixture] of fixtures.entries()) {
    // Two modes keep the old ABBA order. Three or more rotate, so each build
    // leads equally often while the machine load drifts.
    const order =
      modes.length === 2
        ? (rep + index) % 2 === 1
          ? modes
          : [...modes].reverse()
        : modes.map((_, k) => modes[(rep + index + k) % modes.length]);
    for (const mode of order) {
      if (mode !== current) setMode(mode);
      current = mode;
      await run(fixture, mode, rep);
    }
  }
}
await context.close();
