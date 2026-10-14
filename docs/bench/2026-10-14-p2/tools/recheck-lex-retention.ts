// Offline Markdown cache replay. This file is a local copy of
// docs/bench/tools/recheck-lex-retention.ts with current/A/B modes and a
// multi-session sequence added for the P2 pre-measurement.
//
// Build:
//   npx esbuild docs/bench/2026-10-14-p2/tools/recheck-lex-retention.ts --bundle --platform=node --outfile=/tmp/bc-perf-p2/recheck-lex-retention.cjs
// Run one fixture:
//   node --expose-gc /tmp/bc-perf-p2/recheck-lex-retention.cjs current history-100
//   node --expose-gc /tmp/bc-perf-p2/recheck-lex-retention.cjs a history-100 <weight-budget> <coefficient>
//   node --expose-gc /tmp/bc-perf-p2/recheck-lex-retention.cjs b history-100 <weight-budget> <coefficient> [oversize-slots]
// Run the fixed multi-session sequence:
//   node --expose-gc /tmp/bc-perf-p2/recheck-lex-retention.cjs current multi-session
import { readFileSync } from "node:fs";
import { createBlockCache, splitBlocks, type BlockCache } from "../../../../client/components/markdown/blocks";
import { repairTail } from "../../../../client/components/markdown/repair";
import { CacheRun, type CacheMode } from "./cache-model";

interface Event {
  item?: { type: string; text?: string };
}

const MULTI_SESSION_FIXTURES = [
  "history-100",
  "markdown-long",
  "codeblock-streaming",
  "reasoning-long-sections",
  "table-streaming",
  "shell-log-large",
];
const MULTI_SESSION_CYCLES = 6;
const MARKER_SIZES = [0, 32, 256, 2048, 8192, 16384];

function readEvents(path: string): Event[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Event);
}

function fixturePath(name: string): string {
  return name.includes("/") ? name : `test/fixtures/streams/${name.replace(/\.jsonl$/, "")}.jsonl`;
}

interface SessionState {
  texts: Map<string, string>;
  caches: Map<string, BlockCache>;
}

function processFixture(events: Event[], cacheRun: CacheRun, markerPrefix?: string): SessionState {
  const texts = new Map<string, string>();
  const caches = new Map<string, BlockCache>();
  let key = "";
  let messageNumber = 0;
  for (const { item } of events) {
    if (item === undefined) continue;
    if (item.type !== "assistant_message" && item.type !== "reasoning") {
      key = "";
      continue;
    }
    if (key === "" || !key.startsWith(item.type)) {
      key = `${item.type}#${texts.size}`;
      const markerSize = MARKER_SIZES[messageNumber % MARKER_SIZES.length] ?? 0;
      const marker = markerPrefix === undefined
        ? ""
        : `<!-- ${markerPrefix}-${messageNumber}-${"x".repeat(markerSize)} -->\n\n`;
      texts.set(key, marker);
      messageNumber += 1;
    }
    const text = (texts.get(key) ?? "") + (item.text ?? "");
    texts.set(key, text);
    let cache = caches.get(key);
    if (cache === undefined) {
      cache = createBlockCache();
      caches.set(key, cache);
    }
    const blocks = splitBlocks(text, cache);
    blocks.forEach((raw, index) =>
      index === blocks.length - 1 ? cacheRun.lex(repairTail(raw), true) : cacheRun.lex(raw),
    );
  }
  // Draw finished replies once without their streaming tail, as the source tool does.
  for (const [name, text] of texts) {
    splitBlocks(text, caches.get(name)).forEach((raw) => cacheRun.lex(raw));
  }
  return { texts, caches };
}

function runMultiSession(cacheRun: CacheRun): { sessions: number; markerBlocks: number } {
  const gc = (globalThis as { gc?: () => void }).gc;
  if (gc === undefined) throw new Error("run with node --expose-gc");
  let markerBlocks = 0;
  for (let cycle = 0; cycle < MULTI_SESSION_CYCLES; cycle += 1) {
    for (const fixture of MULTI_SESSION_FIXTURES) {
      const events = readEvents(fixturePath(fixture));
      let state: SessionState | null = processFixture(events, cacheRun, `p2-session-${cycle}-${fixture}`);
      markerBlocks += state.texts.size;
      // Dropping local state models closing the fixture before opening the next.
      state = null;
      gc();
    }
  }
  return { sessions: MULTI_SESSION_CYCLES * MULTI_SESSION_FIXTURES.length, markerBlocks };
}

function main(): void {
  const gc = (globalThis as { gc?: () => void }).gc;
  const [modeInput = "current", sequence = "", budgetArg = "0", coefficientArg = "1", slotsArg = "2", thresholdArg] = process.argv.slice(2);
  if (gc === undefined || sequence === "") {
    console.error("usage: node --expose-gc <bundle> <current|a|b> <fixture|multi-session> [weight-budget] [coefficient] [oversize-slots]");
    process.exit(2);
  }
  if (modeInput !== "current" && modeInput !== "a" && modeInput !== "b") throw new Error(`unknown mode: ${modeInput}`);
  const mode: CacheMode = modeInput;
  const budget = Number(budgetArg);
  const coefficient = Number(coefficientArg);
  const oversizeSlots = Number(slotsArg);
  const oversizeThreshold = thresholdArg === undefined ? budget / 4 : Number(thresholdArg);
  if (!Number.isFinite(budget) || !Number.isFinite(coefficient) || coefficient <= 0 || oversizeSlots < 1 || !Number.isFinite(oversizeThreshold)) {
    throw new Error("budget, coefficient, or oversize slot argument is invalid");
  }
  const cacheRun = new CacheRun(mode, budget, coefficient, oversizeSlots, oversizeThreshold);
  let heldState: SessionState | undefined;
  let events: Event[] | undefined;
  if (sequence !== "multi-session") events = readEvents(fixturePath(sequence));

  gc();
  gc();
  const before = process.memoryUsage().heapUsed;
  const multi = sequence === "multi-session" ? runMultiSession(cacheRun) : undefined;
  if (events !== undefined) heldState = processFixture(events, cacheRun);
  const completedEntries = cacheRun.completedSize;
  const mainEntries = cacheRun.main.size;
  const oversizeEntries = cacheRun.oversize.size;
  const tailEntries = cacheRun.tails.size;
  const entryLengthSummary = cacheRun.entryLengthSummary;
  const sourceChars = cacheRun.sourceChars;
  const weightUnits = cacheRun.weightUnits;
  // The current-mode maps are measurement traces; clear them so retained heap
  // contains the production cache once, as in the source tool.
  if (mode === "current") cacheRun.clear();
  gc();
  gc();
  const after = process.memoryUsage().heapUsed;
  const retainedBytes = after - before;
  let cacheOnlyRetainedBytes: number | null = null;
  if (mode !== "current") {
    cacheRun.clear();
    gc();
    gc();
    cacheOnlyRetainedBytes = after - process.memoryUsage().heapUsed;
  }
  const result = {
    mode,
    sequence,
    node: process.version,
    budgetWeightUnits: budget,
    coefficientPerSourceChar: coefficient,
    oversizeSlots,
    oversizeThresholdWeightUnits: oversizeThreshold,
    sessions: multi?.sessions ?? 1,
    markerBlocks: multi?.markerBlocks ?? 0,
    completedEntries,
    mainEntries,
    oversizeEntries,
    tailEntries,
    sourceChars,
    retainedWeightUnits: weightUnits,
    entryLengthSummary,
    completedMisses: cacheRun.completedMisses,
    parserCalls: cacheRun.parserCalls,
    reparseMs: Number(cacheRun.reparseMs.toFixed(3)),
    retainedBytes,
    retainedMiB: Number((retainedBytes / 1048576).toFixed(4)),
    cacheOnlyRetainedBytes,
    cacheOnlyWeightBytesPerSourceChar: cacheOnlyRetainedBytes === null || sourceChars === 0
      ? null
      : Number((cacheOnlyRetainedBytes / sourceChars).toFixed(4)),
  };
  console.log(JSON.stringify(result));
  // Keep message strings and split caches alive through the post-GC measurement.
  void heldState;
}

main();
