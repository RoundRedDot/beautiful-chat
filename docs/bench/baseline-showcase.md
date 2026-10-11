# Baseline: offline replay of the current plugin

Baseline for slice S0 (plan §3.2, BC-07). Plugin code: `s0-infra` at the commit that adds this file; renderers and Markdown engine are the pre-upgrade ones (the only changes since `42b61d8` are inert probes). Fixtures: the 11 streams from slice S0-C (`test/fixtures/streams/*.jsonl`, read in place from the `s0-bench` worktree, not copied).

## Environment

| | |
|---|---|
| Machine | Apple M5 Pro, 15 cores, 48 GiB, macOS 27.0.1 |
| Browser | Chrome 155.0.8059.40 headless, new headless, rAF at 60 Hz, one fresh browser context per run (cold start) |
| Build type | React 19.1.0 **production**, react-native-web, esbuild minified (`--dev` not used); probes enabled (`debugPerf`) |
| Harness | `npm run replay` (`.showcase/replay.tsx`), host simulator, `flushSync` per event |
| Heap | `performance.memory.usedJSHeapSize` after `gc()` (Chrome `--expose-gc --enable-precise-memory-info`) |
| Runs | 3 per fixture x host mode; every cell is the **median of 3**; raw runs in `docs/bench/raw/` (0.6 MB, all kept) |
| Host Paseo version modelled | 0.11.2 |

Speeds used: speed 1 (recorded timing) for all fixtures except `history-100` at max speed (speed 0: events fire back to back) and `tool-expanded-streaming` at speed 4 (61 s of recording replayed in ~15 s).

Host modes (cells read `current / cached`):
- `current`: like Paseo 0.11.2. Every event re-renders every row; each row gets a fresh `theme` object and a fresh `safeParse` result, so no plugin memo can hold.
- `cached`: theme and parse result cached, rows memoised on them. This is the shape after planned host fix H4 plus semantic memo in the plugin; the plugin itself is unchanged, so it shows the ceiling for host-side caching alone.

Commands:

```
node .showcase/tools/replay.mjs --fixtures <streams dir> --host <current|cached> --runs 3 --speed 1 \
  --speeds history-100=0,tool-expanded-streaming=4 --out <dir>
node .showcase/tools/baseline-report.mjs <dir>
```

## How to read the numbers

- All counters cover the whole run: the stream, the end-of-stream flip to `phase: complete`, and 600 ms of settling. Idle numbers are a separate 1.5 s window afterwards.
- "Non-active row renders": host-driven renders of a row whose data object was unchanged since its previous render (wasted work; the row was not the one the event touched). "Active" renders are renders of a row whose data did change. The per-kind totals in the first columns are the plugin probe's own render counts (they also include renders from internal state, e.g. highlight arriving).
- Commit time is measured from the start of a card's render to its layout effect. The "busiest kind" table uses the kind with the most commits; the last table gives every kind.
- Items are keyed by callId (tool) or a hash of the first 80 characters (reasoning, assistant).
- `history-100` in `current` mode is a **worst case**: it makes all 110 turns "live", whereas the real host keeps finished rows behind `React.memo`. Read it as "what a long live head costs", not as the cost of opening a long chat.
- Dropped-frame ratio and longest frame come from a rAF meter. At speed 0 (`history-100`) frames are starved by design, so compare its two host modes, not its absolute ratio.
- Layout shift is Chrome's `layout-shift` entries in the harness page; the same value in both modes means it comes from card layout, not host re-renders.
- Height decreases "of which streaming": counted only when the card knows its phase (tool and reasoning cards). The assistant card has no phase in its data, so its decreases are in the total but never in the streaming column.
- Not measured: iOS/Android, real Paseo app build (including its real `useRevealedText` reveal and its own row chrome), memory on devices. The harness does not simulate the host's reasoning reveal animation.

Cells read `current / cached` (host mode), each a median of 3 runs.

### Render counts (whole run: stream + completion + 600 ms settle)

| fixture | speed | events | rows | user_message | assistant | reasoning | tool_call | todo | non-active row renders | active row renders |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| codeblock-streaming | 1 | 989 | 2 | 990 / 1 | 990 / 990 | 0 / 0 | 0 / 0 | 0 / 0 | 988 / 0 | 989 / 989 |
| diff-large | 1 | 10 | 4 | 11 / 1 | 18 / 12 | 0 / 0 | 8 / 3 | 0 / 0 | 18 / 0 | 11 / 11 |
| history-100 | 0 | 781 | 440 | 43831 / 110 | 43536 / 596 | 21726 / 129 | 63234 / 438 | 0 / 0 | 170640 / 0 | 945 / 945 |
| markdown-long | 1 | 510 | 2 | 511 / 1 | 511 / 511 | 0 / 0 | 0 / 0 | 0 / 0 | 509 / 0 | 510 / 510 |
| mixed-turn | 1 | 59 | 16 | 60 / 1 | 114 / 33 | 131 / 20 | 260 / 21 | 70 / 2 | 543 / 0 | 64 / 64 |
| reads-20 | 1 | 65 | 28 | 66 / 1 | 76 / 18 | 65 / 4 | 912 / 71 | 0 / 0 | 999 / 0 | 67 / 67 |
| reasoning-long-prose | 1 | 197 | 3 | 198 / 1 | 9 / 9 | 197 / 190 | 0 / 0 | 0 / 0 | 202 / 0 | 198 / 198 |
| reasoning-long-sections | 1 | 169 | 3 | 170 / 1 | 4 / 4 | 169 / 167 | 0 / 0 | 0 / 0 | 169 / 0 | 170 / 170 |
| shell-log-large | 1 | 10 | 4 | 11 / 1 | 18 / 12 | 0 / 0 | 8 / 3 | 0 / 0 | 18 / 0 | 11 / 11 |
| table-streaming | 1 | 176 | 2 | 177 / 1 | 177 / 177 | 0 / 0 | 0 / 0 | 0 / 0 | 175 / 0 | 176 / 176 |
| tool-expanded-streaming | 4 | 101 | 4 | 102 / 1 | 107 / 9 | 0 / 0 | 100 / 97 | 0 / 0 | 199 / 0 | 102 / 102 |

### Commit time and stream wall time (ms)

| fixture | busiest kind | commit p50 | commit p95 | commit max | stream ms | harness transform ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| codeblock-streaming | assistant | 1.40 / 1.10 | 2.60 / 1.80 | 4.70 / 6.30 | 15354 / 15354 | 5.5 / 5.7 |
| diff-large | assistant | 17.80 / 1 | 174 / 11.90 | 174 / 11.90 | 2793 / 2274 | 0.3 / 0.6 |
| history-100 | tool_call | 19.40 / 1.20 | 46.70 / 4 | 464.40 / 11.60 | 115299 / 17886 | 7.8 / 9.0 |
| markdown-long | assistant | 4.60 / 4.70 | 8.20 / 9.50 | 9.80 / 11.50 | 38485 / 38486 | 4.0 / 6.2 |
| mixed-turn | tool_call | 3.10 / 0.60 | 6 / 2.80 | 8.10 / 3 | 11619 / 11611 | 1 / 0.8 |
| reads-20 | tool_call | 24.80 / 2.30 | 52.90 / 5.40 | 66.80 / 7.70 | 6184 / 6117 | 0.7 / 1 |
| reasoning-long-prose | reasoning | 1.70 / 0.70 | 2.80 / 1 | 7.50 / 8.50 | 16176 / 16172 | 1.9 / 1.5 |
| reasoning-long-sections | reasoning | 2.50 / 1.20 | 4 / 1.90 | 7.20 / 8.40 | 13693 / 13690 | 1.5 / 1.2 |
| shell-log-large | assistant | 2.10 / 0.50 | 20.50 / 7.40 | 20.50 / 7.40 | 10393 / 10381 | 0.3 / 0.5 |
| table-streaming | assistant | 2 / 0.80 | 3.30 / 1.30 | 4 / 7.90 | 13464 / 13461 | 1.8 / 1.6 |
| tool-expanded-streaming | tool_call | 4.30 / 4 | 7 / 7.20 | 9.90 / 8.10 | 15353 / 15346 | 1.5 / 1.2 |

### Markdown, layout and RPC

| fixture | md parses | md parse total ms | block kind flips | height decreases | of which streaming | highlight RPC | anim peak | anim at end |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| codeblock-streaming | 988 / 988 | 19.50 / 21.60 | 10 / 10 | 5 / 6 | 0 / 0 | 6 / 6 | 0 / 0 | 0 / 0 |
| diff-large | 7 / 7 | 0.70 / 1 | 0 / 0 | 1 / 1 | 0 / 0 | 2 / 2 | 4 / 4 | 3 / 3 |
| history-100 | 267 / 267 | 7.50 / 10.50 | 25 / 25 | 109 / 109 | 0 / 0 | 184 / 184 | 415 / 415 | 414 / 414 |
| markdown-long | 509 / 509 | 148.40 / 140.70 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| mixed-turn | 25 / 25 | 1.90 / 1.70 | 0 / 0 | 2 / 2 | 0 / 0 | 8 / 8 | 22 / 22 | 21 / 21 |
| reads-20 | 13 / 13 | 0.70 / 0.90 | 0 / 0 | 1 / 1 | 0 / 0 | 48 / 48 | 76 / 76 | 72 / 72 |
| reasoning-long-prose | 7 / 7 | 0.70 / 0.60 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 3 / 3 | 0 / 0 |
| reasoning-long-sections | 2 / 2 | 0.50 / 0.30 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 3 / 3 | 0 / 0 |
| shell-log-large | 7 / 7 | 0.50 / 0.70 | 0 / 0 | 1 / 1 | 0 / 0 | 0 / 0 | 3 / 3 | 2 / 2 |
| table-streaming | 175 / 175 | 10.50 / 8.90 | 6 / 6 | 3 / 3 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| tool-expanded-streaming | 4 / 4 | 0.40 / 0.60 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 3 / 3 | 2 / 2 |

### Frames, long tasks, layout shift, heap

| fixture | dropped-frame ratio | longest frame ms | long tasks | layout shift | heap before MB | heap after MB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| codeblock-streaming | 0 / 0 | 17 / 17 | 0 / 0 | 0.0470 / 0.0470 | 9.3 / 9.3 | 13.7 / 13.2 |
| diff-large | 0.319 / 0.313 | 700 / 650 | 4 / 4 | 0.0060 / 0.0060 | 9.4 / 8.8 | 109.0 / 105.8 |
| history-100 | 0.793 / 0.196 | 733 / 50 | 638 / 0 | 0.0310 / 0.0040 | 9.5 / 9.5 | 123.3 / 102.8 |
| markdown-long | 0 / 0 | 17 / 33 | 0 / 0 | 0.0390 / 0.0390 | 9.2 / 8.7 | 16.2 / 15.9 |
| mixed-turn | 0 / 0 | 17 / 17 | 0 / 0 | 0.0220 / 0.0220 | 9.2 / 9.2 | 17.7 / 16.7 |
| reads-20 | 0.250 / 0 | 483 / 17 | 12 / 0 | 0.3310 / 0.3310 | 9.3 / 9.3 | 72.3 / 68.7 |
| reasoning-long-prose | 0 / 0 | 17 / 17 | 0 / 0 | 0.0350 / 0.0350 | 9.2 / 9.2 | 12.3 / 11.8 |
| reasoning-long-sections | 0 / 0 | 17 / 17 | 0 / 0 | 0.0340 / 0.0340 | 9.2 / 9.2 | 13.7 / 13.0 |
| shell-log-large | 0 / 0.002 | 17 / 33 | 0 / 0 | 0.0030 / 0.0030 | 9.2 / 9.2 | 23.2 / 17.8 |
| table-streaming | 0 / 0 | 17 / 17 | 0 / 0 | 0.0510 / 0.0510 | 9.2 / 9.2 | 11.8 / 11.5 |
| tool-expanded-streaming | 0 / 0 | 17 / 17 | 0 / 0 | 0.0030 / 0.0030 | 10.9 / 10.9 | 20.6 / 20.4 |

### Idle window after settle (1.5 s, nothing streaming)

| fixture | animations mounted | frames | long tasks |
| --- | ---: | ---: | ---: |
| codeblock-streaming | 0 / 0 | 90 / 90 | 0 / 0 |
| diff-large | 3 / 3 | 90 / 91 | 0 / 0 |
| history-100 | 414 / 414 | 90 / 74 | 0 / 0 |
| markdown-long | 0 / 0 | 90 / 90 | 0 / 0 |
| mixed-turn | 21 / 21 | 90 / 90 | 0 / 0 |
| reads-20 | 72 / 72 | 90 / 90 | 0 / 0 |
| reasoning-long-prose | 0 / 0 | 90 / 90 | 0 / 0 |
| reasoning-long-sections | 0 / 0 | 90 / 90 | 0 / 0 |
| shell-log-large | 2 / 2 | 90 / 90 | 0 / 0 |
| table-streaming | 0 / 0 | 90 / 90 | 0 / 0 |
| tool-expanded-streaming | 2 / 2 | 90 / 90 | 0 / 0 |

### Commit time per kind, p50 / p95 ms

| fixture | host | user_message | assistant | reasoning | tool_call | todo |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| codeblock-streaming | current | 1.40 / 2.60 | 1.10 / 2.30 | - | - | - |
| codeblock-streaming | cached | 3.60 / 3.60 | 1.10 / 1.80 | - | - | - |
| diff-large | current | 114.70 / 174.30 | 17.80 / 174 | - | 115 / 173.80 | - |
| diff-large | cached | 5.90 / 5.90 | 1 / 11.90 | - | 9.80 / 439 | - |
| history-100 | current | 23.10 / 51.80 | 22.50 / 50.90 | 35.50 / 76.20 | 19.40 / 46.70 | - |
| history-100 | cached | 1.20 / 4.10 | 1.20 / 4 | 2.60 / 6.50 | 2.80 / 5.80 | - |
| markdown-long | current | 4.60 / 8.20 | 4.10 / 7.70 | - | - | - |
| markdown-long | cached | 7.20 / 7.20 | 4.70 / 9.50 | - | - | - |
| mixed-turn | current | 6.30 / 9.40 | 3.30 / 7.50 | 3.40 / 8.10 | 3.10 / 6 | 4.90 / 7.70 |
| mixed-turn | cached | 4.10 / 4.10 | 0.60 / 2.80 | 1 / 3.40 | 1.70 / 4 | 1.10 / 1.90 |
| reads-20 | current | 30.50 / 60.10 | 23.90 / 59.30 | 32.10 / 59.60 | 24.80 / 52.90 | - |
| reads-20 | cached | 3.90 / 3.90 | 0.50 / 5.10 | 1 / 9.50 | 2.30 / 5.40 | - |
| reasoning-long-prose | current | 1.70 / 2.80 | 1.20 / 2.80 | 1.20 / 2.40 | - | - |
| reasoning-long-prose | cached | 3.40 / 3.40 | 0.40 / 2 | 0.70 / 1 | - | - |
| reasoning-long-sections | current | 2.50 / 4 | 0.70 / 2.90 | 2 / 3.40 | - | - |
| reasoning-long-sections | cached | 3.60 / 3.60 | 0.60 / 2.30 | 1.20 / 1.90 | - | - |
| shell-log-large | current | 10.20 / 21.20 | 2.10 / 20.50 | - | 11.20 / 20 | - |
| shell-log-large | cached | 4.20 / 4.20 | 0.50 / 7.40 | - | 3.30 / 21.40 | - |
| table-streaming | current | 2 / 3.30 | 1.60 / 2.70 | - | - | - |
| table-streaming | cached | 3.90 / 3.90 | 0.80 / 1.30 | - | - | - |
| tool-expanded-streaming | current | 4.70 / 7.40 | 4.30 / 7 | - | 4.10 / 6.80 | - |
| tool-expanded-streaming | cached | 4.40 / 4.40 | 0.70 / 7.60 | - | 4 / 7.20 | - |

Runs with page or console errors: none.

## Top findings

1. **Every chunk re-renders every card in the turn (current host).** Non-active row renders equal roughly `events x rows` and all go to zero with host caching: `codeblock-streaming` 988 -> 0, `mixed-turn` 543 -> 0, `reads-20` 999 -> 0, `history-100` 170,640 -> 0. The user prompt re-renders once per chunk (990 renders for 989 events) even though it never changes. Fixing identity (H4 plus plugin memo) removes this class entirely.
2. **Many-card scenarios are dominated by that fan-out, not by Markdown.** `reads-20` commit p50 24.8 ms / p95 52.9 ms on tool cards (current) vs 2.3 / 5.4 cached, with 12 long tasks and 25% dropped frames vs 0. `history-100` as a live head: 638 long tasks, 79% dropped frames, 115 s wall time vs 0 / 20% / 18 s cached.
3. **Single-long-text scenarios are limited by parse cost, not fan-out.** `markdown-long` (509 full re-parses, 148 ms total, commit p95 8 ms) and `codeblock-streaming` (988 parses) look the same in both host modes: with only 2 rows there is nothing to cache. The whole-message re-parse per chunk is the cost to attack in BC-05; at 23 KiB it is still under budget (p95 8.2 ms vs a 4 ms target).
4. **Format flips and re-highlighting come from open constructs.** `codeblock-streaming` flips 10 block kinds (unclosed fence drawn as plain text, then as code) and requests highlight 6 times (one per closed block, so the per-block RPC count is already 1 there); `table-streaming` flips 6 (header alone, then a table); `history-100` 25. Height decreases are small in count (0-6 per fixture, 109 in `history-100`) but none of them is attributed to streaming for lack of a phase on assistant cards.
5. **Looping animations are not released when work ends.** `reads-20` ends with 72 mounted loops, `mixed-turn` 21, `history-100` 414, `diff-large` 3, `shell-log-large` and `tool-expanded-streaming` 2 each, with nothing running. Target for BC-09: 0 at idle (reasoning-only and Markdown-only fixtures already end at 0).
6. **Huge tool bodies are a mount cost.** `diff-large` (5128-line diff): 4 long tasks in both modes, 700 ms longest frame, tool-card commit up to 439 ms (cached) / 174 ms p95 (current), heap 109 MB vs 9 MB before. `shell-log-large` allocates 23 MB / 18 MB. These are not helped by host caching; BC-07's "render 400 lines then expand" targets them.
7. **Reasoning scenarios are cheap in the harness.** Both reasoning fixtures stay under 4 ms commit p95 even in `current` mode; the 3-row fixtures leave little to fan out. Caveat: the host's own reveal animation is not simulated.
8. **Idle frame cost is invisible here.** Idle windows show no long tasks in any fixture (the 3-72 loops use rAF at 60 fps in headless Chrome); whether those loops cost power or frames on devices is not measured.

Targets from plan §3.2 vs this baseline (`current`): non-active renders per chunk 0 (now ~rows-1), commit p95 <= 4 ms (exceeded on reads-20, history-100, diff-large, shell-log-large, mixed-turn tool cards), flips 0 (10/6/25 on three fixtures), long tasks 0 (4 / 12 / 638 on three fixtures), dropped frames < 5% (25% reads-20, 32% diff-large, 79% history-100).
