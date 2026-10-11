// V1 walk-through, part 7: scenario 13 - the expand state survives an in-app switch to another workspace and back.
import { launch, open, shot, rowIntoView, OUT } from "./web-lib.mjs";
import { writeFileSync } from "node:fs";
const out = {};
const { ctx, page } = await launch();
await open(page, "reads-20");
await rowIntoView(page, 8);
const pick = () => page.evaluate(() => [...document.querySelectorAll("[data-history-row-id]")].map((e, i) => ({ i, h: Math.round(e.getBoundingClientRect().height), t: (e.textContent || "").slice(0, 40) })).filter((r) => /^Read/.test(r.t)));
const before = await pick();
const target = before[4];
await page.evaluate((i) => { const r = document.querySelectorAll("[data-history-row-id]")[i]; (r.querySelector("[role=button]") ?? r.firstElementChild).click(); }, target.i);
await page.waitForTimeout(800);
const expanded = (await pick()).find((r) => r.i === target.i);
out.target = target.t; out.heightCollapsed = target.h; out.heightExpanded = expanded.h;
// in-app switch: click a different workspace in the sidebar, then browser back
out.url0 = page.url();
const ws0 = (page.url().match(/wks_[0-9a-f]+/) ?? [])[0];
out.ws0 = ws0 ?? null;
await page.locator("text=master").nth(3).click();
await page.waitForTimeout(3500);
out.switchedUrl = page.url().slice(-60);
const back = ws0 ? page.locator(`a[href*="${ws0}"]`).first() : null;
out.backLinks = ws0 ? await page.locator(`a[href*="${ws0}"]`).count() : 0;
if (back && out.backLinks) await back.click(); else await page.goBack();
await page.waitForTimeout(4500);
// the list is virtualised: step through it and look for any expanded Read row
let tall = null;
for (let k = 0; k < 14 && !tall; k++) { await rowIntoView(page, k * 2); tall = (await pick()).find((r) => r.h > 200) ?? null; }
out.heightAfterSwitchBack = tall ? tall.h : null;
out.stillExpanded = !!tall;
await shot(page, "web-reads-expand-state-after-inapp-switch.png");
await ctx.close();
// Keep workspace equality in the evidence without publishing live host identifiers.
const workspaceIds = new Map();
const redactLocation = (value) => value
  .replace(/srv_[A-Za-z0-9]+/g, "srv_example")
  .replace(/wks_[0-9a-f]+/g, (id) => {
    if (!workspaceIds.has(id)) workspaceIds.set(id, `wks_example_${workspaceIds.size + 1}`);
    return workspaceIds.get(id);
  });
for (const key of ["url0", "ws0", "switchedUrl"]) {
  if (typeof out[key] === "string") out[key] = redactLocation(out[key]);
}
writeFileSync(`${OUT}/web-walk-7.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out));
