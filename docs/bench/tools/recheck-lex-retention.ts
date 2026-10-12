// Replays a stream fixture through split -> repair tail -> lex, the way a
// streaming reply renders, and prints the heap the Markdown caches keep.
//   npx esbuild docs/bench/tools/recheck-lex-retention.ts --bundle --platform=node --outfile=/tmp/lex-retention.cjs
//   node --expose-gc /tmp/lex-retention.cjs test/fixtures/streams/markdown-long.jsonl
import { readFileSync } from "node:fs";
import { createBlockCache, splitBlocks, type BlockCache } from "../../../client/components/markdown/blocks";
import { lexBlock, lexCacheSize } from "../../../client/components/markdown/lex";
import { repairTail } from "../../../client/components/markdown/repair";

const gc = (globalThis as { gc?: () => void }).gc;
const file = process.argv[2];
if (gc === undefined || file === undefined) {
  console.error("usage: node --expose-gc <bundle> <fixture.jsonl>");
  process.exit(2);
}
const events = readFileSync(file, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line) as { item?: { type: string; text?: string } });

const texts = new Map<string, string>();
const caches = new Map<string, BlockCache>();
gc();
const before = process.memoryUsage().heapUsed;
let key = "";
for (const { item } of events) {
  if (item === undefined) continue;
  if (item.type !== "assistant_message" && item.type !== "reasoning") {
    key = "";
    continue;
  }
  if (key === "" || !key.startsWith(item.type)) key = `${item.type}#${texts.size}`;
  const text = (texts.get(key) ?? "") + (item.text ?? "");
  texts.set(key, text);
  let cache = caches.get(key);
  if (cache === undefined) {
    cache = createBlockCache();
    caches.set(key, cache);
  }
  const blocks = splitBlocks(text, cache);
  blocks.forEach((raw, index) =>
    index === blocks.length - 1 ? lexBlock(repairTail(raw), true) : lexBlock(raw),
  );
}
// The finished replies, drawn once more without the streaming tail.
for (const [name, text] of texts) splitBlocks(text, caches.get(name)).forEach((raw) => lexBlock(raw));
gc();
const after = process.memoryUsage().heapUsed;
console.log(file.split("/").pop(), "lru", lexCacheSize(), "retained MB", ((after - before) / 1048576).toFixed(2));
