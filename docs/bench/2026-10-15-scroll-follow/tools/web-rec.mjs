// node web-rec.mjs <label> <fixture> <speed> <on|off>
// Records every frame Chrome presents (tracing screenshots, the DevTools filmstrip) while a fixture streams.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
const require = createRequire("/tmp/bc-ba/tools/");
const { chromium } = require("playwright-core");
const [label, fixture, speed, plugin] = process.argv.slice(2);
const H = `${process.env.HOME}/.paseo-bench-ss`;
const PASEO = "/tmp/bc-perf-p0p1/paseo-cli/node_modules/.bin/paseo";
const ORIGIN = "http://127.0.0.1:8093";
const SID = readFileSync(`${H}/server-id`, "utf8").trim();
const paseo = (...args) => execFileSync(PASEO, ["--home", H, ...args], { encoding: "utf8" });
try { paseo("plugin", plugin === "on" ? "enable" : "disable", "better-paseo"); } catch {}
execFileSync("sleep", ["3"]);
const out = `/tmp/bc-ss/web/${label}`;
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
const context = await chromium.launchPersistentContext("/tmp/bc-ss/web-profile", {
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true, locale: "zh-CN", viewport: { width: 1280, height: 900 },
});
const page = context.pages()[0] ?? (await context.newPage());
// Only my daemon: never the user's or the other bench's.
await page.routeWebSocket(/:(6767|6868|6869|6871|6875)\//, (ws) => ws.close());
const id = paseo("run", "-d", "-q", "--provider", "bc-bench", "--cwd", "/tmp/bc-ss/project", "--title", `web-${label}`, "list").trim().split("\n").pop();
try { paseo("wait", id, "--timeout", "60"); } catch {}
const url = `${ORIGIN}/h/${SID}/agent/${id}`;
await page.goto(url); await page.waitForTimeout(4000);
const direct = page.getByText("直接连接").first();
if (await direct.isVisible().catch(() => false)) {
  await direct.click(); await page.waitForTimeout(800);
  const inputs = page.locator("input");
  await inputs.nth(0).fill("127.0.0.1"); await inputs.nth(1).fill("6879");
  await page.getByText("连接", { exact: true }).last().click(); await page.waitForTimeout(5000);
}
if (!page.url().includes("/agent/")) { await page.goto(url); await page.waitForTimeout(4000); }
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}-start.png` });
const cdp = await context.newCDPSession(page);
// Tracing screenshots: one per frame Chrome actually presents (the DevTools filmstrip).
// The trace buffer holds about 8 s of them, so the stream is taken in 7 s windows.
async function window(ms) {
  await cdp.send("Tracing.start", { categories: "disabled-by-default-devtools.screenshot", transferMode: "ReturnAsStream" });
  await page.waitForTimeout(ms);
  const done = new Promise((resolve) => cdp.once("Tracing.tracingComplete", resolve));
  await cdp.send("Tracing.end");
  const { stream } = await done;
  let text = "";
  for (;;) {
    const chunk = await cdp.send("IO.read", { handle: stream, size: 1 << 20 });
    text += chunk.base64Encoded ? Buffer.from(chunk.data, "base64").toString("utf8") : chunk.data;
    if (chunk.eof) break;
  }
  await cdp.send("IO.close", { handle: stream });
  const events = JSON.parse(text);
  return (Array.isArray(events) ? events : events.traceEvents).filter((e) => e.name === "Screenshot" && e.args?.snapshot)
    .sort((a, b) => a.ts - b.ts).map((e) => ({ data: e.args.snapshot, t: e.ts / 1e6 }));
}
const frames = [];
const sent = Date.now();
paseo("send", "--no-wait", id, `fixture:${fixture} speed:${speed}`);
let seenRunning = false;
while (Date.now() - sent < 300000) {
  frames.push(...(await window(6000)));
  const status = String(JSON.parse(paseo("inspect", id, "--json")).Status ?? "");
  if (!/idle|error|closed/i.test(status)) seenRunning = true;
  else if (seenRunning || Date.now() - sent > 20000) { frames.push(...(await window(2000))); break; }
}
await page.screenshot({ path: `${out}-end.png` });
frames.forEach((f, i) => writeFileSync(`${out}/${String(i).padStart(5, "0")}.jpg`, Buffer.from(f.data, "base64")));
writeFileSync(`${out}/times.json`, JSON.stringify(frames.map((f) => f.t)));
try { paseo("archive", id); } catch {}
await context.close();
console.log(label, "frames", frames.length, "gaps>50ms", frames.filter((f, i) => i && f.t - frames[i - 1].t > 0.05).length, "span", (frames.at(-1).t - frames[0].t).toFixed(1), "s");
