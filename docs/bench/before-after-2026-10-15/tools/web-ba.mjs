// Three-copy before/after benchmark, using the same host and fixtures.
//
//   node web-ab.mjs --reps 3 --out <dir> [fixture:speed ...]
//
// Needs the private 6871 daemon, bc-bench, three plugin copies, and the
// instrumented production web export on :8092. The daemon plugin link is
// retargeted and reloaded for every mode transition. Each run records the
// resolved link target, host probe, and CDP metrics. Optimization identity is
// confirmed separately by web-probes-ba.mjs, with probes outside timed runs.
//
// Overrides (defaults are the paths above): BC_BENCH_HOME, BC_BENCH_PORT,
// BC_PROJECT, BC_PROFILE, BC_PASEO_BIN, BC_ORIGIN.
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";

const HOME = process.env.BC_BENCH_HOME ?? `${process.env.HOME}/.paseo-bench-ab`;
const PORT = process.env.BC_BENCH_PORT ?? "6869";
const SERVER_ID = readFileSync(`${HOME}/server-id`, "utf8").trim();
const ORIGIN = process.env.BC_ORIGIN ?? "http://127.0.0.1:8092";
const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PROFILE = process.env.BC_PROFILE ?? "/tmp/bcnp-web-profile";
const PROJECT = process.env.BC_PROJECT ?? "/tmp/bcnp-proj";
// Ports of daemons this measurement must not talk to. The live bench port is
// left open, so the default 6869 daemon still connects and 6767|6868 stay closed.
const BLOCKED_PORTS = ["6767", "6868", "6869"].filter((port) => port !== String(PORT));
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
const modes = flag("--modes", "before,before2,after").split(",");
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
mkdirSync(PROJECT, { recursive: true });

const PASEO_BIN = process.env.BC_PASEO_BIN ?? "paseo";
const paseo = (...rest) =>
  execFileSync(PASEO_BIN, ["--home", HOME, ...rest], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

// Optional: one directory install whose symlink is retargeted per mode, so native,
// the current fork, and the upstream plugin share one daemon and one page.
//   BC_PLUGIN_LINK  symlink the daemon's better-paseo path points at
//   BC_BEFORE_DIR, BC_BEFORE2_DIR, BC_AFTER_DIR
const PLUGIN_LINK = process.env.BC_PLUGIN_LINK ?? "";
const PLUGIN_TARGETS = {
  before: process.env.BC_BEFORE_DIR ?? "",
  before2: process.env.BC_BEFORE2_DIR ?? "",
  after: process.env.BC_AFTER_DIR ?? "",
};

function pointPlugin(mode) {
  const target = PLUGIN_TARGETS[mode];
  if (!target) {
    throw new Error(`no plugin directory for mode ${mode}`);
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
  const [now] = JSON.parse(paseo("plugin", "ls", "better-paseo", "--json"));
  if (now.enabled !== pluginOn) paseo("plugin", pluginOn ? "enable" : "disable", "better-paseo");
  // enable can keep the bundle compiled before the symlink moved, so reload after a swap.
  if (swapped && pluginOn) paseo("plugin", "reload", "better-paseo");
  for (let attempt = 0; attempt < 30; attempt++) {
    const [row] = JSON.parse(paseo("plugin", "ls", "better-paseo", "--json"));
    const ready = pluginOn ? row.status === "running" : row.enabled === false;
    if (ready) return;
    execFileSync("sleep", ["1"]);
  }
  throw new Error(`better-paseo did not reach mode ${mode}`);
}

const context = await chromium.launchPersistentContext(PROFILE, {
  executablePath: CHROME,
  headless: true,
  locale: "zh-CN",
  viewport: { width: 1280, height: 900 },
});
const page = context.pages()[0] ?? (await context.newPage());
// Never let the web app reach the user's daemons or the other bench ports.
if (BLOCKED_PORTS.length) {
  await page.routeWebSocket(new RegExp(`:(${BLOCKED_PORTS.join("|")})/`), (ws) => ws.close());
}
const pageErrors = [];
page.on("pageerror", (error) => {
  const text = String(error).slice(0, 500);
  pageErrors.push(text);
  console.log("pageerror", text.slice(0, 200));
});
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
    await inputs.nth(1).fill(String(PORT));
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

async function readIdentity() {
  return page.evaluate(() => {
    let imageRpc = false;
    try {
      const snap = globalThis.__bcPerf?.snapshot?.();
      imageRpc = !!snap && Object.prototype.hasOwnProperty.call(snap, "imageRpc");
    } catch {
      imageRpc = false;
    }
    return {
      imageRpc,
      upstream: document.getElementById("beautiful-chat-frosted") !== null,
      host: typeof globalThis.__hostPerf?.reset === "function",
    };
  });
}

function identityMatches(mode, seen) {
  if (!seen?.host) return false;
  return Object.hasOwn(PLUGIN_TARGETS, mode) && seen.imageRpc && !seen.upstream;
}

async function assertIdentity(mode) {
  const expectedPath = realpathSync(PLUGIN_TARGETS[mode]);
  const pluginPath = realpathSync(PLUGIN_LINK);
  if (pluginPath !== expectedPath) {
    throw new Error(`plugin link mismatch: mode=${mode} expected=${expectedPath} actual=${pluginPath}`);
  }
  const [plugin] = JSON.parse(paseo("plugin", "ls", "better-paseo", "--json"));
  if (!plugin?.enabled || plugin.status !== "running") {
    throw new Error(`plugin not running for ${mode}: ${JSON.stringify({ enabled: plugin?.enabled, status: plugin?.status })}`);
  }
  const deadline = Date.now() + 20000;
  let seen = null;
  while (Date.now() < deadline) {
    seen = await readIdentity();
    if (identityMatches(mode, seen)) {
      return { ...seen, mode, pluginPath, pluginStatus: plugin.status, pluginEnabled: plugin.enabled };
    }
    if (seen.upstream || (seen.host && !seen.imageRpc)) break;
    await page.waitForTimeout(400);
  }
  throw new Error(`identity mismatch for ${mode}: ${JSON.stringify(seen)}`);
}

async function run(fixture, mode, rep) {
  const label = mode === "fork" ? forkLabel : mode;
  const stem = `web-${label}${reducedMotion ? "rm" : ""}-${fixture.name}-r${rep}`;
  if (existsSync(`${OUT}/${stem}.json`)) throw new Error(`${stem}.json exists; use another --out`);
  const id = paseo(
    "run", "-d", "-q", "--provider", "bc-bench", "--cwd", PROJECT,
    "--title", `ab-${mode}-${fixture.name}-${rep}`, "list",
  ).trim().split("\n").pop();
  const errorMark = pageErrors.length;
  try {
    try {
      paseo("wait", id, "--timeout", "60");
    } catch {}
    await open(`${ORIGIN}/h/${SERVER_ID}/agent/${id}`);
    await page.waitForTimeout(1500);
    const identity = await assertIdentity(mode);
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
      identity,
      pageErrors: pageErrors.slice(errorMark),
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
    console.log(
      `${stem}: identity fork=${identity.fork} upstream=${identity.upstream} ` +
        `rows plugin=${probe.rows.plugin} native=${probe.rows.native} ` +
        `p95=${probe.allRows.p95.toFixed(1)} task=${(cdpDelta.TaskDuration * 1000).toFixed(0)}ms`,
    );
  } finally {
    try {
      paseo("archive", id);
    } catch {}
  }
}

console.log(
  "chrome", context.browser()?.version(),
  "server", SERVER_ID,
  "home", HOME,
  "port", PORT,
  "origin", ORIGIN,
  "blocked", BLOCKED_PORTS.join("|"),
  "pluginTargets", JSON.stringify(Object.fromEntries(Object.entries(PLUGIN_TARGETS).map(([mode, path]) => [mode, realpathSync(path)]))),
);
// Modes alternate per fixture (ABBA across reps) so machine-load drift hits both sides.
let current = null;
try {
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
} finally {
  await context.close();
}
