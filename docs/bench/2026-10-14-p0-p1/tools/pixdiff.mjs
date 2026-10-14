// Pixel diff of PNG pairs in headless Chrome (no extra deps).
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
const pairs = process.argv.slice(2).reduce((a, x, i, arr) => (i % 2 ? a : [...a, [x, arr[i + 1]]]), []);
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const p = await b.newPage();
for (const [x, y] of pairs) {
  const r = await p.evaluate(async ([a, c]) => {
    const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = "data:image/png;base64," + s; });
    const [i1, i2] = await Promise.all([load(a), load(c)]);
    if (i1.width !== i2.width || i1.height !== i2.height) return { size: [i1.width, i1.height, i2.width, i2.height] };
    const cv = (i) => { const k = document.createElement("canvas"); k.width = i.width; k.height = i.height; const g = k.getContext("2d"); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data; };
    const d1 = cv(i1), d2 = cv(i2); let n = 0; let box = [1e9, 1e9, -1, -1];
    for (let k = 0; k < d1.length; k += 4) if (d1[k] !== d2[k] || d1[k + 1] !== d2[k + 1] || d1[k + 2] !== d2[k + 2]) { n++; const px = (k / 4) % i1.width, py = Math.floor(k / 4 / i1.width); box = [Math.min(box[0], px), Math.min(box[1], py), Math.max(box[2], px), Math.max(box[3], py)]; }
    return { w: i1.width, h: i1.height, diffPixels: n, box: n ? box : null };
  }, [readFileSync(x).toString("base64"), readFileSync(y).toString("base64")]);
  console.log(x.split("/").pop(), "vs", y.split("/").pop(), JSON.stringify(r));
}
await b.close();
