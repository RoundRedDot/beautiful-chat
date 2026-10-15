// Untimed functional identity checks for the before/after Web builds.
//   node web-probes-ba.mjs --reps 3 --out <dir>
import { chromium } from "playwright-core";
import { existsSync, mkdirSync, realpathSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { SERVER_ID, PORT, paseo, BLOCK_WS } from "./guard-ba.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
};
const reps = Number(flag("--reps", "3"));
const repStart = Number(flag("--rep-start", "1"));
const OUT = flag("--out", "/tmp/bc-ba/raw/probes");
const PROFILE = process.env.BC_PROFILE ?? "/tmp/bc-ba/web-profile";
const PROJECT = process.env.BC_PROJECT ?? "/tmp/bc-perf-p0p1/project";
const LINK = process.env.BC_PLUGIN_LINK ?? "/tmp/bc-ba/bench-active";
const DIRS = {
  before: process.env.BC_BEFORE_DIR ?? "/tmp/bc-ba/before",
  before2: process.env.BC_BEFORE2_DIR ?? "/tmp/bc-ba/before2",
  after: process.env.BC_AFTER_DIR ?? "/tmp/bc-ba/after",
};
const MODES = ["before", "before2", "after"];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
mkdirSync(OUT, { recursive: true });

function point(mode) {
  const target = realpathSync(DIRS[mode]);
  if (existsSync(LINK) && realpathSync(LINK) === target) return false;
  if (existsSync(LINK)) unlinkSync(LINK);
  symlinkSync(DIRS[mode], LINK);
  return true;
}

async function setMode(mode) {
  if (point(mode)) paseo("plugin", "reload", "better-paseo");
  for (let attempt = 0; attempt < 60; attempt++) {
    const [row] = JSON.parse(paseo("plugin", "ls", "better-paseo", "--json"));
    if (row?.enabled && row.status === "running") return;
    await sleep(500);
  }
  throw new Error(`plugin not running for ${mode}`);
}

const ctx = await chromium.launchPersistentContext(PROFILE, {
  executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  locale: "zh-CN",
  viewport: { width: 1280, height: 900 },
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.routeWebSocket(BLOCK_WS, (socket) => socket.close());

async function openAgent(mode, label) {
  const expectedPath = realpathSync(DIRS[mode]);
  const pluginPath = realpathSync(LINK);
  if (pluginPath !== expectedPath) throw new Error(`plugin path mismatch: ${mode} -> ${pluginPath}`);
  const [plugin] = JSON.parse(paseo("plugin", "ls", "better-paseo", "--json"));
  if (!plugin?.enabled || plugin.status !== "running") throw new Error(`plugin not running: ${mode}`);
  const agentId = paseo("run", "-d", "-q", "--provider", "bc-bench", "--cwd", PROJECT, "--title", label, "list").trim().split("\n").pop();
  paseo("wait", agentId, "--timeout", "60");
  const url = `http://127.0.0.1:8092/h/${SERVER_ID}/agent/${agentId}`;
  await page.goto(url);
  await page.waitForTimeout(4000);
  const direct = page.getByText("直接连接").first();
  if (await direct.isVisible().catch(() => false)) {
    await direct.click();
    await page.waitForTimeout(800);
    const inputs = page.locator("input");
    await inputs.nth(0).fill("127.0.0.1");
    await inputs.nth(1).fill(String(PORT));
    await page.getByText("连接", { exact: true }).last().click();
    await page.waitForTimeout(5000);
    await page.goto(url);
    await page.waitForTimeout(4000);
  }
  const client = await page.evaluate(() => {
    const snapshot = globalThis.__bcPerf?.snapshot?.();
    return { host: typeof globalThis.__hostPerf?.reset === "function", imageRpc: !!snapshot && Object.hasOwn(snapshot, "imageRpc") };
  });
  if (!client.host || !client.imageRpc) throw new Error(`client identity mismatch: ${JSON.stringify(client)}`);
  return { agentId, mode, pluginPath, pluginStatus: plugin.status, pluginEnabled: plugin.enabled, ...client };
}

async function enableProbe() {
  await page.evaluate(() => globalThis.__bcPerf.enable());
  await page.reload();
  await page.waitForTimeout(5000);
  await page.evaluate(() => globalThis.__bcPerf.reset());
}

async function diffExpand(mode, rep) {
  const stem = `probe-diff-expand-${mode}-r${rep}`;
  const identity = await openAgent(mode, stem);
  await enableProbe();
  paseo("send", identity.agentId, "fixture:diff-large speed:max");
  paseo("wait", identity.agentId, "--timeout", "300");
  await page.waitForTimeout(2500);
  await page.evaluate(() => globalThis.__bcPerf.reset());
  const read = () => page.evaluate(() => {
    const snapshot = globalThis.__bcPerf.snapshot();
    return {
      highlightCacheKey: snapshot.counters["highlight.cacheKey"] ?? 0,
      codeMaxLineNumber: snapshot.counters["code.maxLineNumber"] ?? 0,
      highlightRpc: snapshot.highlightRpc.count,
    };
  });
  const steps = [];
  const row = page.locator('[aria-label^="Edit /Users"]').first();
  await row.scrollIntoViewIfNeeded();
  const bounds = await row.boundingBox();
  if (!bounds) throw new Error("Edit row has no bounding box");
  await page.mouse.click(bounds.x + 6, bounds.y + bounds.height / 2);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(2500);
  steps.push({ step: "expand", ...(await read()) });
  const more = page.getByText(/^Show \d+ more lines$/).first();
  await more.scrollIntoViewIfNeeded();
  await page.mouse.move(5, 5);
  await page.waitForTimeout(300);
  const moreBounds = await more.boundingBox();
  if (!moreBounds) throw new Error("Show more lines has no bounding box");
  await page.mouse.click(moreBounds.x + 20, moreBounds.y + 9);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(7000);
  if ((await page.getByText("Show less", { exact: true }).count()) !== 1) throw new Error("show-all did not complete");
  steps.push({ step: "show-all", ...(await read()) });
  await page.getByText("Show less", { exact: true }).first().click();
  await page.mouse.move(5, 5);
  await page.waitForTimeout(2000);
  steps.push({ step: "show-less", ...(await read()) });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(2500);
  steps.push({ step: "theme-dark", ...(await read()) });
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForTimeout(2500);
  steps.push({ step: "theme-light", ...(await read()) });
  const result = { scenario: "diff-expand", mode, rep, identity, steps };
  writeFileSync(`${OUT}/${stem}.json`, JSON.stringify(result, null, 2));
  await page.evaluate(() => globalThis.__bcPerf.disable());
  try { paseo("archive", identity.agentId); } catch {}
  console.log(stem, JSON.stringify(steps));
}

async function imagesRepeat(mode, rep) {
  const stem = `probe-images-repeat-${mode}-r${rep}`;
  const identity = await openAgent(mode, stem);
  await enableProbe();
  paseo("send", identity.agentId, "fixture:images-repeat-p0 speed:1");
  paseo("wait", identity.agentId, "--timeout", "900");
  await page.waitForTimeout(4000);
  const live = await page.evaluate(() => globalThis.__bcPerf.snapshot());
  await page.reload();
  await page.waitForTimeout(7000);
  const historyLoad = await page.evaluate(() => globalThis.__bcPerf.snapshot());
  const readRow = page.locator('[aria-label^="Read "]').first();
  let afterExpandingReadRow = null;
  if (await readRow.count()) {
    await readRow.scrollIntoViewIfNeeded();
    const bounds = await readRow.boundingBox();
    if (!bounds) throw new Error("Read row has no bounding box");
    await page.mouse.click(bounds.x + 6, bounds.y + bounds.height / 2);
    await page.mouse.move(5, 5);
    await page.waitForTimeout(4000);
    afterExpandingReadRow = await page.evaluate(() => globalThis.__bcPerf.snapshot());
  }
  const renderedImages900px = await page.evaluate(() => [...document.querySelectorAll("img")].filter((image) => image.naturalWidth === 900).length);
  const result = { scenario: "images-repeat", mode, rep, identity, live, historyLoad, afterExpandingReadRow, renderedImages900px };
  writeFileSync(`${OUT}/${stem}.json`, JSON.stringify(result, null, 2));
  await page.evaluate(() => globalThis.__bcPerf.disable());
  try { paseo("archive", identity.agentId); } catch {}
  console.log(stem, JSON.stringify({ live: live.imageRpc, historyLoad: historyLoad.imageRpc, renderedImages900px }));
}

let current = null;
try {
  for (let rep = repStart; rep < repStart + reps; rep++) {
    const order = MODES.map((_, index) => MODES[(rep - repStart + index) % MODES.length]);
    for (const mode of order) {
      if (mode !== current) await setMode(mode);
      current = mode;
      await diffExpand(mode, rep);
      await imagesRepeat(mode, rep);
    }
  }
} finally {
  await ctx.close();
}
