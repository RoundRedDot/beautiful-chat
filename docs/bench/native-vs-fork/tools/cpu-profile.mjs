// CPU profile of one replay in the fork, summarized by function self time.
//   node cpu-profile.mjs <fixture> <speed> <out.cpuprofile>
// Same daemon and web export as web-ab.mjs; better-paseo must be enabled.
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const [fixture, speed = "1", out] = process.argv.slice(2);
const HOME = `${process.env.HOME}/.paseo-bench-ab`;
const SERVER_ID = readFileSync(`${HOME}/server-id`, "utf8").trim();
const paseo = (...rest) =>
  execFileSync("paseo", ["--home", HOME, ...rest], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const context = await chromium.launchPersistentContext("/tmp/bcnp-web-profile", {
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  locale: "zh-CN",
  viewport: { width: 1280, height: 900 },
});
const page = context.pages()[0] ?? (await context.newPage());
await page.routeWebSocket(/:(6767|6868)\//, (ws) => ws.close());
const cdp = await context.newCDPSession(page);
const id = paseo("run", "-d", "-q", "--provider", "bc-bench", "--cwd", "/tmp/bcnp-proj", "--title", `cpu-${fixture}`, "list").trim().split("\n").pop();
try { paseo("wait", id, "--timeout", "60"); } catch {}
await page.goto(`http://127.0.0.1:8092/h/${SERVER_ID}/agent/${id}`);
await page.waitForTimeout(6000);
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
await cdp.send("Profiler.start");
paseo("send", id, `fixture:${fixture} speed:${speed}`);
try { paseo("wait", id, "--timeout", "900"); } catch {}
await page.waitForTimeout(3000);
const { profile } = await cdp.send("Profiler.stop");
await context.close();
try { paseo("archive", id); } catch {}
if (out) writeFileSync(out, JSON.stringify(profile));

// Self time per node from the sample deltas, folded by function + script.
const self = new Map();
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
for (let i = 0; i < profile.samples.length; i++) {
  const node = byId.get(profile.samples[i]);
  const dt = (profile.timeDeltas[i + 1] ?? 0) / 1000;
  const f = node.callFrame;
  const script = f.url.split("/").pop()?.replace(/-[0-9a-f]{20,}/, "") || "(native)";
  const key = `${f.functionName || "(anon)"} @ ${script}:${f.lineNumber}`;
  self.set(key, (self.get(key) ?? 0) + dt);
}
const total = [...self.entries()].filter(([k]) => !k.startsWith("(idle)") && !k.startsWith("(program)")).reduce((a, [, v]) => a + v, 0);
console.log(`busy ${total.toFixed(0)} ms`);
for (const [key, ms] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`${ms.toFixed(1).padStart(8)}  ${key}`);
