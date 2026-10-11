// V1 walk-through, part 6: expand state survives switching agents/workspaces; diff-large expansion cap.
import { launch, open, shot, rowIntoView, OUT } from "./web-lib.mjs";
import { writeFileSync } from "node:fs";
const out = {};
const { ctx, page } = await launch();
await open(page, "reads-20");
const heights = () => page.evaluate(() => [...document.querySelectorAll("[data-history-row-id]")].map((e) => Math.round(e.getBoundingClientRect().height)));
await rowIntoView(page, 8);
const idx = await page.evaluate(() => [...document.querySelectorAll("[data-history-row-id]")].findIndex((e, i) => i > 5 && /^Read/.test((e.textContent || "").trim())));
await page.evaluate((i) => { const r = document.querySelectorAll("[data-history-row-id]")[i]; (r.querySelector("[role=button]") ?? r.firstElementChild).click(); }, idx);
await page.waitForTimeout(800);
out.expandedHeight = (await heights())[idx];
await shot(page, "web-reads-expanded.png");
await open(page, "mixed-turn", 3000);   // switch to another agent (and workspace)
await open(page, "reads-20", 5000);     // and back
await rowIntoView(page, 8);
const idx2 = await page.evaluate(() => [...document.querySelectorAll("[data-history-row-id]")].findIndex((e, i) => i > 5 && (e.getBoundingClientRect().height > 60) && /^Read/.test((e.textContent || "").trim())));
out.expandedAfterNavigation = idx2 >= 0 ? (await heights())[idx2] : null;
out.expandedRowStillOpen = idx2 >= 0;
await shot(page, "web-reads-expanded-after-switch.png");
// diff-large: expand the edit row and count rendered diff lines
await open(page, "diff-large");
const di = await page.evaluate(() => [...document.querySelectorAll("[data-history-row-id]")].findIndex((e) => /^.{0,3}Edit/.test((e.textContent || "").trim())));
await page.evaluate((i) => { const r = document.querySelectorAll("[data-history-row-id]")[i]; (r.querySelector("[role=button]") ?? r.firstElementChild).click(); }, di);
const t0 = Date.now();
await page.waitForTimeout(3000);
out.diffExpandRowCount = await page.evaluate((i) => { const r = document.querySelectorAll("[data-history-row-id]")[i]; return { h: Math.round(r.getBoundingClientRect().height), textLen: r.textContent.length, showAll: /Show all|显示全部|more lines/i.test(r.textContent) }; }, di);
await rowIntoView(page, di);
await shot(page, "web-diff-large-expanded.png");
await ctx.close();
writeFileSync(`${OUT}/web-walk-6.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out));
