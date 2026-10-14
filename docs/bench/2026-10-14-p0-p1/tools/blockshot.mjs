// Element screenshots of the expanded large-diff block (light, then dark) for one mode.
import { chromium } from "playwright-core";
import { lstatSync, realpathSync, symlinkSync, unlinkSync } from "node:fs";
import { SERVER_ID, paseo, BLOCK_WS } from "./guard.mjs";
const [mode, OUT] = process.argv.slice(2);
const DIRS = { base1: "/tmp/bc-perf-p0p1/base", cand: "/Users/luopeihuan/workspace/rrd/beautiful-chat/.worktrees/perf-p0-p1" };
const LINK = "/tmp/bc-perf-p0p1/bench-active"; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (realpathSync(LINK) !== realpathSync(DIRS[mode])) { if (!lstatSync(LINK).isSymbolicLink()) throw new Error("bad link"); unlinkSync(LINK); symlinkSync(DIRS[mode], LINK); paseo("plugin", "reload", "better-paseo"); }
for (let i = 0; i < 60; i++) { const [r] = JSON.parse(paseo("plugin", "ls", "better-paseo", "--json")); if (r.status === "running") break; await sleep(500); }
const ctx = await chromium.launchPersistentContext("/tmp/bc-perf-p0p1/web-profile-qa", { executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, locale: "zh-CN", viewport: { width: 1280, height: 900 } });
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.routeWebSocket(BLOCK_WS, (ws) => ws.close());
const id = paseo("run", "-d", "-q", "--provider", "bc-bench", "--cwd", "/tmp/bc-perf-p0p1/project", "--title", `shot-${mode}`, "list").trim().split("\n").pop();
try { paseo("wait", id, "--timeout", "60"); } catch {}
await page.goto(`http://127.0.0.1:8092/h/${SERVER_ID}/agent/${id}`); await sleep(5000);
if ((await page.evaluate(() => "imageRpc" in globalThis.__bcPerf.snapshot())) !== (mode === "cand")) throw new Error("bundle identity mismatch");
paseo("send", id, "fixture:diff-large speed:max"); try { paseo("wait", id, "--timeout", "300"); } catch {}
await sleep(2500);
const header = page.locator('[aria-label^="Edit /Users"]').first();
const hb = await header.boundingBox(); await page.mouse.click(hb.x + 6, hb.y + hb.height / 2); await page.mouse.move(5, 5); await sleep(2500);
const block = page.locator('[aria-label="Copy code"]').first().locator("xpath=ancestor::div[.//text()[contains(., '@@')]][1]");
await block.scrollIntoViewIfNeeded(); await page.mouse.move(5, 5); await sleep(800);
await block.screenshot({ path: `${OUT}/${mode}-block-light.png` });
await page.emulateMedia({ colorScheme: "dark" }); await sleep(2500);
await block.scrollIntoViewIfNeeded(); await page.mouse.move(5, 5); await sleep(800);
await block.screenshot({ path: `${OUT}/${mode}-block-dark.png` });
await page.emulateMedia({ colorScheme: "light" });
await ctx.close();
console.log("ok", mode);
