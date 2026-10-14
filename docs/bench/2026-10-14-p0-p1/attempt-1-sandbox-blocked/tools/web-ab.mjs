import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PRIVATE_TARGET } from "./preflight.mjs";
import { paseo } from "./private-paseo.mjs";
import { sleep, startBrowser } from "./browser-session.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = resolve(SCRIPT_DIR, "..");
const RAW_DIR = join(EVIDENCE_DIR, "raw", "web");
const BASE_DIR = resolve(process.env.BC_BASE_DIR ?? "/tmp/bc-perf-p0p1/base");
const CANDIDATE_DIR = resolve(process.env.BC_CANDIDATE_DIR ?? process.cwd());
const PLUGIN_LINK = resolve(process.env.BC_PLUGIN_LINK ?? "/tmp/bc-perf-p0p1/bench-active");
const WEB_PORT = Number(process.env.BC_WEB_PORT ?? 8092);
const ORIGIN = `http://127.0.0.1:${WEB_PORT}`;
const SERVER_ID = readFileSync(join(PRIVATE_TARGET.home, "server-id"), "utf8").trim();
const BASE_SHA = "8425dd0592345ec6a94e228004bfa820b5d3c9e3";
const HOST_SHA = process.env.BC_HOST_SHA256 ?? "unrecorded";
const CANDIDATE_ID = process.env.BC_CANDIDATE_ID ?? "8425dd0+uncommitted";

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
}

const scenario = arg("--scenario", "diff-large");
const reps = Number(arg("--reps", "3"));
const repStart = Number(arg("--rep-start", "1"));
if (!["diff-large", "theme-switch"].includes(scenario)) throw new Error(`Unsupported scenario ${scenario}`);
if (!Number.isInteger(reps) || reps < 1 || !Number.isInteger(repStart) || repStart < 1) {
  throw new Error("--reps and --rep-start must be positive integers");
}
if (new Set([6767, 6868, 6869]).has(WEB_PORT) || WEB_PORT === 8082) {
  throw new Error(`Refusing forbidden/reserved web port ${WEB_PORT}`);
}
if (!existsSync(BASE_DIR) || !existsSync(CANDIDATE_DIR)) throw new Error("Baseline or candidate plugin directory is missing");
if (!PLUGIN_LINK.startsWith("/tmp/bc-perf-p0p1/")) throw new Error(`Refusing plugin link outside private temp dir: ${PLUGIN_LINK}`);
if (!EVIDENCE_DIR.startsWith(resolve(process.cwd(), "docs/bench/2026-10-14-p0-p1"))) {
  throw new Error(`Refusing output path outside evidence directory: ${EVIDENCE_DIR}`);
}
mkdirSync(RAW_DIR, { recursive: true });

const orders = [
  ["baseline", "baseline", "candidate"],
  ["baseline", "candidate", "baseline"],
  ["candidate", "baseline", "baseline"],
  ["baseline", "baseline", "candidate"],
  ["baseline", "candidate", "baseline"],
];
let currentTarget = "";

function pluginRow() {
  const parsed = JSON.parse(paseo("plugin", "ls", "better-paseo", "--json"));
  const row = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!row) throw new Error("better-paseo is not installed in the private daemon");
  return row;
}

function pointPlugin(mode) {
  const target = mode === "baseline" ? BASE_DIR : CANDIDATE_DIR;
  const next = realpathSync(target);
  if (existsSync(PLUGIN_LINK)) {
    if (!lstatSync(PLUGIN_LINK).isSymbolicLink()) throw new Error(`Refusing to replace non-symlink ${PLUGIN_LINK}`);
    if (realpathSync(PLUGIN_LINK) === next) return false;
    unlinkSync(PLUGIN_LINK);
  }
  symlinkSync(target, PLUGIN_LINK, "dir");
  return true;
}

async function setMode(mode) {
  const switched = pointPlugin(mode);
  const row = pluginRow();
  if (!row.enabled) paseo("plugin", "enable", "better-paseo");
  if (switched && row.enabled) paseo("plugin", "reload", "better-paseo");
  if (switched && !row.enabled) paseo("plugin", "reload", "better-paseo");
  for (let attempt = 0; attempt < 30; attempt++) {
    const state = pluginRow();
    if (state.enabled && state.status === "running") {
      currentTarget = mode;
      return;
    }
    await sleep(500);
  }
  throw new Error(`better-paseo did not reach running state for ${mode}`);
}

async function clickText(browser, text) {
  const found = await browser.evaluate(`(() => {
    const wanted = ${JSON.stringify(text)};
    const leaves = [...document.querySelectorAll("*")].filter((element) =>
      element.childElementCount === 0 && element.textContent?.trim() === wanted
    );
    const target = leaves[0]?.closest("button,[role=button],[tabindex],a") ?? leaves[0];
    if (!target) return false;
    target.click();
    return true;
  })()`);
  return found === true;
}

async function fillInput(browser, index, value) {
  return browser.evaluate(`(() => {
    const fields = [...document.querySelectorAll("input")].filter((field) => {
      const rect = field.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const field = fields[${index}];
    if (!field) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(field, ${JSON.stringify(value)});
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
}

async function ensureHost(browser) {
  const hasDirect = await browser.evaluate('document.body?.innerText?.includes("直接连接") ?? false');
  if (!hasDirect) return;
  if (!(await clickText(browser, "直接连接"))) throw new Error("Direct connection entry was visible but not clickable");
  await sleep(800);
  if (!(await fillInput(browser, 0, "127.0.0.1"))) throw new Error("Direct connection host field was not found");
  if (!(await fillInput(browser, 1, String(PRIVATE_TARGET.port)))) throw new Error("Direct connection port field was not found");
  if (!(await clickText(browser, "连接"))) throw new Error("Direct connection button was not found");
  await sleep(5000);
}

async function openAgent(browser, id) {
  const url = `${ORIGIN}/h/${SERVER_ID}/agent/${id}`;
  await browser.navigate(url);
  await sleep(3500);
  await ensureHost(browser);
  if (await browser.evaluate('document.body?.innerText?.includes("直接连接") ?? false')) {
    await browser.navigate(url);
    await sleep(3500);
  }
  const hasHostProbe = await browser.evaluate("Boolean(globalThis.__hostPerf?.snapshot)");
  if (!hasHostProbe) {
    const text = await browser.evaluate("document.body?.innerText?.slice(0, 500) ?? ''");
    throw new Error(`Instrumented host probe is missing; page starts with: ${String(text).slice(0, 220)}`);
  }
}

async function cdpMetrics(browser) {
  return browser.metrics();
}

async function sendFixture(id, speed) {
  const start = Date.now();
  paseo("send", id, `fixture:${scenario === "diff-large" ? "diff-large" : "diff-large"} speed:${speed}`);
  let waitError = "";
  try {
    paseo("wait", id, "--timeout", "900");
  } catch (error) {
    waitError = String(error).slice(0, 240);
  }
  return { streamMs: Date.now() - start, waitError };
}

async function run(mode, rep, slot, browser) {
  await setMode(mode);
  const label = `web-${mode}-${scenario}-r${rep}-s${slot}`;
  const outPath = join(RAW_DIR, `${label}.json`);
  if (existsSync(outPath)) throw new Error(`Refusing to overwrite ${outPath}`);
  const uptimeBefore = execFileSync("uptime", [], { encoding: "utf8" }).trim();
  const id = paseo(
    "run", "-d", "-q", "--provider", "bc-bench", "--cwd", "/tmp/bc-perf-p0p1/project",
    "--title", `phase-b-${label}`, "list",
  ).trim().split("\n").pop();
  try {
    paseo("wait", id, "--timeout", "60");
  } catch {}
  await openAgent(browser, id);
  await sleep(1000);
  await browser.evaluate("globalThis.__hostPerf.reset()");
  const before = await cdpMetrics(browser);
  const stream = await sendFixture(id, "1");

  if (scenario === "theme-switch") {
    await sleep(1500);
    await browser.evaluate("globalThis.__hostPerf.reset()");
  }
  const metricStart = scenario === "theme-switch" ? await cdpMetrics(browser) : before;
  if (scenario === "theme-switch") {
    await browser.cdp.send("Emulation.setEmulatedMedia", {
      media: "screen",
      features: [
        { name: "prefers-color-scheme", value: "dark" },
        { name: "prefers-reduced-motion", value: "reduce" },
      ],
    });
    await sleep(1500);
  } else {
    await sleep(4000);
  }
  const probe = await browser.evaluate(`globalThis.__hostPerf.snapshot(${JSON.stringify(label)})`);
  const after = await cdpMetrics(browser);
  await browser.cdp.send("HeapProfiler.collectGarbage");
  await sleep(300);
  const settled = await cdpMetrics(browser);
  const cdpDelta = {};
  for (const key of ["TaskDuration", "ScriptDuration", "LayoutDuration", "RecalcStyleDuration"]) {
    cdpDelta[key] = after[key] - metricStart[key];
  }
  const blockedWsAttempts = await browser.evaluate("globalThis.__bcBlockedWsAttempts ?? []");
  const result = {
    scenario,
    fixture: "diff-large",
    speed: 1,
    mode,
    rep,
    slot,
    pair: rep,
    agentId: id,
    pluginSha: mode === "baseline" ? BASE_SHA : CANDIDATE_ID,
    hostArtifactSha256: HOST_SHA,
    buildMode: "production web export; instrumented host probe active",
    platform: `Web / Chrome ${process.env.BC_CHROME_VERSION ?? "unknown"}`,
    settings: { theme: scenario === "theme-switch" ? "light-to-dark" : "light", reducedMotion: true, viewport: "1280x900" },
    machine: { uptimeBefore, uptimeAfter: execFileSync("uptime", [], { encoding: "utf8" }).trim() },
    streamMs: stream.streamMs,
    waitError: stream.waitError,
    probe,
    cdp: {
      delta: cdpDelta,
      nodes: settled.Nodes,
      jsHeapUsedMB: settled.JSHeapUsedSize / 1048576,
      beforeGc: { nodes: after.Nodes, jsHeapUsedMB: after.JSHeapUsedSize / 1048576 },
    },
    blockedWsAttempts,
    pageExceptions: browser.exceptions.slice(-20),
  };
  await browser.screenshot(join(RAW_DIR, `${label}.png`));
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  try {
    paseo("archive", id);
  } catch {}
  console.log(`${label}: task=${cdpDelta.TaskDuration.toFixed(3)}s rowP95=${probe.allRows?.p95 ?? "n/a"}ms blockedWS=${blockedWsAttempts.length}`);
}

const browser = await startBrowser();
try {
  const serverIdInHome = readFileSync(join(PRIVATE_TARGET.home, "server-id"), "utf8").trim();
  if (serverIdInHome !== SERVER_ID) throw new Error("Private server id changed unexpectedly");
  for (let rep = repStart; rep < repStart + reps; rep++) {
    const order = orders[(rep - 1) % orders.length];
    for (const [index, mode] of order.entries()) await run(mode, rep, index + 1, browser);
  }
} finally {
  await browser.close();
}
