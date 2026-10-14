// P3 host check: a missing image referenced twice — same error UI in both builds, request counts.
//   node imgfail.mjs <label> <pluginDir> <out.json>
import { chromium } from "playwright-core";
import { lstatSync, realpathSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { SERVER_ID, PORT, paseo, BLOCK_WS } from "./guard.mjs";
const [label, dir, out] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LINK = "/tmp/bc-perf-p0p1/bench-active";
if (realpathSync(LINK) !== realpathSync(dir)) { if (!lstatSync(LINK).isSymbolicLink()) throw new Error("bad link"); unlinkSync(LINK); symlinkSync(dir, LINK); paseo("plugin", "reload", "better-paseo"); }
for (let i = 0; i < 60; i++) { const [r] = JSON.parse(paseo("plugin", "ls", "better-paseo", "--json")); if (r.status === "running") break; await sleep(500); }
const ctx = await chromium.launchPersistentContext("/tmp/bc-perf-p0p1/web-profile-img", { executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, locale: "zh-CN", viewport: { width: 1280, height: 900 } });
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.routeWebSocket(BLOCK_WS, (ws) => ws.close());
const id = paseo("run", "-d", "-q", "--provider", "bc-bench", "--cwd", "/tmp/bc-perf-p0p1/project", "--title", `imgfail-${label}`, "list").trim().split("\n").pop();
try { paseo("wait", id, "--timeout", "60"); } catch {}
const url = `http://127.0.0.1:8092/h/${SERVER_ID}/agent/${id}`;
await page.goto(url); await sleep(5000);
await page.evaluate(() => globalThis.__bcPerf.enable());
paseo("send", id, "fixture:images-missing-p3 speed:max"); try { paseo("wait", id, "--timeout", "120"); } catch {}
await page.reload(); await sleep(7000);
const snap = await page.evaluate(() => globalThis.__bcPerf.snapshot().imageRpc);
const text = await page.evaluate(() => { const el = [...document.querySelectorAll("*")].filter((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.getBoundingClientRect().width > 500).sort((a, b) => b.scrollHeight - a.scrollHeight)[0]; return (el ?? document.body).innerText; });
const shot = `${out.replace(/\.json$/, "")}.png`;
await page.screenshot({ path: shot });
await page.evaluate(() => globalThis.__bcPerf.disable());
const tail = text.slice(text.indexOf("Missing screenshot")).replace(/\d{1,2}:\d{2}/g, "HH:MM");
writeFileSync(out, JSON.stringify({ label, dir, historyLoad: snap, tail }, null, 2));
console.log(label, JSON.stringify(snap), JSON.stringify(tail.slice(0, 400)));
await ctx.close();
