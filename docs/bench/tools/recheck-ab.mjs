// A/B: official baseline plugin (bc-base) vs this branch (bc-pr) on the Paseo web
// production build, isolated daemon ~/.paseo-bench-pr (127.0.0.1:6870), web on :8093.
//   node ab.mjs --reps 3 --out <dir> [--modes base,pr] fixture:speed ...
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";

const HOME = `${process.env.HOME}/.paseo-bench-pr`;
const SERVER_ID = readFileSync(`${HOME}/server-id`, "utf8").trim();
const ORIGIN = "http://127.0.0.1:8093";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PROFILE = "/tmp/bc-pr-web-profile";
const PROJECT = "/tmp/bc-pr-proj";
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  const [v] = args.splice(i, 2).slice(1);
  return v;
};
const reps = Number(flag("--reps", "1"));
const OUT = flag("--out", "/tmp/bc-pr-out");
const modes = flag("--modes", "base,pr").split(",");
const fixtures = args.map((s) => { const [name, speed] = s.split(":"); return { name, speed: speed ?? "1" }; });
mkdirSync(OUT, { recursive: true });
mkdirSync(PROJECT, { recursive: true });
const paseo = (...rest) => execFileSync("paseo", ["--home", HOME, ...rest], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const PLUGIN = { base: "bc-base", main: "bc-main", pr: "bc-pr", ascii: "bc-ascii" };

function setMode(mode) {
  for (const [m, id] of Object.entries(PLUGIN)) if (m !== mode) { try { paseo("plugin", "disable", id); } catch (e) { if (!/already|not running|disabled/i.test(String(e.stderr))) throw e; } }
  try { paseo("plugin", "enable", PLUGIN[mode]); } catch (e) { if (!String(e.stderr).includes("already running")) throw e; }
  for (let a = 0; a < 60; a++) {
    const rows = JSON.parse(paseo("plugin", "ls", "--json"));
    const want = rows.find((r) => r.id === PLUGIN[mode] || r.plugin === PLUGIN[mode]);
    if (want && want.status === "running") return;
    execFileSync("sleep", ["1"]);
  }
  throw new Error(`mode ${mode} not ready`);
}

const context = await chromium.launchPersistentContext(PROFILE, {
  executablePath: CHROME, headless: true, locale: "zh-CN", viewport: { width: 1280, height: 900 },
});
const page = context.pages()[0] ?? (await context.newPage());
await page.routeWebSocket(/:(6767|6868|6869)\//, (ws) => ws.close());
page.on("pageerror", (e) => console.log("pageerror", String(e).slice(0, 200)));
let cdp;
async function heap() {
  const { metrics } = await cdp.send("Performance.getMetrics");
  return metrics.find((m) => m.name === "JSHeapUsedSize").value / 1048576;
}
async function ensureHost() {
  const direct = page.getByText("直接连接").first();
  if (await direct.isVisible().catch(() => false)) {
    await direct.click();
    await page.waitForTimeout(800);
    const inputs = page.locator("input");
    await inputs.nth(0).fill("127.0.0.1");
    await inputs.nth(1).fill("6870");
    await page.getByText("连接", { exact: true }).last().click();
    await page.waitForTimeout(5000);
  }
}
async function open(url) {
  await page.goto(url);
  await page.waitForTimeout(4000);
  await ensureHost();
  if (!page.url().includes("/agent/")) { await page.goto(url); await page.waitForTimeout(4000); }
}
async function command(text) {
  await page.mouse.click(800, 800);
  await page.waitForTimeout(300);
  await page.keyboard.type(text, { delay: 15 });
  await page.waitForTimeout(400);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(900);
}
async function run(fixture, mode, rep) {
  const id = paseo("run", "-d", "-q", "--provider", "bc-bench", "--cwd", PROJECT, "--title", `pr-${mode}-${fixture.name}-${rep}`, "list").trim().split("\n").pop();
  try { paseo("wait", id, "--timeout", "60"); } catch {}
  await open(`${ORIGIN}/h/${SERVER_ID}/agent/${id}`);
  cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  await page.waitForTimeout(1500);
  await command("/bc-perf on");
  await command("/bc-perf reset");
  await cdp.send("HeapProfiler.collectGarbage");
  const heapStart = await heap();
  const started = Date.now();
  paseo("send", id, `fixture:${fixture.name} speed:${fixture.speed}`);
  try { paseo("wait", id, "--timeout", "900"); } catch (e) { console.log("wait failed", String(e).slice(0, 120)); }
  const streamMs = Date.now() - started;
  await page.waitForTimeout(4000);
  const label = `prab-${mode}-${fixture.name}-r${rep}`;
  const heapEnd = await heap();
  await command(`/bc-perf dump ${label}`);
  await page.waitForTimeout(2500);
  await cdp.send("HeapProfiler.collectGarbage");
  await page.waitForTimeout(500);
  await cdp.send("HeapProfiler.collectGarbage");
  const heapRetained = await heap();
  const dumpFile = readdirSync("/tmp/bc-perf").filter((f) => f.includes(label)).pop();
  const result = { fixture: fixture.name, speed: fixture.speed, mode, rep, agentId: id, streamMs, heapStart, heapEnd, heapRetained, dumpFile };
  writeFileSync(`${OUT}/${label}.json`, JSON.stringify(result, null, 2));
  await page.screenshot({ path: `${OUT}/${label}.png` });
  try { paseo("archive", id); } catch {}
  console.log(`${label}: end ${heapEnd.toFixed(1)}MB retained ${heapRetained.toFixed(1)}MB start ${heapStart.toFixed(1)} dump ${dumpFile ?? "NONE"} ${streamMs}ms`);
}
console.log("chrome", context.browser()?.version(), "server", SERVER_ID);
let current = null;
for (let rep = 1; rep <= reps; rep++) {
  for (const [index, fixture] of fixtures.entries()) {
    const order = (rep + index) % 2 === 1 ? modes : [...modes].reverse();
    for (const mode of order) {
      if (mode !== current) setMode(mode);
      current = mode;
      await run(fixture, mode, rep);
    }
  }
}
await context.close();
