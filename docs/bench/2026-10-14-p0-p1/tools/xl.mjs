// Open the extra-long diff (TEMP fixture diff-xl-p0p1) for one mode and record what happens.
import { chromium } from "playwright-core";
import { lstatSync, realpathSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { SERVER_ID, paseo, BLOCK_WS } from "./guard.mjs";
const [mode, OUT] = process.argv.slice(2);
const DIRS = { base1: "/tmp/bc-perf-p0p1/base", cand: "/Users/luopeihuan/workspace/rrd/beautiful-chat/.worktrees/perf-p0-p1" };
const LINK = "/tmp/bc-perf-p0p1/bench-active"; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (realpathSync(LINK) !== realpathSync(DIRS[mode])) { if (!lstatSync(LINK).isSymbolicLink()) throw new Error("bad link"); unlinkSync(LINK); symlinkSync(DIRS[mode], LINK); paseo("plugin", "reload", "better-paseo"); }
for (let i = 0; i < 60; i++) { const [r] = JSON.parse(paseo("plugin", "ls", "better-paseo", "--json")); if (r.status === "running") break; await sleep(500); }
const ctx = await chromium.launchPersistentContext("/tmp/bc-perf-p0p1/web-profile-qa", { executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, locale: "zh-CN", viewport: { width: 1280, height: 900 } });
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.routeWebSocket(BLOCK_WS, (ws) => ws.close());
const errors = []; const consoleErrors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300)); });
const id = paseo("run", "-d", "-q", "--provider", "bc-bench", "--cwd", "/tmp/bc-perf-p0p1/project", "--title", `xl-${mode}`, "list").trim().split("\n").pop();
try { paseo("wait", id, "--timeout", "60"); } catch {}
await page.goto(`http://127.0.0.1:8092/h/${SERVER_ID}/agent/${id}`); await sleep(5000);
if ((await page.evaluate(() => "imageRpc" in globalThis.__bcPerf.snapshot())) !== (mode === "cand")) throw new Error("bundle identity mismatch");
paseo("send", id, "fixture:diff-xl-p0p1 speed:max"); try { paseo("wait", id, "--timeout", "300"); } catch {}
await sleep(4000);
const header = page.locator('[aria-label^="Edit /Users"]').first();
const R = { mode, headerFound: await header.count() };
if (R.headerFound) {
  R.headerLabel = await header.getAttribute("aria-label");
  const hb = await header.boundingBox(); await page.mouse.click(hb.x + 6, hb.y + hb.height / 2); await page.mouse.move(5, 5); await sleep(5000);
  R.expanded = await header.getAttribute("aria-expanded").catch(() => "gone");
  R.state = await page.evaluate(() => {
    const nums = [...document.querySelectorAll("*")].filter((e) => e.childElementCount === 0 && /^\d+$/.test(e.textContent ?? "") && e.getBoundingClientRect().width > 0);
    return { showMore: (document.body.innerText.match(/Show \d+ more lines/) ?? [null])[0], numCount: nums.length, numWidths: [...new Set(nums.map((e) => e.getBoundingClientRect().width.toFixed(2)))], hasDone: document.body.innerText.includes("Done."), errorText: (document.body.innerText.match(/(Something went wrong|出错|错误|Error)[^\n]{0,120}/) ?? [null])[0] };
  });
}
R.pageErrors = errors; R.consoleErrors = consoleErrors.slice(0, 10);
await page.screenshot({ path: `${OUT}/${mode}-xl.png` });
writeFileSync(`${OUT}/${mode}-xl.json`, JSON.stringify(R, null, 2));
console.log(JSON.stringify(R, null, 1));
await ctx.close();
