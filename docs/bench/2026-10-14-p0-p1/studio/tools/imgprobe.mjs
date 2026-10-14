// P0 image RPC probe data (P3 entry condition). Candidate build only (it carries the probe).
//   node imgprobe.mjs <out.json> [reps]
import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";
import { SERVER_ID, PORT, paseo, BLOCK_WS } from "./guard.mjs";
const [out, repsArg] = process.argv.slice(2); const reps = Number(repsArg ?? 3);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ctx = await chromium.launchPersistentContext("/tmp/bc-perf-p0p1/web-profile-img", { executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, locale: "zh-CN", viewport: { width: 1280, height: 900 } });
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.routeWebSocket(BLOCK_WS, (ws) => ws.close());
const snap = () => page.evaluate(() => { const s = globalThis.__bcPerf.snapshot(); return { imageRpc: s.imageRpc, highlightRpc: s.highlightRpc.count }; });
async function open(id) {
  const url = `http://127.0.0.1:8092/h/${SERVER_ID}/agent/${id}`;
  await page.goto(url); await sleep(5000);
  const direct = page.getByText("直接连接").first();
  if (await direct.isVisible().catch(() => false)) { await direct.click(); await sleep(800); const i = page.locator("input"); await i.nth(0).fill("127.0.0.1"); await i.nth(1).fill(String(PORT)); await page.getByText("连接", { exact: true }).last().click(); await sleep(5000); await page.goto(url); await sleep(5000); }
  if (!(await page.evaluate(() => "imageRpc" in globalThis.__bcPerf.snapshot()))) throw new Error("not the candidate build");
}
const results = [];
for (let rep = 1; rep <= reps; rep++) {
  const id = paseo("run", "-d", "-q", "--provider", "bc-bench", "--cwd", "/tmp/bc-perf-p0p1/project", "--title", `img-${rep}`, "list").trim().split("\n").pop();
  try { paseo("wait", id, "--timeout", "60"); } catch {}
  await open(id);
  await page.evaluate(() => globalThis.__bcPerf.enable()); // persists debugPerf in localStorage
  await page.reload(); await sleep(5000);
  await page.evaluate(() => globalThis.__bcPerf.reset());
  paseo("send", id, "fixture:images-repeat-p0 speed:1"); try { paseo("wait", id, "--timeout", "120"); } catch {}
  await sleep(4000);
  const live = await snap();
  await page.screenshot({ path: out.replace(/\.json$/, `-r${rep}-live.png`) });
  await page.reload(); await sleep(7000);
  const history = await snap(); // module re-evaluated on reload: counts since page load
  const readRow = page.locator('[aria-label^="Read "]').first();
  let expanded = null;
  if (await readRow.count()) { const b = await readRow.boundingBox(); await page.mouse.click(b.x + 6, b.y + b.height / 2); await page.mouse.move(5, 5); await sleep(4000); expanded = await snap(); }
  const rendered = await page.evaluate(() => [...document.querySelectorAll("img")].filter((i) => i.naturalWidth === 900).length);
  await page.screenshot({ path: out.replace(/\.json$/, `-r${rep}-history.png`) });
  results.push({ rep, agentId: id, live, historyLoad: history, afterExpandingReadRow: expanded, renderedImages900px: rendered });
  console.log(JSON.stringify(results.at(-1)));
}
await page.evaluate(() => globalThis.__bcPerf.disable());
writeFileSync(out, JSON.stringify({ fixture: "images-repeat-p0", imageBytes: 2107488, note: "shot.png appears 4x in markdown + 1 Read row; shot2.png 1x", results }, null, 2));
await ctx.close();
