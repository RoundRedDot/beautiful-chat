// V1 walk-through, part 1: collapsed rows + gaps, reasoning text, code block copy, wide code/table scrolling.
import { launch, open, shot, rowIntoView, OUT } from "./web-lib.mjs";
import { writeFileSync } from "node:fs";
const result = {};
const { ctx, page } = await launch({ permissions: ["clipboard-read", "clipboard-write"] });

// 1. reads-20: rows are collapsed single lines; gap between consecutive plugin rows
await open(page, "reads-20");
const rows = await page.evaluate(() => [...document.querySelectorAll("[data-history-row-id]")].map((e) => { const r = e.getBoundingClientRect(); const c = e.firstElementChild?.getBoundingClientRect(); return { top: r.top, h: r.height, cardTop: c?.top, cardH: c?.height, text: (e.textContent || "").slice(0, 30) }; }));
await rowIntoView(page, 8);
const vis = await page.evaluate(() => [...document.querySelectorAll("[data-history-row-id]")].map((e) => { const r = e.getBoundingClientRect(); const c = e.firstElementChild?.getBoundingClientRect(); return { top: r.top, h: r.height, cardTop: c?.top, cardH: c?.height, text: (e.textContent || "").slice(0, 24) }; }).filter((r) => r.top > 60 && r.top < 800 && /^Read/.test(r.text)));
result.reads20 = { rowHeights: vis.map((r) => r.h), pitches: vis.slice(1).map((r, i) => r.top - vis[i].top), cardHeights: vis.map((r) => r.cardH) };
await shot(page, "web-reads-20-final.png");

// 2. reasoning: expanded text has no numbering
await open(page, "reasoning-long-sections");
const thought = await page.evaluate(() => [...document.querySelectorAll("[data-history-row-id]")].map((e) => (e.textContent || "").slice(0, 60)));
result.reasoningRows = thought;
await page.evaluate(() => { const r = [...document.querySelectorAll("[data-history-row-id]")].find((e) => /^Thought/.test((e.textContent || "").trim())); (r.querySelector("[role=button]") ?? r.firstElementChild).click(); });
await page.waitForTimeout(800);
const body = await page.evaluate(() => { const r = [...document.querySelectorAll("[data-history-row-id]")].find((e) => /^Thought/.test((e.textContent || "").trim())); r.scrollIntoView({ block: "start" }); return r.textContent; });
result.reasoningHasStepNumbers = /\bStep \d|^\s*\d+\.\s/m.test(body);
result.reasoningBodyHead = body.slice(0, 200);
await page.waitForTimeout(500);
await shot(page, "web-reasoning-sections-expanded.png");

// 3. code block: copy button + clipboard + mono font + horizontal scroll
await open(page, "codeblock-streaming");
const info = await page.evaluate(() => {
  const pre = [...document.querySelectorAll("div")].filter((d) => /monospace|mono|Iosevka|ui-monospace|Menlo|SF/i.test(getComputedStyle(d).fontFamily) && d.textContent && d.textContent.length > 80);
  return pre.slice(0, 5).map((d) => ({ ff: getComputedStyle(d).fontFamily.slice(0, 80), len: d.textContent.length, sw: d.scrollWidth, cw: d.clientWidth }));
});
result.codeBlocks = info;
await shot(page, "web-codeblock-final-bottom.png");
await ctx.close();
writeFileSync(`${OUT}/web-walk-1.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 1).slice(0, 3000));
