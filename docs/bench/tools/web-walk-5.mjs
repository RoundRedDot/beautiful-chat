// V1 walk-through, part 5: configurable mono font (Custom -> Menlo) and dark theme.
import { launch, open, shot, SERVER, OUT } from "./web-lib.mjs";
import { writeFileSync } from "node:fs";
const out = {};
const { ctx, page } = await launch();
const monoFamily = async () => page.evaluate(() => { const els = [...document.querySelectorAll("*")].filter((e) => e.children.length === 0 && /Debounce|debounce/.test(e.textContent || "")); const e = els.find((x) => /pub struct|Debounce</.test(x.textContent)) ?? els[0]; return e ? getComputedStyle(e).fontFamily.slice(0, 90) : null; });
await open(page, "codeblock-streaming");
out.monoDefault = await monoFamily();
await page.goto(`http://127.0.0.1:8090/settings/hosts/${SERVER}/plugins/bc-final/chat-presentation`);
await page.waitForTimeout(5000);
await page.getByText("Custom", { exact: true }).first().click();
await page.waitForTimeout(800);
await shot(page, "web-settings-custom-font.png");
const input = page.getByPlaceholder("e.g. JetBrains Mono");
out.customInputs = await page.locator("input").count();
await input.fill("Menlo"); await input.press("Enter"); await page.mouse.click(1250, 300);
await page.waitForTimeout(1500);
await open(page, "codeblock-streaming");
out.monoCustom = await monoFamily();
await shot(page, "web-codeblock-menlo.png");
// restore
await page.goto(`http://127.0.0.1:8090/settings/hosts/${SERVER}/plugins/bc-final/chat-presentation`);
await page.waitForTimeout(5000);
await page.getByText("Follow Paseo", { exact: true }).nth(0).click().catch(() => {});
await page.waitForTimeout(1500);
const row = await page.evaluate(() => [...document.querySelectorAll("*")].filter((e) => e.children.length === 0 && /^Follow Paseo$/.test(e.textContent)).length);
await ctx.close();
// dark theme
const d = await launch({ colorScheme: "dark" });
await open(d.page, "mixed-turn");
await shot(d.page, "web-mixed-turn-dark.png");
out.darkBg = await d.page.evaluate(() => getComputedStyle(document.body).backgroundColor);
await d.ctx.close();
writeFileSync(`${OUT}/web-walk-5.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out));
