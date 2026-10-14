// Deterministic offline render-pass simulations for completed-block cache misses.
// Candidate modes use the copied cache policy model; current mode calls the
// instrumented production lexBlock and reads md.lexFinalMiss from perfSnapshot.
import { readFileSync } from "node:fs";
import { createBlockCache, splitBlocks } from "../../../../client/components/markdown/blocks";
import { disablePerf, enablePerf, perfSnapshot, resetPerf } from "../../../../client/debug/perf";
import { CacheRun, type CacheMode } from "./cache-model";

interface Event {
  item?: { type: string; text?: string };
}

function readEvents(path: string): Event[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Event);
}

function historyMessages(): string[] {
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
  return [...texts.values()];
}

function largeCodeBlock(label: string, lines = 2300): string {
  const body = Array.from(
    { length: lines },
    (_, index) => `export const ${label}_${String(index).padStart(4, "0")} = ${index};`,
  ).join("\n");
  return `\`\`\`ts\n${body}\n\`\`\``;
}

function blocksForMessages(messages: string[]): string[] {
  return messages.flatMap((text) => {
    const cache = createBlockCache();
    return splitBlocks(text, cache);
  });
}

function runScenario(name: string, cache: CacheRun): { sourceLengths: number[]; calls: number } {
  let calls = 0;
  if (name === "single-large") {
    const block = largeCodeBlock("single");
    const render = (open: boolean): void => {
      cache.lex(block, open);
      calls += 1;
    };
    // Initial streaming render; finish flips open=false; theme and size changes
    // then re-render the completed block through the finished-cache path.
    render(true);
    render(false);
    render(false);
    render(false);
    return { sourceLengths: [block.length], calls };
  }

  if (name === "multi-large") {
    const blocks = [largeCodeBlock("alpha"), largeCodeBlock("bravo"), largeCodeBlock("charlie")];
    const renderPass = (): void => {
      for (const block of blocks) {
        cache.lex(block);
        calls += 1;
      }
    };
    renderPass(); // first mount
    renderPass(); // theme switch
    renderPass(); // font-size switch
    renderPass(); // switch back
    renderPass(); // switch back again
    return { sourceLengths: blocks.map((block) => block.length), calls };
  }

  if (name === "history-100") {
    const blocks = blocksForMessages(historyMessages());
    const renderPass = (): void => {
      for (const block of blocks) {
        cache.lex(block);
        calls += 1;
      }
    };
    renderPass(); // browsing mounts the 100-message history
    renderPass(); // one theme context change while the history remains mounted
    return { sourceLengths: blocks.map((block) => block.length), calls };
  }

  throw new Error(`unknown scenario: ${name}`);
}

function main(): void {
  const [modeInput = "current", scenario = "", budgetArg = "0", coefficientArg = "1", slotsArg = "2", thresholdArg] = process.argv.slice(2);
  if (scenario === "") {
    console.error("usage: node <bundle> <current|a|b> <single-large|multi-large|history-100> [weight-budget] [coefficient] [oversize-slots]");
    process.exit(2);
  }
  if (modeInput !== "current" && modeInput !== "a" && modeInput !== "b") throw new Error(`unknown mode: ${modeInput}`);
  const mode: CacheMode = modeInput;
  const budget = Number(budgetArg);
  const coefficient = Number(coefficientArg);
  const oversizeSlots = Number(slotsArg);
  const oversizeThreshold = thresholdArg === undefined ? budget / 4 : Number(thresholdArg);
  const cache = new CacheRun(mode, budget, coefficient, oversizeSlots, oversizeThreshold);

  if (mode === "current") {
    disablePerf();
    resetPerf();
    enablePerf();
  }
  const result = runScenario(scenario, cache);
  const probeCount = mode === "current" ? (perfSnapshot().counters["md.lexFinalMiss"] ?? 0) : null;
  if (mode === "current" && probeCount !== cache.completedMisses) {
    throw new Error(`counter mismatch: probe=${probeCount} model=${cache.completedMisses}`);
  }
  if (mode === "current") disablePerf();
  console.log(JSON.stringify({
    mode,
    scenario,
    node: process.version,
    budgetWeightUnits: budget,
    coefficientPerSourceChar: coefficient,
    oversizeSlots,
    oversizeThresholdWeightUnits: oversizeThreshold,
    renderCalls: result.calls,
    sourceBlockCount: result.sourceLengths.length,
    sourceCharsTotal: result.sourceLengths.reduce((sum, length) => sum + length, 0),
    largestSourceChars: Math.max(0, ...result.sourceLengths),
    completedMisses: cache.completedMisses,
    debugCounter: probeCount,
    parserCalls: cache.parserCalls,
    reparseMs: Number(cache.reparseMs.toFixed(3)),
    completedEntriesAfter: cache.completedSize,
  }));
}

main();
