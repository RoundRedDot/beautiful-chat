// Timed diff-expand and repeated-image Web scenarios on the private 6871 daemon.
//   node web-special-ba.mjs --scenario diff-expand|images-repeat --reps 5 --out <dir>
// before/before2/after rotate per rep. Build identity uses the resolved plugin
// link; optimization identity is checked separately by web-probes-ba.mjs.
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, realpathSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { SERVER_ID, PORT, paseo, BLOCK_WS, HOME } from "./guard-ba.mjs";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; };
const scenario = flag("--scenario", "diff-expand");
const reps = Number(flag("--reps", "5"));
const repStart = Number(flag("--rep-start", "1"));
const OUT = flag("--out", "/tmp/bc-ba/raw/web-special");
const MODES = flag("--modes", "before,before2,after").split(",");
const PROFILE = process.env.BC_PROFILE ?? "/tmp/bc-ba/web-profile";
const PROJECT = process.env.BC_PROJECT ?? "/tmp/bc-perf-p0p1/project";
const DIRS = {
  before: process.env.BC_BEFORE_DIR ?? "/tmp/bc-ba/before",
  before2: process.env.BC_BEFORE2_DIR ?? "/tmp/bc-ba/before2",
  after: process.env.BC_AFTER_DIR ?? "/tmp/bc-ba/after",
};
const LINK = process.env.BC_PLUGIN_LINK ?? "/tmp/bc-ba/bench-active";
mkdirSync(OUT, { recursive: true });

function point(mode) {
  const next = realpathSync(DIRS[mode]);
  if (existsSync(LINK)) {
    if (!lstatSync(LINK).isSymbolicLink()) throw new Error("link is not a symlink");
    if (realpathSync(LINK) === next) return false;
    unlinkSync(LINK);
  }
  symlinkSync(DIRS[mode], LINK);
  return true;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function setMode(mode) {
  if (!DIRS[mode]) throw new Error(`unknown mode ${mode}`);
  if (point(mode)) paseo("plugin", "reload", "better-paseo");
  for (let i = 0; i < 60; i++) {
    const [row] = JSON.parse(paseo("plugin", "ls", "better-paseo", "--json"));
    if (row.enabled && row.status === "running") return;
    await sleep(500);
  }
  throw new Error(`plugin not running for ${mode}`);
}

const ctx = await chromium.launchPersistentContext(PROFILE, {
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true, locale: "zh-CN", viewport: { width: 1280, height: 900 },
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.routeWebSocket(BLOCK_WS, (ws) => ws.close());
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));
const cdp = await ctx.newCDPSession(page);
await cdp.send("Performance.enable", { timeDomain: "threadTicks" });
const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
const chrome = ctx.browser()?.version() ?? "unknown";

async function open(id) {
  const url = `http://127.0.0.1:8092/h/${SERVER_ID}/agent/${id}`;
  await page.goto(url); await page.waitForTimeout(4000);
  const direct = page.getByText("直接连接").first();
  if (await direct.isVisible().catch(() => false)) {
    await direct.click(); await page.waitForTimeout(800);
    const inputs = page.locator("input");
    await inputs.nth(0).fill("127.0.0.1"); await inputs.nth(1).fill(String(PORT));
    await page.getByText("连接", { exact: true }).last().click(); await page.waitForTimeout(5000);
  }
  if (!page.url().includes("/agent/")) { await page.goto(url); await page.waitForTimeout(4000); }
}

async function run(mode, rep, slot) {
  const stem = `${scenario}-${mode}-r${rep}`;
  if (existsSync(`${OUT}/${stem}.json`)) throw new Error(`${stem} exists`);
  const uptimeBefore = execFileSync("uptime", { encoding: "utf8" }).trim();
  await page.emulateMedia({ colorScheme: "light" });
  const id = paseo("run", "-d", "-q", "--provider", "bc-bench", "--cwd", PROJECT, "--title", `ba-${stem}`, "list").trim().split("\n").pop();
  try { paseo("wait", id, "--timeout", "60"); } catch {}
  await open(id);
  const pluginPath = realpathSync(LINK);
  if (pluginPath !== realpathSync(DIRS[mode])) throw new Error(`plugin path mismatch for ${mode}: ${pluginPath}`);
  const [plugin] = JSON.parse(paseo("plugin", "ls", "better-paseo", "--json"));
  if (!plugin?.enabled || plugin.status !== "running") throw new Error(`plugin is not running: ${JSON.stringify({ enabled: plugin?.enabled, status: plugin?.status })}`);
  const identity = await page.evaluate(() => {
    const snapshot = globalThis.__bcPerf?.snapshot?.();
    return { host: typeof globalThis.__hostPerf?.reset === "function", imageRpc: !!snapshot && Object.hasOwn(snapshot, "imageRpc") };
  });
  if (!identity.host || !identity.imageRpc) throw new Error(`client identity missing: ${JSON.stringify(identity)}`);
  await page.evaluate(() => globalThis.__bcPerf?.disable?.());
  await page.waitForTimeout(300);
  let details;
  if (scenario === "diff-expand") {
    paseo("send", id, "fixture:diff-large speed:max");
    try { paseo("wait", id, "--timeout", "300"); } catch {}
    await page.waitForTimeout(2500);
    await page.evaluate(() => globalThis.__hostPerf.reset());
    const before = await metrics();
    const started = Date.now();
    const row = page.locator('[aria-label^="Edit /Users"]').first();
    await row.scrollIntoViewIfNeeded();
    const b = await row.boundingBox();
    if (!b) throw new Error("Edit row has no bounding box");
    await page.mouse.click(b.x + 6, b.y + b.height / 2); await page.mouse.move(5, 5);
    await page.waitForTimeout(2000);
    const moreLoc = page.getByText(/^Show \d+ more lines$/).first();
    await moreLoc.scrollIntoViewIfNeeded(); await page.mouse.move(5, 5); await page.waitForTimeout(300);
    const more = await moreLoc.boundingBox();
    if (!more) throw new Error("Show more lines has no bounding box");
    await page.mouse.click(more.x + 20, more.y + 9); await page.mouse.move(5, 5);
    await page.waitForTimeout(7000);
    if ((await page.getByText("Show less").count()) !== 1) { await page.screenshot({ path: `${OUT}/${stem}-FAILED.png` }); throw new Error("show-all did not complete"); }
    await page.emulateMedia({ colorScheme: "dark" }); await page.waitForTimeout(2500);
    await page.emulateMedia({ colorScheme: "light" }); await page.waitForTimeout(2500);
    const probe = await page.evaluate((l) => globalThis.__hostPerf.snapshot(l), stem);
    const after = await metrics();
    await cdp.send("HeapProfiler.collectGarbage"); await page.waitForTimeout(300);
    const settled = await metrics();
    const delta = {};
    for (const k of ["TaskDuration", "ScriptDuration", "LayoutDuration", "RecalcStyleDuration", "LayoutCount", "RecalcStyleCount"]) delta[k] = after[k] - before[k];
    details = { streamMs: null, windowMs: Date.now() - started, probe,
      cdp: { delta, nodes: settled.Nodes, jsHeapUsedMB: settled.JSHeapUsedSize / 1048576, beforeGc: { nodes: after.Nodes, jsHeapUsedMB: after.JSHeapUsedSize / 1048576 } } };
  } else if (scenario === "images-repeat") {
    await page.evaluate(() => globalThis.__hostPerf.reset());
    const beforeLive = await metrics();
    const startedLive = Date.now();
    paseo("send", id, "fixture:images-repeat-p0 speed:1");
    try { paseo("wait", id, "--timeout", "900"); } catch {}
    const streamMs = Date.now() - startedLive;
    await page.waitForTimeout(4000);
    const liveProbe = await page.evaluate((l) => globalThis.__hostPerf.snapshot(l), `${stem}-live`);
    const afterLive = await metrics();
    await cdp.send("HeapProfiler.collectGarbage"); await page.waitForTimeout(300);
    const settledLive = await metrics();
    const startedHistory = Date.now();
    await page.reload();
    await page.waitForTimeout(7000);
    const historyProbe = await page.evaluate((l) => globalThis.__hostPerf.snapshot(l), `${stem}-history`);
    const afterHistory = await metrics();
    const historyMs = Date.now() - startedHistory;
    const historyIdentity = await page.evaluate(() => {
      const snapshot = globalThis.__bcPerf?.snapshot?.();
      return { host: typeof globalThis.__hostPerf?.reset === "function", imageRpc: !!snapshot && Object.hasOwn(snapshot, "imageRpc") };
    });
    if (!historyIdentity.host || !historyIdentity.imageRpc) throw new Error(`history identity missing: ${JSON.stringify(historyIdentity)}`);
    await cdp.send("HeapProfiler.collectGarbage"); await page.waitForTimeout(300);
    const settledHistory = await metrics();
    const deltaFor = (before, after) => Object.fromEntries(["TaskDuration", "ScriptDuration", "LayoutDuration", "RecalcStyleDuration", "LayoutCount", "RecalcStyleCount"].map((k) => [k, after[k] - before[k]]));
    const sinceNavigation = (metrics) => Object.fromEntries(["TaskDuration", "ScriptDuration", "LayoutDuration", "RecalcStyleDuration", "LayoutCount", "RecalcStyleCount"].map((k) => [k, metrics[k]]));
    details = {
      live: { streamMs, windowMs: Date.now() - startedLive, probe: liveProbe,
        cdp: { delta: deltaFor(beforeLive, afterLive), nodes: settledLive.Nodes, jsHeapUsedMB: settledLive.JSHeapUsedSize / 1048576, beforeGc: { nodes: afterLive.Nodes, jsHeapUsedMB: afterLive.JSHeapUsedSize / 1048576 } } },
      historyLoad: { windowMs: historyMs, probe: historyProbe,
        cdp: { delta: sinceNavigation(afterHistory), metricWindow: "current document through 7s settle", nodes: settledHistory.Nodes, jsHeapUsedMB: settledHistory.JSHeapUsedSize / 1048576, beforeGc: { nodes: afterHistory.Nodes, jsHeapUsedMB: afterHistory.JSHeapUsedSize / 1048576 } } },
    };
  } else {
    throw new Error(`unknown scenario ${scenario}`);
  }
  const result = {
    scenario, mode, rep, slot, agentId: id, plugin: DIRS[mode], identity: { ...identity, pluginPath, pluginStatus: plugin.status, pluginEnabled: plugin.enabled },
    daemon: { home: HOME, port: PORT }, chrome, details,
    machine: { uptimeBefore, uptimeAfter: execFileSync("uptime", { encoding: "utf8" }).trim() },
    pageErrors: pageErrors.splice(0),
  };
  writeFileSync(`${OUT}/${stem}.json`, JSON.stringify(result, null, 2));
  try { paseo("archive", id); } catch {}
  if (scenario === "diff-expand") {
    console.log(`${stem}: task=${(details.cdp.delta.TaskDuration * 1000).toFixed(0)}ms script=${(details.cdp.delta.ScriptDuration * 1000).toFixed(0)}ms rowP95=${details.probe.allRows?.p95?.toFixed?.(1)} heap=${details.cdp.jsHeapUsedMB.toFixed(1)}MB nodes=${details.cdp.nodes}`);
  } else {
    console.log(`${stem}: live-task=${(details.live.cdp.delta.TaskDuration * 1000).toFixed(0)}ms history-task=${(details.historyLoad.cdp.delta.TaskDuration * 1000).toFixed(0)}ms`);
  }
}

console.log("chrome", chrome, "server", SERVER_ID, "port", PORT);
let current = null;
for (let rep = repStart; rep < repStart + reps; rep++) {
  const order = MODES.map((_, k) => MODES[(rep + k) % MODES.length]);
  for (const [slot, mode] of order.entries()) {
    if (mode !== current) await setMode(mode);
    current = mode;
    await run(mode, rep, slot + 1);
  }
}
await ctx.close();
