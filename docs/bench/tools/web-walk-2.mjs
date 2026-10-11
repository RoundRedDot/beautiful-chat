// V1 walk-through, part 2: code block copy (clipboard content), table scrolling, header copy, expand-state persistence.
import { launch, open, shot, rowIntoView, OUT } from "./web-lib.mjs";
import { writeFileSync } from "node:fs";
const result = {};
const { ctx, page } = await launch({ permissions: ["clipboard-read", "clipboard-write"] });

// code block copy
await open(page, "codeblock-streaming");
const codeCopies = page.locator('[aria-label="Copy"]');
result.codeCopyButtons = await codeCopies.count();
const idx = await page.evaluate(() => { const els = [...document.querySelectorAll('[aria-label="Copy"]')]; return els.findIndex((e) => { const r = e.getBoundingClientRect(); return r.top > 100 && r.top < 700; }); });
await codeCopies.nth(idx).click();
await page.waitForTimeout(500);
const clip = await page.evaluate(() => navigator.clipboard.readText());
const shownCode = await page.evaluate((i) => { const b = document.querySelectorAll('[aria-label="Copy"]')[i]; let p = b; for (let k = 0; k < 8 && p; k++, p = p.parentElement) if (p.textContent.length > 200) return p.textContent; return ""; }, idx);
result.codeCopyClipboardHead = clip.slice(0, 160);
result.codeCopyClipboardLines = clip.split("\n").length;
result.codeCopyMatchesShownBlock = shownCode.replace(/\s+/g, "").includes(clip.replace(/\s+/g, "").slice(0, 80));
await shot(page, "web-codeblock-copy.png");
await page.locator('[aria-label="Copy reply"]').click();
await page.waitForTimeout(500);
const msg = await page.evaluate(() => navigator.clipboard.readText());
result.replyCopyHead = msg.slice(0, 160);
result.replyCopyLen = msg.length;
result.replyCopyHasFences = (msg.match(/```/g) || []).length;

// tables
await open(page, "table-streaming");
const tables = await page.evaluate(() => [...document.querySelectorAll("table, [role=table]")].map((t) => { let p = t; let best = null; for (let i = 0; i < 6 && p; i++, p = p.parentElement) if (p.scrollWidth > p.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(p).overflowX)) { best = { sw: p.scrollWidth, cw: p.clientWidth }; break; } return { w: t.getBoundingClientRect().width, scroller: best }; }));
result.tables = tables;
await shot(page, "web-table-final.png");
await ctx.close();
writeFileSync(`${OUT}/web-walk-2.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 1));
