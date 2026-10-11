// V1 walk-through, part 4: Reduced Motion on web. Samples the plugin's RunningDot opacity while a tool runs.
import { launch, shot, SERVER, OUT } from "./web-lib.mjs";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const H = `${process.env.HOME}/.paseo-bench`;
const paseo = (...a) => execFileSync("paseo", ["--home", H, ...a], { encoding: "utf8" });
const id = paseo("run", "-d", "-q", "--provider", "bc-bench", "--cwd", "/tmp/bc-orchestrate/s0d-project", "--title", "perf-v1-running2", "list").trim().split("\n").pop();
try { paseo("wait", id, "--timeout", "60"); } catch {}
paseo("send", "--no-wait", id, "fixture:tool-expanded-streaming speed:1");
const out = {};
for (const reduced of [false, true]) {
  const { ctx, page } = await launch({ reducedMotion: reduced ? "reduce" : "no-preference" });
  await page.goto(`http://127.0.0.1:8090/h/${SERVER}/agent/${id}`);
  await page.waitForTimeout(7000);
  const found = await page.evaluate(() => document.querySelectorAll('[aria-label="Running"]').length);
  const samples = [];
  for (let i = 0; i < 30; i++) { samples.push(await page.evaluate(() => { const d = document.querySelector('[aria-label="Running"]'); return d ? Number(getComputedStyle(d).opacity) : null; })); await page.waitForTimeout(100); }
  const nums = samples.filter((x) => x !== null);
  out[reduced ? "reduced" : "normal"] = { elements: found, samples: nums.length, min: Math.min(...nums), max: Math.max(...nums) };
  await shot(page, `web-running-dot-${reduced ? "reduced" : "normal"}.png`);
  await ctx.close();
}
writeFileSync(`${OUT}/web-walk-4.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out));
