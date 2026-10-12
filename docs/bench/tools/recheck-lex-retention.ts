import { readFileSync } from "node:fs";
import { createBlockCache, splitBlocks } from "/Users/luopeihuan/workspace/rrd/beautiful-chat/.worktrees/perf-regressions/client/components/markdown/blocks";
import { lexBlock, lexCacheSize } from "/Users/luopeihuan/workspace/rrd/beautiful-chat/.worktrees/perf-regressions/client/components/markdown/lex";
import { repairTail } from "/Users/luopeihuan/workspace/rrd/beautiful-chat/.worktrees/perf-regressions/client/components/markdown/repair";
const gc = (globalThis as any).gc as () => void;
const file = process.argv[2];
const lines = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const texts: Record<string, string> = {};
gc(); const before = process.memoryUsage().heapUsed;
let current = ""; let key = "";
const caches = new Map<string, ReturnType<typeof createBlockCache>>();
for (const l of lines) {
  if (!l.item) continue;
  const t = l.item.type;
  if (t !== "assistant_message" && t !== "reasoning") { key = ""; continue; }
  if (key === "" || !key.startsWith(t)) { key = `${t}#${Object.keys(texts).length}`; texts[key] = ""; }
  texts[key] += l.item.text;
  let cache = caches.get(key); if (!cache) { cache = createBlockCache(); caches.set(key, cache); }
  const blocks = splitBlocks(texts[key], cache);
  blocks.forEach((raw, i) => (i === blocks.length - 1 ? lexBlock(repairTail(raw), true) : lexBlock(raw)));
}
// final, not streaming
for (const [k, text] of Object.entries(texts)) { const b = splitBlocks(text, caches.get(k)); b.forEach((r) => lexBlock(r)); }
gc(); const after = process.memoryUsage().heapUsed;
console.log(file.split("/").pop(), "lru", lexCacheSize(), "retained MB", ((after - before) / 1048576).toFixed(2));
