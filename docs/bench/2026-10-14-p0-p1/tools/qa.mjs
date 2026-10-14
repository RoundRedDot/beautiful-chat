// Functional equivalence QA (Web) for one plugin mode on the PRIVATE daemon.
//   node qa.mjs <mode base1|cand> <outDir>
import { chromium } from "playwright-core";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, realpathSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { SERVER_ID, PORT, paseo, BLOCK_WS } from "./guard.mjs";
const [mode, OUT] = process.argv.slice(2);
const DIRS = { base1: "/tmp/bc-perf-p0p1/base", cand: "/Users/luopeihuan/workspace/rrd/beautiful-chat/.worktrees/perf-p0-p1" };
const LINK = "/tmp/bc-perf-p0p1/bench-active";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
if (realpathSync(LINK) !== realpathSync(DIRS[mode])) {
  if (!lstatSync(LINK).isSymbolicLink()) throw new Error("bad link");
  unlinkSync(LINK); symlinkSync(DIRS[mode], LINK); paseo("plugin", "reload", "better-paseo");
}
for (let i = 0; i < 60; i++) { const [r] = JSON.parse(paseo("plugin", "ls", "better-paseo", "--json")); if (r.status === "running") break; await sleep(500); }

const ctx = await chromium.launchPersistentContext("/tmp/bc-perf-p0p1/web-profile-qa", {
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true, locale: "zh-CN", viewport: { width: 1280, height: 900 },
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.routeWebSocket(BLOCK_WS, (ws) => ws.close());
const errors = []; page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
const R = { mode, plugin: DIRS[mode] };

async function agent(title) {
  const id = paseo("run", "-d", "-q", "--provider", "bc-bench", "--cwd", "/tmp/bc-perf-p0p1/project", "--title", title, "list").trim().split("\n").pop();
  try { paseo("wait", id, "--timeout", "60"); } catch {}
  const url = `http://127.0.0.1:8092/h/${SERVER_ID}/agent/${id}`;
  await page.goto(url); await page.waitForTimeout(4000);
  const direct = page.getByText("直接连接").first();
  if (await direct.isVisible().catch(() => false)) {
    await direct.click(); await page.waitForTimeout(800);
    const inputs = page.locator("input");
    await inputs.nth(0).fill("127.0.0.1"); await inputs.nth(1).fill(String(PORT));
    await page.getByText("连接", { exact: true }).last().click(); await page.waitForTimeout(5000);
    await page.goto(url); await page.waitForTimeout(4000);
  }
  const isCand = await page.evaluate(() => "imageRpc" in globalThis.__bcPerf.snapshot());
  if (isCand !== (mode === "cand")) throw new Error("bundle identity mismatch");
  return id;
}
// The timeline scroller: the scrollable element with the largest scrollHeight.
const scrollState = () => page.evaluate(() => {
  const els = [...document.querySelectorAll("*")].filter((e) => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 4; });
  els.sort((a, b) => b.scrollHeight - a.scrollHeight);
  const e = els[0]; if (!e) return null;
  return { top: Math.round(e.scrollTop), gap: Math.round(e.scrollHeight - e.clientHeight - e.scrollTop), h: e.scrollHeight };
});
const transcript = () => page.evaluate(() => {
  const el = [...document.querySelectorAll("*")].filter((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY)).sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
  return (el ?? document.body).innerText;
});

// 1. Streaming final content + stick to bottom.
{
  const id = await agent(`qa-${mode}-stream`);
  paseo("send", "--no-wait", id, "fixture:codeblock-streaming speed:1");
  const samples = [];
  for (let i = 0; i < 8; i++) { await sleep(1500); samples.push(await scrollState()); }
  try { paseo("wait", id, "--timeout", "300"); } catch {}
  await sleep(3000);
  const finalScroll = await scrollState();
  const text = await transcript();
  R.streamFollow = { samples, finalScroll, maxGapWhileStreaming: Math.max(...samples.filter(Boolean).map((s) => s.gap)) };
  R.streamFinal = { sha: sha(text), length: text.length };
  writeFileSync(`${OUT}/${mode}-stream-final.txt`, text);
  await page.screenshot({ path: `${OUT}/${mode}-stream-final.png` });
}
// 2. User scroll-up during streaming stops following.
{
  const id = await agent(`qa-${mode}-scrollup`);
  paseo("send", "--no-wait", id, "fixture:codeblock-streaming speed:1");
  await sleep(5000);
  await page.mouse.move(800, 400); await page.mouse.wheel(0, -800); await sleep(800);
  const afterUser = await scrollState();
  const later = [];
  for (let i = 0; i < 4; i++) { await sleep(1500); later.push(await scrollState()); }
  try { paseo("wait", id, "--timeout", "300"); } catch {}
  R.userScrollUp = { afterUser, later, stayed: later.every((s) => s && Math.abs(s.top - afterUser.top) <= 4 && s.gap > 50) };
}
// 3. Large diff: line numbers, gutter, copy, show all / show less, collapse, theme.
{
  const id = await agent(`qa-${mode}-diff`);
  paseo("send", id, "fixture:diff-large speed:max");
  try { paseo("wait", id, "--timeout", "300"); } catch {}
  await sleep(2500);
  const header = page.locator('[aria-label^="Edit /Users"]').first();
  let b = await header.boundingBox(); await page.mouse.click(b.x + 6, b.y + b.height / 2); await page.mouse.move(5, 5); await sleep(2000);
  R.expandedAfterClick = await header.getAttribute("aria-expanded");
  const block = () => page.evaluate(() => {
    const copy = document.querySelector('[aria-label="Copy code"]');
    let el = copy; while (el && !(/^Diff/.test(el.innerText ?? "") && (el.innerText ?? "").includes("@@"))) el = el.parentElement;
    const root = el ?? document.body;
    const nums = [...root.querySelectorAll("*")].filter((e) => e.childElementCount === 0 && /^\d+$/.test(e.textContent ?? ""));
    const widths = [...new Set(nums.map((e) => e.getBoundingClientRect().width.toFixed(2)))];
    return { text: root.innerText, numCount: nums.length, numWidths: widths, lastNum: nums.at(-1)?.textContent, fontSize: nums[0] ? getComputedStyle(nums[0]).fontSize : null };
  });
  const collapsed = await block();
  R.diffInitial = { sha: sha(collapsed.text), numCount: collapsed.numCount, numWidths: collapsed.numWidths, lastNum: collapsed.lastNum, fontSize: collapsed.fontSize };
  const more = await page.getByText(/^Show \d+ more lines$/).first().boundingBox();
  R.showMoreLabel = await page.getByText(/^Show \d+ more lines$/).first().textContent();
  await page.mouse.click(more.x + 20, more.y + 9); await page.mouse.move(5, 5); await sleep(5000);
  const all = await block();
  R.diffAll = { sha: sha(all.text), length: all.text.length, numCount: all.numCount, numWidths: all.numWidths, lastNum: all.lastNum, showLess: await page.getByText("Show less").count() };
  writeFileSync(`${OUT}/${mode}-diff-all.txt`, all.text);
  const copy = page.locator('[aria-label="Copy code"]').first();
  await copy.scrollIntoViewIfNeeded(); await copy.click(); await sleep(500);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  R.copy = { sha: sha(clip), length: clip.length, lines: clip.split("\n").length };
  writeFileSync(`${OUT}/${mode}-copy.txt`, clip);
  const less = await page.getByText("Show less").first().boundingBox();
  await page.mouse.click(less.x + 10, less.y + 9); await page.mouse.move(5, 5); await sleep(1500);
  const back = await block();
  R.showLess = { sha: sha(back.text), sameAsInitial: sha(back.text) === R.diffInitial.sha, moreLabel: await page.getByText(/^Show \d+ more lines$/).first().textContent().catch(() => null) };
  // Theme: dark, then light, block text and gutter after each.
  await page.emulateMedia({ colorScheme: "dark" }); await sleep(2500);
  const dark = await block();
  await page.locator('[aria-label="Copy code"]').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/${mode}-diff-dark.png` });
  R.dark = { sha: sha(dark.text), numWidths: dark.numWidths, bg: await page.evaluate(() => getComputedStyle(document.querySelector('[aria-label="Copy code"]').closest("div")).color) };
  await page.emulateMedia({ colorScheme: "light" }); await sleep(2500);
  const light = await block();
  await page.screenshot({ path: `${OUT}/${mode}-diff-light.png` });
  R.light = { sha: sha(light.text), numWidths: light.numWidths };
  // Collapse the row.
  b = await header.boundingBox(); await page.mouse.click(b.x + 6, b.y + b.height / 2); await page.mouse.move(5, 5); await sleep(1500);
  R.collapsedAfterSecondClick = await header.getAttribute("aria-expanded");
  R.diffAgentId = id;
}
R.pageErrors = errors;
writeFileSync(`${OUT}/${mode}-qa.json`, JSON.stringify(R, null, 2));
console.log(JSON.stringify(R, null, 1));
await ctx.close();
