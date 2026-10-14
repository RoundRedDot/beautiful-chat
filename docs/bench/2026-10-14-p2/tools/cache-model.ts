import { LEXER_OPTIONS, lexBlock, lexCacheSize } from "../../../../client/components/markdown/lex";
import { Lexer, type Token } from "../../../../client/vendor/marked";

export type CacheMode = "current" | "a" | "b";
export interface CacheEntry {
  tokens: Token[];
  sourceLength: number;
  weight: number;
  touched: number;
}

export const COMPLETE_LIMIT = 500;
export const TAIL_LIMIT = 8;

/** Offline current/A/B lex cache model. Candidate modes call the same Lexer. */
export class CacheRun {
  readonly main = new Map<string, CacheEntry>();
  readonly oversize = new Map<string, CacheEntry>();
  readonly tails = new Map<string, CacheEntry>();
  completedMisses = 0;
  parserCalls = 0;
  reparseMs = 0;
  private touched = 0;

  constructor(
    readonly mode: CacheMode,
    readonly budget: number,
    readonly coefficient: number,
    readonly oversizeSlots: number,
    readonly oversizeThreshold = budget / 4,
  ) {}

  get completedSize(): number {
    return this.main.size + this.oversize.size;
  }

  get sourceChars(): number {
    let chars = 0;
    for (const entry of this.main.values()) chars += entry.sourceLength;
    for (const entry of this.oversize.values()) chars += entry.sourceLength;
    return chars;
  }

  get weightUnits(): number {
    let weight = 0;
    for (const entry of this.main.values()) weight += entry.weight;
    for (const entry of this.oversize.values()) weight += entry.weight;
    return weight;
  }

  get entryLengthSummary(): { median: number; p90: number; max: number } {
    const lengths = [...this.main.values(), ...this.oversize.values()]
      .map((entry) => entry.sourceLength)
      .sort((a, b) => a - b);
    if (lengths.length === 0) return { median: 0, p90: 0, max: 0 };
    const at = (fraction: number): number => lengths[Math.min(lengths.length - 1, Math.floor((lengths.length - 1) * fraction))] ?? 0;
    return { median: at(0.5), p90: at(0.9), max: lengths[lengths.length - 1] ?? 0 };
  }

  private touch(map: Map<string, CacheEntry>, raw: string, entry: CacheEntry): void {
    map.delete(raw);
    entry.touched = ++this.touched;
    map.set(raw, entry);
  }

  private oldestKey(map: Map<string, CacheEntry>, except?: string): string | undefined {
    for (const key of map.keys()) if (key !== except) return key;
    return undefined;
  }

  private removeOldestAcrossComplete(): void {
    const mainFirst = this.main.entries().next().value as [string, CacheEntry] | undefined;
    const oversizeFirst = this.oversize.entries().next().value as [string, CacheEntry] | undefined;
    if (mainFirst === undefined && oversizeFirst === undefined) return;
    if (oversizeFirst === undefined || (mainFirst !== undefined && mainFirst[1].touched <= oversizeFirst[1].touched)) {
      this.main.delete(mainFirst?.[0] ?? "");
    } else {
      this.oversize.delete(oversizeFirst[0]);
    }
  }

  private evictByBudget(newestRaw: string): void {
    if (this.mode === "a" || this.mode === "b") {
      let weight = 0;
      for (const entry of this.main.values()) weight += entry.weight;
      while (weight > this.budget && this.main.size > 1) {
        const oldest = this.oldestKey(this.main, newestRaw);
        if (oldest === undefined) break;
        const removed = this.main.get(oldest);
        this.main.delete(oldest);
        weight -= removed?.weight ?? 0;
      }
    }
    while (this.completedSize > COMPLETE_LIMIT) this.removeOldestAcrossComplete();
  }

  lex(raw: string, open = false): Token[] {
    let entry = this.main.get(raw);
    let map = this.main;
    if (entry === undefined && this.mode === "b") {
      entry = this.oversize.get(raw);
      map = this.oversize;
    }
    const completedHit = entry !== undefined;
    if (entry !== undefined) {
      this.touch(map, raw, entry);
      return entry.tokens;
    }
    if (open) {
      const tail = this.tails.get(raw);
      if (tail !== undefined) {
        this.touch(this.tails, raw, tail);
        return tail.tokens;
      }
    }

    const started = process.hrtime.bigint();
    const tokens = this.mode === "current" ? lexBlock(raw, open) : Lexer.lex(raw, LEXER_OPTIONS);
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    this.parserCalls += 1;
    this.reparseMs += elapsedMs;
    if (!open && !completedHit) this.completedMisses += 1;

    const cached: CacheEntry = {
      tokens,
      sourceLength: raw.length,
      weight: raw.length * this.coefficient,
      touched: ++this.touched,
    };
    if (open) {
      this.tails.set(raw, cached);
      while (this.tails.size > TAIL_LIMIT) {
        const oldest = this.oldestKey(this.tails);
        if (oldest === undefined) break;
        this.tails.delete(oldest);
      }
      return tokens;
    }

    const isOversize = this.mode === "b" && cached.weight > this.oversizeThreshold;
    if (isOversize) {
      this.oversize.set(raw, cached);
      while (this.oversize.size > this.oversizeSlots) {
        const oldest = this.oldestKey(this.oversize);
        if (oldest === undefined) break;
        this.oversize.delete(oldest);
      }
    } else {
      this.main.set(raw, cached);
    }

    this.evictByBudget(raw);
    if (this.mode === "current" && this.completedSize !== lexCacheSize()) {
      throw new Error(`current cache trace mismatch: trace=${this.completedSize} source=${lexCacheSize()}`);
    }
    return tokens;
  }

  /** Used only after a candidate's retained heap has been sampled. */
  clear(): void {
    this.main.clear();
    this.oversize.clear();
    this.tails.clear();
  }
}
