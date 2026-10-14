// Count key / max-line computations in-host for one plugin dir (no timing).
//   node count.mjs <label> <pluginDir> <out.json>
import { chromium } from "playwright-core";
import { lstatSync, realpathSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { SERVER_ID, paseo, BLOCK_WS } from "./guard.mjs";
const [label, dir, out] = process.argv.slice(2);
const LINK = "/tmp/bc-perf-p0p1/bench-active"; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (realpathSync(LINK) !== realpathSync(dir)) { if (!lstatSync(LINK).isSymbolicLink()) throw new Error("bad link"); unlinkSync(LINK); symlinkSync(dir, LINK); paseo("plugin", "reload", "better-paseo"); }
for (let i = 0; i < 60; i++) { const [r] = JSON.parse(paseo("plugin", "ls", "better-paseo", "--json")); if (r.status === "running") break; await sleep(500); }
const ctx = await chromium.launchPersistentContext("/tmp/bc-perf-p0p1/web-profile-count", { executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, locale: "zh-CN", viewport: { width: 1280, height: 900 } });
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.routeWebSocket(BLOCK_WS, (ws) => ws.close());
const id = paseo("run", "-d", "-q", "--provider", "bc-bench", "--cwd", "/tmp/bc-perf-p0p1/project", "--title", `count-${label}`, "list").trim().split("\n").pop();
try { paseo("wait", id, "--timeout", "60"); } catch {}
await page.goto(`http://127.0.0.1:8092/h/${SERVER_ID}/agent/${id}`); await sleep(5000);
const direct = page.getByText("直接连接").first();
if (await direct.isVisible().catch(() => false)) { await direct.click(); await sleep(800); const inputs = page.locator("input"); await inputs.nth(0).fill("127.0.0.1"); await inputs.nth(1).fill("6871"); await page.getByText("连接", { exact: true }).last().click(); await sleep(5000); await page.goto(`http://127.0.0.1:8092/h/${SERVER_ID}/agent/${id}`); await sleep(5000); }
paseo("send", id, "fixture:diff-large speed:max"); try { paseo("wait", id, "--timeout", "300"); } catch {}
await sleep(2500);
await page.evaluate(() => { globalThis.__bcPerf.enable(); globalThis.__bcPerf.reset(); });
const read = () => page.evaluate(() => { const s = globalThis.__bcPerf.snapshot(); return { cacheKey: s.counters["highlight.cacheKey"] ?? 0, maxLine: s.counters["code.maxLineNumber"] ?? 0, highlightRpc: s.highlightRpc.count }; });
const steps = [];
const header = page.locator('[aria-label^="Edit /Users"]').first();
const hb = await header.boundingBox(); await page.mouse.click(hb.x + 6, hb.y + hb.height / 2); await page.mouse.move(5, 5); await sleep(2500);
steps.push({ step: "expand (mount)", ...(await read()) });
const more = page.getByText(/^Show \d+ more lines$/).first(); await more.scrollIntoViewIfNeeded(); await page.mouse.move(5, 5); await sleep(300);
await more.click(); await page.mouse.move(5, 5); await sleep(5000);
if ((await page.getByText("Show less").count()) !== 1) throw new Error("show-all did not complete");
steps.push({ step: "show all (5116 lines in batches)", ...(await read()) });
await page.getByText("Show less", { exact: true }).first().click(); await page.mouse.move(5, 5); await sleep(2000);
steps.push({ step: "show less", ...(await read()) });
await page.emulateMedia({ colorScheme: "dark" }); await sleep(2500);
steps.push({ step: "theme dark", ...(await read()) });
await page.emulateMedia({ colorScheme: "light" }); await sleep(2500);
steps.push({ step: "theme light", ...(await read()) });
writeFileSync(out, JSON.stringify({ label, dir, steps }, null, 2));
console.log(label, JSON.stringify(steps));
await ctx.close();
