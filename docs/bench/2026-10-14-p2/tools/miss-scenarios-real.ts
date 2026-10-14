import { readFileSync } from "node:fs";
import { createBlockCache, splitBlocks } from "../../../../client/components/markdown/blocks";
import { repairTail } from "../../../../client/components/markdown/repair";
import { disablePerf, enablePerf, perfSnapshot, resetPerf } from "../../../../client/debug/perf";
import type { Token } from "../../../../client/vendor/marked";

interface LexApi {
  lexBlock(raw: string, open?: boolean): Token[];
  lexCacheSize(): number;
}

interface Event {
  item?: { type: string; text?: string };
}

function readEvents(path: string): Event[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Event);
}

function historyBlocks(): string[] {
  const events = readEvents("test/fixtures/streams/history-100.jsonl");
  const texts = new Map<string, string>();
  let key = "";
  for (const { item } of events) {
    if (item === undefined) continue;
    if (item.type !== "assistant_message" && item.type !== "reasoning") {
      key = "";
      continue;
    }
    if (key === "" || !key.startsWith(item.type)) key = `${item.type}#${texts.size}`;
    texts.set(key, (texts.get(key) ?? "") + (item.text ?? ""));
  }
  return [...texts.values()].flatMap((text) => splitBlocks(text, createBlockCache()));
}

function largeCodeBlock(label: string, lines = 2300): string {
  const body = Array.from(
    { length: lines },
    (_, index) => `export const ${label}_${String(index).padStart(4, "0")} = ${index};`,
  ).join("\n");
  return `\`\`\`ts\n${body}\n\`\`\``;
}

function run(lex: LexApi, scenario: string): void {
  disablePerf();
  resetPerf();
  enablePerf();
  let calls = 0;
  let blocks: string[];
  if (scenario === "single-large") {
    blocks = [largeCodeBlock("single")];
    const source = blocks[0] ?? "";
    lex.lexBlock(source, true);
    lex.lexBlock(source, false); // stream finish flips open=false
    lex.lexBlock(source, false); // theme context render
    lex.lexBlock(source, false); // font-size context render
    calls = 4;
  } else if (scenario === "multi-large") {
    blocks = [largeCodeBlock("alpha"), largeCodeBlock("bravo"), largeCodeBlock("charlie")];
    for (let pass = 0; pass < 5; pass += 1) {
      for (const source of blocks) lex.lexBlock(source);
    }
    calls = blocks.length * 5;
  } else if (scenario === "history-100") {
    blocks = historyBlocks();
    for (const source of blocks) lex.lexBlock(source);
    for (const source of blocks) lex.lexBlock(source); // theme context render
    calls = blocks.length * 2;
  } else {
    throw new Error(`unknown scenario: ${scenario}`);
  }
  const misses = perfSnapshot().counters["md.lexFinalMiss"] ?? 0;
  disablePerf();
  console.log(JSON.stringify({
    scenario,
    node: process.version,
    renderCalls: calls,
    sourceBlockCount: blocks.length,
    sourceCharsTotal: blocks.reduce((sum, source) => sum + source.length, 0),
    largestSourceChars: Math.max(0, ...blocks.map((source) => source.length)),
    completedMisses: misses,
    completedEntriesAfter: lex.lexCacheSize(),
  }));
}

export { run as runMissScenarios };

