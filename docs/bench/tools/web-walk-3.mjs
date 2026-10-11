// V1 walk-through, part 3: Reduced Motion on web (running dot), and scrolling up during a live stream.
import { launch, shot, SERVER, OUT } from "./web-lib.mjs";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const H = `${process.env.HOME}/.paseo-bench`;
const paseo = (...a) => execFileSync("paseo", ["--home", H, ...a], { encoding: "utf8" });
const result = {};
async function newRun(title, fixture, speed) {
  const id = paseo("run", "-d", "-q", "--provider", "bc-bench", "--cwd", "/tmp/bc-orchestrate/s0d-project", "--title", title, "list").trim().split("\n").pop();
  try { paseo("wait", id, "--timeout", "60"); } catch {}
  paseo("send", "--no-wait", id, `fixture:${fixture} speed:${speed}`);
  return id;
}
async function sampleDot(reduced, id) {
  const { ctx, page } = await launch({ reducedMotion: reduced ? "reduce" : "no-preference" });
  await page.goto(`http://127.0.0.1:8090/h/${SERVER}/agent/${id}`);
  await page.waitForTimeout(7000);
  const samples = [];
  for (let i = 0; i < 25; i++) { samples.push(await page.evaluate(() => { const d = document.querySelector("[role=progressbar]"); return d ? Number(getComputedStyle(d).opacity) : null; })); await page.waitForTimeout(100); }
  await shot(page, `web-running-dot-${reduced ? "reduced" : "normal"}.png`);
  await ctx.close();
  const nums = samples.filter((x) => x !== null);
  return { found: nums.length, min: Math.min(...nums), max: Math.max(...nums) };
}
const id = await newRun("perf-v1-running", "tool-expanded-streaming", 1);
result.runningDotNormal = await sampleDot(false, id);
result.runningDotReduced = await sampleDot(true, id);

// scroll up during a live stream: the position must not be pulled back to the bottom
const id2 = await newRun("perf-v1-scroll", "markdown-long", 1);
{
  const { ctx, page } = await launch();
  await page.goto(`http://127.0.0.1:8090/h/${SERVER}/agent/${id2}`);
  await page.waitForTimeout(9000);
  const pos = () => page.evaluate(() => { const el = [...document.querySelectorAll("div")].find((e) => e.scrollHeight > e.clientHeight + 200 && /auto|scroll/.test(getComputedStyle(e).overflowY) && e.clientWidth > 600); return el ? { top: Math.round(el.scrollTop), h: el.scrollHeight, ch: el.clientHeight } : null; });
  const before = await pos();
  await page.mouse.move(800, 400); for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -300); await page.waitForTimeout(100); }
  await page.waitForTimeout(500);
  const afterScroll = await pos();
  const trail = [];
  for (let i = 0; i < 5; i++) { await page.waitForTimeout(2000); trail.push(await pos()); }
  result.scrollUp = { before, afterScroll, trail };
  await shot(page, "web-scrolled-up-during-stream.png");
  await ctx.close();
}
writeFileSync(`${OUT}/web-walk-3.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 1));
