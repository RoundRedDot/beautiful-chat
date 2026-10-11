// Shared helpers for the V1 web walk-through (production web build served on :8090, bench daemon).
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
export const SERVER = process.env.BC_SERVER_ID;
if (!SERVER) throw new Error("Set BC_SERVER_ID to the isolated bench daemon server ID");
const require = createRequire(new URL("../../../.showcase/package.json", import.meta.url));
const { chromium } = require("playwright-core");
export const agents = Object.fromEntries(readFileSync("/tmp/web-agents.txt", "utf8").trim().split("\n").map((l) => l.split(" ")));
export const OUT = fileURLToPath(new URL("../raw-v1/", import.meta.url));
export async function launch(opts = {}) {
  const ctx = await chromium.launchPersistentContext("/tmp/bc-web-profile", {
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true, viewport: { width: 1280, height: 900 }, ...opts,
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.routeWebSocket(/:6767\//, (ws) => ws.close());
  return { ctx, page };
}
export async function open(page, name, wait = 6000) {
  await page.goto(`http://127.0.0.1:8090/h/${SERVER}/agent/${agents[name]}`);
  await page.waitForTimeout(wait);
}
export const shot = (page, file) => page.screenshot({ path: `${OUT}/${file}` });
export async function scrollChat(page, dy, steps = 1) {
  await page.mouse.move(800, 400);
  for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dy); await page.waitForTimeout(120); }
  await page.waitForTimeout(500);
}
export async function rowIntoView(page, index, block = "start") {
  await page.evaluate(([i, b]) => document.querySelectorAll("[data-history-row-id]")[i]?.scrollIntoView({ block: b }), [index, block]);
  await page.waitForTimeout(700);
}
