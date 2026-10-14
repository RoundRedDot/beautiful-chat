// Supplementary Web QA: show-less, live code-font-size switch, wrap toggle, and candidate probe counters.
//   node qa2.mjs <base1|cand> <outDir>
import { chromium } from "playwright-core";
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, realpathSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { SERVER_ID, PORT, paseo, BLOCK_WS } from "./guard.mjs";
const [mode, OUT] = process.argv.slice(2);
const DIRS = { base1: "/tmp/bc-perf-p0p1/base", cand: "/Users/luopeihuan/workspace/rrd/beautiful-chat/.worktrees/perf-p0-p1" };
const LINK = "/tmp/bc-perf-p0p1/bench-active";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
if (realpathSync(LINK) !== realpathSync(DIRS[mode])) { if (!lstatSync(LINK).isSymbolicLink()) throw new Error("bad link"); unlinkSync(LINK); symlinkSync(DIRS[mode], LINK); paseo("plugin", "reload", "better-paseo"); }
for (let i = 0; i < 60; i++) { const [r] = JSON.parse(paseo("plugin", "ls", "better-paseo", "--json")); if (r.status === "running") break; await sleep(500); }
const ctx = await chromium.launchPersistentContext("/tmp/bc-perf-p0p1/web-profile-qa", {
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, locale: "zh-CN", viewport: { width: 1280, height: 900 } });
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.routeWebSocket(BLOCK_WS, (ws) => ws.close());
const errors = []; page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
const R = { mode };
const isCand = async () => page.evaluate(() => "imageRpc" in globalThis.__bcPerf.snapshot());
const perfOn = () => page.evaluate(() => { globalThis.__bcPerf.enable(); globalThis.__bcPerf.reset(); });
const perf = () => page.evaluate(() => { const s = globalThis.__bcPerf.snapshot(); return { cacheKey: s.counters?.["highlight.cacheKey"] ?? null, maxLine: s.counters?.["code.maxLineNumber"] ?? null, highlightRpc: s.highlightRpc?.count, imageRpc: s.imageRpc ?? null }; });
// Line-number cells and code font of every visible code block (scoped to visible nodes: hidden panes stay mounted).
const blocks = () => page.evaluate(() => [...document.querySelectorAll('[aria-label="Copy code"]')].filter((c) => c.getBoundingClientRect().width > 0).map((copy) => {
  let el = copy; while (el && !((el.innerText ?? "").split("\n").length > 3 && el.querySelector("[aria-label='Copy code']") === copy && el.getBoundingClientRect().height > 80)) el = el.parentElement;
  const root = el ?? copy;
  const nums = [...root.querySelectorAll("*")].filter((e) => e.childElementCount === 0 && /^\d+$/.test(e.textContent ?? "") && e.getBoundingClientRect().width > 0);
  return { text: root.innerText.slice(0, 20000), numCount: nums.length, numWidths: [...new Set(nums.map((e) => e.getBoundingClientRect().width.toFixed(2)))], fontSize: nums[0] ? getComputedStyle(nums[0]).fontSize : null, height: Math.round(root.getBoundingClientRect().height) };
}));

// A. show all -> show less on the large diff
{
  const id = paseo("run", "-d", "-q", "--provider", "bc-bench", "--cwd", "/tmp/bc-perf-p0p1/project", "--title", `qa2-${mode}`, "list").trim().split("\n").pop();
  try { paseo("wait", id, "--timeout", "60"); } catch {}
  await page.goto(`http://127.0.0.1:8092/h/${SERVER_ID}/agent/${id}`); await sleep(5000);
  if ((await isCand()) !== (mode === "cand")) throw new Error("bundle identity mismatch");
  paseo("send", id, "fixture:diff-large speed:max"); try { paseo("wait", id, "--timeout", "300"); } catch {}
  await sleep(2500);
  await perfOn();
  const header = page.locator('[aria-label^="Edit /Users"]').first();
  const b = await header.boundingBox(); await page.mouse.click(b.x + 6, b.y + b.height / 2); await page.mouse.move(5, 5); await sleep(2000);
  const p0 = await perf();
  await page.getByText(/^Show \d+ more lines$/).first().click(); await page.mouse.move(5, 5); await sleep(5000);
  const p1 = await perf();
  const all = await blocks();
  await page.getByText("Show less", { exact: true }).first().click(); await page.mouse.move(5, 5); await sleep(2000);
  const p2 = await perf();
  const less = await blocks();
  R.diffAgent = id;
  R.showAllLess = {
    allNumCount: all[0]?.numCount, lessNumCount: less[0]?.numCount, lessLabel: await page.getByText(/^Show \d+ more lines$/).first().textContent().catch(() => null),
    lessSha: sha(less[0]?.text ?? ""), counters: { afterExpand: p0, afterShowAll: p1, afterShowLess: p2 },
  };
}
// B. live code-font-size switch and wrap toggle in the settings preview (positive control: theme flip).
page.on("dialog", (d) => d.accept());
{
  const settingsUrl = `http://127.0.0.1:8092/settings/hosts/${SERVER_ID}/plugins/better-paseo/chat-presentation`;
  await page.goto(settingsUrl); await sleep(5000);
  if ((await isCand()) !== (mode === "cand")) throw new Error("bundle identity mismatch (settings)");
  await perfOn();
  const fontLabel = () => page.evaluate(() => (document.body.innerText.match(/\n(\d+)px\n/) ?? [])[1] ?? null);
  const snap = async (label) => ({ label, font: await fontLabel(), perf: await perf() });
  const followHost = async () => { const seg = page.getByLabel("代码字号来源"); await seg.getByText("跟随 Paseo", { exact: true }).click(); await sleep(1200); };
  await followHost();
  const steps = [await snap("start (follow host)")];
  await page.emulateMedia({ colorScheme: "dark" }); await sleep(2000); steps.push(await snap("theme dark"));
  for (let i = 0; i < 4; i++) { await page.getByLabel("增大代码字号").click(); await sleep(700); }
  steps.push(await snap("font +4"));
  const wrap = page.locator('[aria-label="Wrap lines"]').first();
  if (await wrap.count()) { await wrap.click(); await sleep(700); steps.push(await snap("wrap on")); await page.locator('[aria-label="Do not wrap lines"]').first().click(); await sleep(700); steps.push(await snap("wrap off")); }
  await page.emulateMedia({ colorScheme: "light" }); await sleep(2000); steps.push(await snap("theme light"));
  await page.screenshot({ path: `${OUT}/${mode}-settings-font16.png`, fullPage: true });
  R.settings = steps;
  // The large diff at 16px (setting persisted in the private daemon).
  await page.goto(`http://127.0.0.1:8092/h/${SERVER_ID}/agent/${R.diffAgent}`); await sleep(5000);
  const header = page.locator('[aria-label^="Edit /Users"]').first();
  const hb = await header.boundingBox(); await page.mouse.click(hb.x + 6, hb.y + hb.height / 2); await page.mouse.move(5, 5); await sleep(2000);
  await page.getByText(/^Show \d+ more lines$/).first().click(); await page.mouse.move(5, 5); await sleep(5000);
  const big = await blocks();
  R.diffAt16 = big.map((x) => ({ numCount: x.numCount, numWidths: x.numWidths, fontSize: x.fontSize, height: x.height, sha: sha(x.text) }));
  await page.locator('[aria-label="Copy code"]').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/${mode}-diff-font16.png` });
  // Restore: code size follows the host again (the default).
  await page.goto(settingsUrl); await sleep(5000);
  await followHost();
  R.afterReset = { font: await fontLabel(), followHost: await page.evaluate(() => document.body.innerText.includes("Paseo 默认")) };
}
R.pageErrors = errors;
writeFileSync(`${OUT}/${mode}-qa2.json`, JSON.stringify(R, null, 2));
console.log(JSON.stringify(R, null, 1));
await ctx.close();
