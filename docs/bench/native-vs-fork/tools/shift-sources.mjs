// Where the layout shift comes from: every layout-shift entry with its sources.
//   node shift-sources.mjs <native|fork> <fixture> <speed> [out.json]
// Same daemon and web export as web-ab.mjs. Prints the total, how it splits between
// "the list moved" (every source shifted by the same dy) and in-place reflow, and the
// sources that contribute most.
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const [mode, fixture, speed = "1", out] = process.argv.slice(2);
const HOME = `${process.env.HOME}/.paseo-bench-ab`;
const SERVER_ID = readFileSync(`${HOME}/server-id`, "utf8").trim();
const paseo = (...rest) =>
  execFileSync("paseo", ["--home", HOME, ...rest], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const [row] = JSON.parse(paseo("plugin", "ls", "better-paseo", "--json"));
if (row.enabled !== (mode === "fork")) {
  paseo("plugin", mode === "fork" ? "enable" : "disable", "better-paseo");
  execFileSync("sleep", ["3"]);
}

const context = await chromium.launchPersistentContext("/tmp/bcnp-web-profile", {
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  locale: "zh-CN",
  viewport: { width: 1280, height: 900 },
});
const page = context.pages()[0] ?? (await context.newPage());
await page.routeWebSocket(/:(6767|6868)\//, (ws) => ws.close());
await page.addInitScript(() => {
  const describe = (node) => {
    if (!node || node.nodeType !== 1) return node ? `#${node.nodeName}` : "?";
    const text = (node.textContent || "").trim().slice(0, 40).replace(/\s+/g, " ");
    const testId = node.getAttribute("data-testid");
    return `${node.tagName.toLowerCase()}${testId ? `[${testId}]` : ""} "${text}"`;
  };
  globalThis.__shifts = [];
  globalThis.__shiftOn = false;
  new PerformanceObserver((list) => {
    if (!globalThis.__shiftOn) return;
    for (const entry of list.getEntries()) {
      if (entry.hadRecentInput) continue;
      globalThis.__shifts.push({
        t: Math.round(entry.startTime),
        value: entry.value,
        sources: (entry.sources || []).map((s) => ({
          node: describe(s.node),
          dy: Math.round(s.currentRect.y - s.previousRect.y),
          dh: Math.round(s.currentRect.height - s.previousRect.height),
          h: Math.round(s.currentRect.height),
          y: Math.round(s.currentRect.y),
        })),
      });
    }
  }).observe({ type: "layout-shift", buffered: false });
});

const id = paseo("run", "-d", "-q", "--provider", "bc-bench", "--cwd", "/tmp/bcnp-proj", "--title", `shift-${mode}-${fixture}`, "list").trim().split("\n").pop();
try { paseo("wait", id, "--timeout", "60"); } catch {}
await page.goto(`http://127.0.0.1:8092/h/${SERVER_ID}/agent/${id}`);
await page.waitForTimeout(6000);
await page.evaluate(() => { globalThis.__shifts = []; globalThis.__shiftOn = true; });
paseo("send", id, `fixture:${fixture} speed:${speed}`);
try { paseo("wait", id, "--timeout", "900"); } catch {}
await page.waitForTimeout(3000);
const shifts = await page.evaluate(() => globalThis.__shifts);
await context.close();
try { paseo("archive", id); } catch {}

const total = shifts.reduce((sum, s) => sum + s.value, 0);
let uniform = 0;
const bySource = new Map();
for (const shift of shifts) {
  const dys = new Set(shift.sources.map((s) => s.dy));
  if (shift.sources.length && dys.size === 1) uniform += shift.value;
  for (const source of shift.sources) {
    const key = source.node;
    const entry = bySource.get(key) ?? { value: 0, count: 0, dys: [] };
    entry.value += shift.value / Math.max(1, shift.sources.length);
    entry.count += 1;
    if (entry.dys.length < 6) entry.dys.push(source.dy);
    bySource.set(key, entry);
  }
}
const dyHist = {};
for (const shift of shifts) for (const s of shift.sources) {
  const bucket = s.dy === 0 ? "0" : Math.abs(s.dy) < 20 ? "<20" : Math.abs(s.dy) < 60 ? "<60" : ">=60";
  dyHist[bucket] = (dyHist[bucket] ?? 0) + 1;
}
console.log(`${mode} ${fixture}: ${shifts.length} shifts, total ${total.toFixed(3)}, uniform-dy share ${(uniform / (total || 1) * 100).toFixed(0)}%`);
console.log("dy buckets", JSON.stringify(dyHist));
for (const [node, entry] of [...bySource].sort((a, b) => b[1].value - a[1].value).slice(0, 8)) {
  console.log(`  ${entry.value.toFixed(3)}  x${entry.count}  dy ${entry.dys.join(",")}  ${node}`);
}
if (out) writeFileSync(out, JSON.stringify(shifts, null, 1));
