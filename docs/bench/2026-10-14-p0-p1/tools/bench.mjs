// P0/P1 host non-regression bench on the PRIVATE daemon only (guard.mjs).
//   node bench.mjs --scenario diff-expand|diff-large --reps 5 --out <dir> [--rep-start 1]
// Modes: base1/base2 = two copies of 8425dd0, cand = perf/p0-p1 worktree (uncommitted).
// Each run reloads the page on a fresh agent; the plugin bundle identity is asserted per run.
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, realpathSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { SERVER_ID, PORT, paseo, BLOCK_WS, HOME } from "./guard.mjs";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; };
const scenario = flag("--scenario", "diff-expand");
const reps = Number(flag("--reps", "5"));
const repStart = Number(flag("--rep-start", "1"));
const OUT = flag("--out", "/tmp/bc-perf-p0p1/raw");
const MODES = (flag("--modes", "base1,base2,cand")).split(",");
const DIRS = {
  base1: "/tmp/bc-perf-p0p1/base",
  base2: "/tmp/bc-perf-p0p1/base2",
  cand: "/Users/luopeihuan/workspace/rrd/beautiful-chat/.worktrees/perf-p0-p1",
};
const LINK = "/tmp/bc-perf-p0p1/bench-active";
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
  if (point(mode)) paseo("plugin", "reload", "better-paseo");
  for (let i = 0; i < 60; i++) {
    const [row] = JSON.parse(paseo("plugin", "ls", "better-paseo", "--json"));
    if (row.enabled && row.status === "running") return;
    await sleep(500);
  }
  throw new Error(`plugin not running for ${mode}`);
}

const ctx = await chromium.launchPersistentContext("/tmp/bc-perf-p0p1/web-profile", {
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
  const id = paseo("run", "-d", "-q", "--provider", "bc-bench", "--cwd", "/tmp/bc-perf-p0p1/project", "--title", `p1-${stem}`, "list").trim().split("\n").pop();
  try { paseo("wait", id, "--timeout", "60"); } catch {}
  await open(id);
  const isCand = await page.evaluate(() => "imageRpc" in globalThis.__bcPerf.snapshot());
  if (isCand !== (mode === "cand")) throw new Error(`bundle identity mismatch: mode=${mode} isCand=${isCand}`);
  let before, streamMs = 0;
  if (scenario === "diff-large") {
    await page.waitForTimeout(1500);
    await page.evaluate(() => globalThis.__hostPerf.reset());
    before = await metrics();
    const t = Date.now();
    paseo("send", id, "fixture:diff-large speed:1");
    try { paseo("wait", id, "--timeout", "900"); } catch {}
    streamMs = Date.now() - t;
    await page.waitForTimeout(4000);
  } else {
    paseo("send", id, "fixture:diff-large speed:max");
    try { paseo("wait", id, "--timeout", "300"); } catch {}
    await page.waitForTimeout(2500);
    await page.evaluate(() => globalThis.__hostPerf.reset());
    before = await metrics();
    const row = page.locator('[aria-label^="Edit /Users"]').first();
    const b = await row.boundingBox();
    await page.mouse.click(b.x + 6, b.y + b.height / 2); await page.mouse.move(5, 5);
    await page.waitForTimeout(2000);
    const more = await page.getByText(/^Show \d+ more lines$/).first().boundingBox();
    await page.mouse.click(more.x + 20, more.y + 9); await page.mouse.move(5, 5);
    await page.waitForTimeout(7000);
    if ((await page.getByText("Show less").count()) !== 1) throw new Error("show-all did not complete");
    await page.emulateMedia({ colorScheme: "dark" }); await page.waitForTimeout(2500);
    await page.emulateMedia({ colorScheme: "light" }); await page.waitForTimeout(2500);
  }
  const probe = await page.evaluate((l) => globalThis.__hostPerf.snapshot(l), stem);
  const after = await metrics();
  await cdp.send("HeapProfiler.collectGarbage"); await page.waitForTimeout(300);
  const settled = await metrics();
  const delta = {};
  for (const k of ["TaskDuration", "ScriptDuration", "LayoutDuration", "RecalcStyleDuration", "LayoutCount", "RecalcStyleCount"]) delta[k] = after[k] - before[k];
  const result = {
    scenario, mode, rep, slot, agentId: id, plugin: DIRS[mode], pluginIsCandidate: isCand,
    daemon: { home: HOME, port: PORT }, chrome, streamMs,
    machine: { uptimeBefore, uptimeAfter: execFileSync("uptime", { encoding: "utf8" }).trim() },
    probe, cdp: { delta, nodes: settled.Nodes, jsHeapUsedMB: settled.JSHeapUsedSize / 1048576, beforeGc: { nodes: after.Nodes, jsHeapUsedMB: after.JSHeapUsedSize / 1048576 } },
    pageErrors: pageErrors.splice(0),
  };
  writeFileSync(`${OUT}/${stem}.json`, JSON.stringify(result, null, 2));
  await page.screenshot({ path: `${OUT}/${stem}.png` });
  try { paseo("archive", id); } catch {}
  console.log(`${stem}: task=${(delta.TaskDuration * 1000).toFixed(0)}ms script=${(delta.ScriptDuration * 1000).toFixed(0)}ms rowP95=${probe.allRows?.p95?.toFixed?.(1)} heap=${result.cdp.jsHeapUsedMB.toFixed(1)}MB nodes=${settled.Nodes}`);
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
