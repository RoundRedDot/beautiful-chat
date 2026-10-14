import { readFileSync } from "node:fs";
import { createBlockCache, splitBlocks, type BlockCache } from "../../../../client/components/markdown/blocks";
import { repairTail } from "../../../../client/components/markdown/repair";
import { disablePerf, enablePerf, perfSnapshot, resetPerf } from "../../../../client/debug/perf";
import type { Token } from "../../../../client/vendor/marked";

export interface LexApi {
  lexBlock(raw: string, open?: boolean): Token[];
  lexCacheSize(): number;
}

interface Event {
  item?: { type: string; text?: string };
}

interface SessionState {
  texts: Map<string, string>;
  caches: Map<string, BlockCache>;
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
  return `test/fixtures/streams/${name}.jsonl`;
}

function processFixture(events: Event[], lex: LexApi, markerPrefix?: string): SessionState {
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
      index === blocks.length - 1 ? lex.lexBlock(repairTail(raw), true) : lex.lexBlock(raw),
    );
  }
  for (const [name, text] of texts) {
    splitBlocks(text, caches.get(name)).forEach((raw) => lex.lexBlock(raw));
  }
  return { texts, caches };
}

function runMultiSession(lex: LexApi): { sessions: number; markerBlocks: number } {
  const gc = (globalThis as { gc?: () => void }).gc;
  if (gc === undefined) throw new Error("run with node --expose-gc");
  let markerBlocks = 0;
  for (let cycle = 0; cycle < MULTI_SESSION_CYCLES; cycle += 1) {
    for (const fixture of MULTI_SESSION_FIXTURES) {
      const events = readEvents(fixturePath(fixture));
      let state: SessionState | null = processFixture(events, lex, `p2-session-${cycle}-${fixture}`);
      markerBlocks += state.texts.size;
      state = null;
      gc();
    }
  }
  return { sessions: MULTI_SESSION_CYCLES * MULTI_SESSION_FIXTURES.length, markerBlocks };
}

export function runRetention(lex: LexApi): void {
  const gc = (globalThis as { gc?: () => void }).gc;
  const sequence = process.argv[2] ?? "";
  if (gc === undefined || (sequence !== "history-100" && sequence !== "markdown-long" && sequence !== "multi-session")) {
    console.error("usage: node --expose-gc <bundle> <history-100|markdown-long|multi-session>");
    process.exit(2);
  }
  const events = sequence === "multi-session" ? undefined : readEvents(fixturePath(sequence));
  disablePerf();
  resetPerf();
  enablePerf();
  gc();
  gc();
  const before = process.memoryUsage().heapUsed;
  let heldState: SessionState | undefined;
  const multi = sequence === "multi-session"
    ? runMultiSession(lex)
    : (heldState = processFixture(events ?? [], lex), undefined);
  const completedEntries = lex.lexCacheSize();
  const completedMisses = perfSnapshot().counters["md.lexFinalMiss"] ?? 0;
  gc();
  gc();
  const after = process.memoryUsage().heapUsed;
  disablePerf();
  console.log(JSON.stringify({
    sequence,
    node: process.version,
    sessions: multi?.sessions ?? 1,
    markerBlocks: multi?.markerBlocks ?? 0,
    completedEntries,
    completedMisses: completedMisses ?? null,
    retainedBytes: after - before,
    retainedHeapAfterGcBytes: after,
  }));
  void heldState;
}

