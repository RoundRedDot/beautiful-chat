# Final verification (V1)

Plugin: `main` at `81ce36b` (all slices S0-S5 merged). Baselines: `baseline-showcase.md` (offline) and `baseline-host.md` (iOS simulator and web production build), taken on the pre-upgrade UI (`42b61d8` plus inert probes). Nothing in the plugin was changed for this report; defects are reported, not fixed.

Later fixes (per-frame reveal off on web, a held-back closing fence, the settings-sync memo, and the 400-line cap) are summarised in [`docs/fork-vs-upstream.md`](../fork-vs-upstream.md). The tables below are this V1 run.

## 1. Environment and method

| | |
|---|---|
| Machine | Apple M5 Pro, macOS 27.0.1 |
| Offline replay | `npm run replay`, production React, headless Chrome 155.0.8059.40, **3 runs per cell, medians**, `--host current` and `--host cached`, speed 1 except `history-100` max (speed 0) and `tool-expanded-streaming` 4 (same as the baseline) |
| iOS | iPhone 16 Pro simulator `CE6149D8-...` (iOS 18.6), Paseo 0.11.2 **dev build** via Metro, plugin installed as `bc-final` from the worktree (= `main` 81ce36b), probes via `/bc-perf`, **1 run per fixture**, same speeds |
| Desktop proxy | Paseo 0.11.2 **production web build** (`/tmp/bc-web-dist`) in headless Chrome 155.0.8059.40, bench daemon `127.0.0.1:6868`, `ws://localhost:6767` blocked, **1 run per fixture**, same speeds |
| Raw data | `raw-final/` (offline, 66 runs), `raw-host-final/` (iOS + web dumps), `raw-ab/` (iOS A/B runs), `raw-v1/` (screenshots and walk-through JSON) |
| Tooling | `docs/bench/tools/final-report.mjs` (tables below), `web-walk-*.mjs` (web checks) |

How to read: every cell is `before -> after`. "Before" is the original baseline run (different day/session), so **cross-session iOS deltas carry about 2x noise** (the paired A/B in section 4 shows the same build varying 16-23 ms p50 between sessions). Non-active renders are only measurable offline (the host-row spy); on the real hosts the user-prompt card, which never changes, is the proxy. Heap and long tasks exist only on web/offline (React Native has neither); `n/m` means not measured, and for web long tasks `n/m` in the after column means the observer saw none.

## 2. Before / after tables

### 2.1 Offline replay, host mode `current` (like Paseo 0.11.2: every row re-rendered with fresh theme and data)

Cells read `before -> after` (offline replay, host mode current, median of 3).

##### Render counts (plugin probe, whole run)

| fixture | events | user_message | assistant | reasoning | tool_call | todo | total | non-active host-driven row renders | plugin renders beyond host-active updates |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| codeblock-streaming | 989 | 990 -> 1 | 990 -> 990 | 0 -> 0 | 0 -> 0 | 0 -> 0 | 1980 -> 991 | 988 -> 988 | 991 -> 2 |
| diff-large | 10 | 11 -> 1 | 18 -> 12 | 0 -> 0 | 8 -> 3 | 0 -> 0 | 37 -> 16 | 18 -> 18 | 26 -> 5 |
| history-100 | 781 | 43831 -> 110 | 43536 -> 596 | 21726 -> 129 | 63234 -> 484 | 0 -> 0 | 172327 -> 1319 | 170640 -> 170640 | 171382 -> 374 |
| markdown-long | 510 | 511 -> 1 | 511 -> 511 | 0 -> 0 | 0 -> 0 | 0 -> 0 | 1022 -> 512 | 509 -> 509 | 512 -> 2 |
| mixed-turn | 59 | 60 -> 1 | 114 -> 33 | 131 -> 20 | 260 -> 23 | 70 -> 2 | 635 -> 79 | 543 -> 543 | 571 -> 15 |
| reads-20 | 65 | 66 -> 1 | 76 -> 18 | 65 -> 4 | 912 -> 121 | 0 -> 0 | 1119 -> 144 | 999 -> 999 | 1052 -> 77 |
| reasoning-long-prose | 197 | 198 -> 1 | 9 -> 9 | 197 -> 190 | 0 -> 0 | 0 -> 0 | 404 -> 200 | 202 -> 202 | 206 -> 2 |
| reasoning-long-sections | 169 | 170 -> 1 | 4 -> 4 | 169 -> 167 | 0 -> 0 | 0 -> 0 | 343 -> 172 | 169 -> 169 | 173 -> 2 |
| shell-log-large | 10 | 11 -> 1 | 18 -> 12 | 0 -> 0 | 8 -> 3 | 0 -> 0 | 37 -> 16 | 18 -> 18 | 26 -> 5 |
| table-streaming | 176 | 177 -> 1 | 177 -> 177 | 0 -> 0 | 0 -> 0 | 0 -> 0 | 354 -> 178 | 175 -> 175 | 178 -> 2 |
| tool-expanded-streaming | 101 | 102 -> 1 | 107 -> 9 | 0 -> 0 | 100 -> 97 | 0 -> 0 | 309 -> 107 | 199 -> 199 | 207 -> 5 |

##### Commit time of the busiest card kind (ms)

| fixture | kind (before / after) | p50 | p95 | max |
| --- | ---: | ---: | ---: | ---: |
| codeblock-streaming | user_message / assistant | 1.4 -> 0.8 | 2.6 -> 1.1 | 4.7 -> 8.2 |
| diff-large | assistant / assistant | 17.8 -> 0.8 | 174 -> 8 | 174 -> 8 |
| history-100 | tool_call / assistant | 19.4 -> 0.8 | 46.7 -> 1.5 | 464.4 -> 6.5 |
| markdown-long | user_message / assistant | 4.6 -> 0.5 | 8.2 -> 0.8 | 9.8 -> 5.1 |
| mixed-turn | tool_call / assistant | 3.1 -> 0.6 | 6 -> 2.3 | 8.1 -> 5.3 |
| reads-20 | tool_call / tool_call | 24.8 -> 0.5 | 52.9 -> 1 | 66.8 -> 1.6 |
| reasoning-long-prose | user_message / reasoning | 1.7 -> 0.3 | 2.8 -> 0.5 | 7.5 -> 3 |
| reasoning-long-sections | user_message / reasoning | 2.5 -> 0.3 | 4 -> 0.5 | 7.2 -> 4.5 |
| shell-log-large | assistant / assistant | 2.1 -> 0.8 | 20.5 -> 7.5 | 20.5 -> 7.5 |
| table-streaming | user_message / assistant | 2 -> 0.8 | 3.3 -> 1.3 | 4 -> 9 |
| tool-expanded-streaming | assistant / tool_call | 4.3 -> 0.4 | 7 -> 0.7 | 9.9 -> 2.9 |

##### Markdown, layout, RPC, loops

| fixture | md parses | md parse ms | format flips | height decreases (streaming) | highlight RPC | loops at end | loops peak | md.finalRerender |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| codeblock-streaming | 988 -> 989 | 19.5 -> 90.6 | 10 -> 0 | 5 -> 6 (0 -> 6) | 6 -> 6 | 0 -> 0 | 0 -> 0 | n/m -> 0 |
| diff-large | 7 -> 9 | 0.7 -> 2.7 | 0 -> 0 | 1 -> 1 (0 -> 0) | 2 -> 0 | 3 -> 0 | 4 -> 1 | n/m -> 0 |
| history-100 | 267 -> 377 | 7.5 -> 36.8 | 25 -> 0 | 109 -> 104 (0 -> 0) | 184 -> 25 | 414 -> 0 | 415 -> 1 | n/m -> 0 |
| markdown-long | 509 -> 510 | 148.4 -> 82.6 | 0 -> 0 | 0 -> 0 (0 -> 0) | 0 -> 0 | 0 -> 0 | 0 -> 0 | n/m -> 0 |
| mixed-turn | 25 -> 28 | 1.9 -> 4.8 | 0 -> 0 | 2 -> 2 (0 -> 0) | 8 -> 0 | 21 -> 1 | 22 -> 3 | n/m -> 0 |
| reads-20 | 13 -> 15 | 0.7 -> 3.1 | 0 -> 0 | 1 -> 1 (0 -> 0) | 48 -> 0 | 72 -> 0 | 76 -> 4 | n/m -> 0 |
| reasoning-long-prose | 7 -> 8 | 0.7 -> 2.6 | 0 -> 0 | 0 -> 0 (0 -> 0) | 0 -> 0 | 0 -> 0 | 3 -> 1 | n/m -> 0 |
| reasoning-long-sections | 2 -> 3 | 0.5 -> 1.6 | 0 -> 0 | 0 -> 0 (0 -> 0) | 0 -> 0 | 0 -> 0 | 3 -> 1 | n/m -> 0 |
| shell-log-large | 7 -> 9 | 0.5 -> 2.2 | 0 -> 0 | 1 -> 1 (0 -> 0) | 0 -> 0 | 2 -> 0 | 3 -> 1 | n/m -> 0 |
| table-streaming | 175 -> 176 | 10.5 -> 31.9 | 6 -> 0 | 3 -> 0 (0 -> 0) | 0 -> 0 | 0 -> 0 | 0 -> 0 | n/m -> 0 |
| tool-expanded-streaming | 4 -> 6 | 0.4 -> 1.9 | 0 -> 0 | 0 -> 0 (0 -> 0) | 0 -> 0 | 2 -> 0 | 3 -> 1 | n/m -> 0 |

##### Frames, long tasks, layout shift, heap

| fixture | dropped ratio | longest frame ms | long tasks | layout shift | JS heap MB |
| --- | ---: | ---: | ---: | ---: | ---: |
| codeblock-streaming | 0 -> 0 | 17 -> 17 | n/m -> 1 | 0.047 -> 0.034 | 13.7 -> 14.5 |
| diff-large | 0.319 -> 0 | 700 -> 17 | 4 -> n/m | 0.006 -> 0 | 109.0 -> 11.6 |
| history-100 | 0.793 -> 0 | 733 -> 17 | 638 -> n/m | 0.031 -> 0.006 | 123.3 -> 45.8 |
| markdown-long | 0 -> 0 | 17 -> 17 | n/m -> n/m | 0.039 -> 0.033 | 16.2 -> 17.1 |
| mixed-turn | 0 -> 0 | 17 -> 17 | n/m -> n/m | 0.022 -> 0.004 | 17.7 -> 13.4 |
| reads-20 | 0.250 -> 0 | 483 -> 17 | 12 -> n/m | 0.331 -> 0 | 72.3 -> 14.6 |
| reasoning-long-prose | 0 -> 0 | 17 -> 17 | n/m -> n/m | 0.035 -> 0.001 | 12.3 -> 11.6 |
| reasoning-long-sections | 0 -> 0 | 17 -> 17 | n/m -> n/m | 0.034 -> 0.001 | 13.7 -> 11.7 |
| shell-log-large | 0 -> 0 | 17 -> 17 | n/m -> n/m | 0.003 -> 0 | 23.2 -> 11.7 |
| table-streaming | 0 -> 0 | 17 -> 17 | n/m -> n/m | 0.051 -> 0.043 | 11.8 -> 13.0 |
| tool-expanded-streaming | 0 -> 0 | 17 -> 17 | n/m -> n/m | 0.003 -> 0 | 20.6 -> 13.6 |


### 2.2 Offline replay, host mode `cached` (host caches theme and parse result)

Cells read `before -> after` (offline replay, host mode cached, median of 3).

##### Render counts (plugin probe, whole run)

| fixture | events | user_message | assistant | reasoning | tool_call | todo | total | non-active host-driven row renders | plugin renders beyond host-active updates |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| codeblock-streaming | 989 | 1 -> 1 | 990 -> 990 | 0 -> 0 | 0 -> 0 | 0 -> 0 | 991 -> 991 | 0 -> 0 | 2 -> 2 |
| diff-large | 10 | 1 -> 1 | 12 -> 12 | 0 -> 0 | 3 -> 3 | 0 -> 0 | 16 -> 16 | 0 -> 0 | 5 -> 5 |
| history-100 | 781 | 110 -> 110 | 596 -> 596 | 129 -> 129 | 438 -> 472 | 0 -> 0 | 1273 -> 1307 | 0 -> 0 | 328 -> 362 |
| markdown-long | 510 | 1 -> 1 | 511 -> 511 | 0 -> 0 | 0 -> 0 | 0 -> 0 | 512 -> 512 | 0 -> 0 | 2 -> 2 |
| mixed-turn | 59 | 1 -> 1 | 33 -> 33 | 20 -> 20 | 21 -> 21 | 2 -> 2 | 77 -> 77 | 0 -> 0 | 13 -> 13 |
| reads-20 | 65 | 1 -> 1 | 18 -> 18 | 4 -> 4 | 71 -> 71 | 0 -> 0 | 94 -> 94 | 0 -> 0 | 27 -> 27 |
| reasoning-long-prose | 197 | 1 -> 1 | 9 -> 9 | 190 -> 190 | 0 -> 0 | 0 -> 0 | 200 -> 200 | 0 -> 0 | 2 -> 2 |
| reasoning-long-sections | 169 | 1 -> 1 | 4 -> 4 | 167 -> 167 | 0 -> 0 | 0 -> 0 | 172 -> 172 | 0 -> 0 | 2 -> 2 |
| shell-log-large | 10 | 1 -> 1 | 12 -> 12 | 0 -> 0 | 3 -> 3 | 0 -> 0 | 16 -> 16 | 0 -> 0 | 5 -> 5 |
| table-streaming | 176 | 1 -> 1 | 177 -> 177 | 0 -> 0 | 0 -> 0 | 0 -> 0 | 178 -> 178 | 0 -> 0 | 2 -> 2 |
| tool-expanded-streaming | 101 | 1 -> 1 | 9 -> 9 | 0 -> 0 | 97 -> 97 | 0 -> 0 | 107 -> 107 | 0 -> 0 | 5 -> 5 |

##### Commit time of the busiest card kind (ms)

| fixture | kind (before / after) | p50 | p95 | max |
| --- | ---: | ---: | ---: | ---: |
| codeblock-streaming | assistant / assistant | 1.1 -> 0.8 | 1.8 -> 1.2 | 6.3 -> 8.2 |
| diff-large | assistant / assistant | 1 -> 0.7 | 11.9 -> 7.4 | 11.9 -> 7.4 |
| history-100 | assistant / assistant | 1.2 -> 0.7 | 4 -> 1.4 | 11.6 -> 7.8 |
| markdown-long | assistant / assistant | 4.7 -> 0.7 | 9.5 -> 1 | 11.5 -> 7.6 |
| mixed-turn | assistant / assistant | 0.6 -> 0.7 | 2.8 -> 3.2 | 3 -> 7.5 |
| reads-20 | tool_call / tool_call | 2.3 -> 0.6 | 5.4 -> 1 | 7.7 -> 2.2 |
| reasoning-long-prose | reasoning / reasoning | 0.7 -> 0.3 | 1 -> 0.5 | 8.5 -> 4.1 |
| reasoning-long-sections | reasoning / reasoning | 1.2 -> 0.3 | 1.9 -> 0.5 | 8.4 -> 3.7 |
| shell-log-large | assistant / assistant | 0.5 -> 0.6 | 7.4 -> 6.5 | 7.4 -> 6.5 |
| table-streaming | assistant / assistant | 0.8 -> 0.8 | 1.3 -> 1.2 | 7.9 -> 7.2 |
| tool-expanded-streaming | tool_call / tool_call | 4 -> 0.3 | 7.2 -> 0.6 | 8.1 -> 2.8 |

##### Markdown, layout, RPC, loops

| fixture | md parses | md parse ms | format flips | height decreases (streaming) | highlight RPC | loops at end | loops peak | md.finalRerender |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| codeblock-streaming | 988 -> 989 | 21.6 -> 98.2 | 10 -> 0 | 6 -> 6 (0 -> 6) | 6 -> 6 | 0 -> 0 | 0 -> 0 | n/m -> 0 |
| diff-large | 7 -> 9 | 1 -> 2.4 | 0 -> 0 | 1 -> 1 (0 -> 0) | 2 -> 0 | 3 -> 0 | 4 -> 1 | n/m -> 0 |
| history-100 | 267 -> 377 | 10.5 -> 34.3 | 25 -> 0 | 109 -> 105 (0 -> 0) | 184 -> 25 | 414 -> 0 | 415 -> 1 | n/m -> 0 |
| markdown-long | 509 -> 510 | 140.7 -> 98 | 0 -> 0 | 0 -> 0 (0 -> 0) | 0 -> 0 | 0 -> 0 | 0 -> 0 | n/m -> 0 |
| mixed-turn | 25 -> 28 | 1.7 -> 5.6 | 0 -> 0 | 2 -> 2 (0 -> 0) | 8 -> 0 | 21 -> 1 | 22 -> 3 | n/m -> 0 |
| reads-20 | 13 -> 15 | 0.9 -> 3.7 | 0 -> 0 | 1 -> 1 (0 -> 0) | 48 -> 0 | 72 -> 0 | 76 -> 4 | n/m -> 0 |
| reasoning-long-prose | 7 -> 8 | 0.6 -> 2.5 | 0 -> 0 | 0 -> 0 (0 -> 0) | 0 -> 0 | 0 -> 0 | 3 -> 1 | n/m -> 0 |
| reasoning-long-sections | 2 -> 3 | 0.3 -> 1.3 | 0 -> 0 | 0 -> 0 (0 -> 0) | 0 -> 0 | 0 -> 0 | 3 -> 1 | n/m -> 0 |
| shell-log-large | 7 -> 9 | 0.7 -> 1.8 | 0 -> 0 | 1 -> 1 (0 -> 0) | 0 -> 0 | 2 -> 0 | 3 -> 1 | n/m -> 0 |
| table-streaming | 175 -> 176 | 8.9 -> 29.8 | 6 -> 0 | 3 -> 0 (0 -> 0) | 0 -> 0 | 0 -> 0 | 0 -> 0 | n/m -> 0 |
| tool-expanded-streaming | 4 -> 6 | 0.6 -> 1.7 | 0 -> 0 | 0 -> 0 (0 -> 0) | 0 -> 0 | 2 -> 0 | 3 -> 1 | n/m -> 0 |

##### Frames, long tasks, layout shift, heap

| fixture | dropped ratio | longest frame ms | long tasks | layout shift | JS heap MB |
| --- | ---: | ---: | ---: | ---: | ---: |
| codeblock-streaming | 0 -> 0 | 17 -> 17 | n/m -> n/m | 0.047 -> 0.034 | 13.2 -> 14.5 |
| diff-large | 0.313 -> 0 | 650 -> 17 | 4 -> n/m | 0.006 -> 0 | 105.8 -> 11.6 |
| history-100 | 0.196 -> 0 | 50 -> 17 | 5 -> n/m | 0.004 -> 0.009 | 102.8 -> 45.6 |
| markdown-long | 0 -> 0 | 33 -> 17 | 1 -> n/m | 0.039 -> 0.033 | 15.9 -> 17.1 |
| mixed-turn | 0 -> 0 | 17 -> 17 | n/m -> n/m | 0.022 -> 0.004 | 16.7 -> 13.4 |
| reads-20 | 0 -> 0 | 17 -> 17 | n/m -> n/m | 0.331 -> 0 | 68.7 -> 14.5 |
| reasoning-long-prose | 0 -> 0 | 17 -> 17 | n/m -> n/m | 0.035 -> 0.001 | 11.8 -> 11.6 |
| reasoning-long-sections | 0 -> 0 | 17 -> 17 | n/m -> n/m | 0.034 -> 0.001 | 13.0 -> 11.7 |
| shell-log-large | 0.002 -> 0 | 33 -> 17 | n/m -> n/m | 0.003 -> 0 | 17.8 -> 11.7 |
| table-streaming | 0 -> 0 | 17 -> 17 | n/m -> n/m | 0.051 -> 0.043 | 11.5 -> 13.0 |
| tool-expanded-streaming | 0 -> 0 | 17 -> 17 | n/m -> n/m | 0.003 -> 0 | 20.4 -> 13.6 |


### 2.3 iOS Simulator, dev build (relative comparison only, 1 run)

Cells read `before -> after` (ios, 1 run).

##### Render counts (plugin probe, whole run)

| fixture | events | user_message | assistant | reasoning | tool_call | todo | total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| codeblock-streaming | n/m | 7 -> 4 | 410 -> 337 | 0 -> 0 | 0 -> 0 | 0 -> 0 | 417 -> 341 |
| diff-large | n/m | 16 -> 4 | 11 -> 12 | 0 -> 0 | 4 -> 3 | 0 -> 0 | 31 -> 19 |
| history-100 | n/m | 123 -> 123 | 13 -> 14 | 4 -> 4 | 19 -> 19 | 0 -> 0 | 159 -> 160 |
| markdown-long | n/m | 7 -> 4 | 672 -> 701 | 0 -> 0 | 0 -> 0 | 0 -> 0 | 679 -> 705 |
| mixed-turn | n/m | 4 -> 4 | 48 -> 42 | 33 -> 28 | 36 -> 20 | 9 -> 4 | 130 -> 98 |
| reads-20 | n/m | 4 -> 4 | 30 -> 21 | 7 -> 6 | 73 -> 63 | 0 -> 0 | 114 -> 94 |
| reasoning-long-prose | n/m | 8 -> 4 | 12 -> 11 | 299 -> 298 | 0 -> 0 | 0 -> 0 | 319 -> 313 |
| reasoning-long-sections | n/m | 8 -> 4 | 8 -> 5 | 265 -> 266 | 0 -> 0 | 0 -> 0 | 281 -> 275 |
| shell-log-large | n/m | 8 -> 4 | 14 -> 12 | 0 -> 0 | 4 -> 3 | 0 -> 0 | 26 -> 19 |
| table-streaming | n/m | 7 -> 4 | 238 -> 237 | 0 -> 0 | 0 -> 0 | 0 -> 0 | 245 -> 241 |
| tool-expanded-streaming | n/m | 7 -> 4 | 7 -> 6 | 0 -> 0 | 91 -> 96 | 0 -> 0 | 105 -> 106 |

##### Commit time of the busiest card kind (ms)

| fixture | kind (before / after) | p50 | p95 | max |
| --- | ---: | ---: | ---: | ---: |
| codeblock-streaming | assistant / assistant | 22.8 -> 30.2 | 39.7 -> 60.9 | 90.5 -> 180.7 |
| diff-large | user_message / assistant | 21.5 -> 15.1 | 837.8 -> 23.8 | 837.8 -> 23.8 |
| history-100 | user_message / user_message | 22.7 -> 29.7 | 51.9 -> 54.2 | 148.3 -> 134.5 |
| markdown-long | assistant / assistant | 35.5 -> 32.1 | 69.3 -> 59.0 | 149.4 -> 296.4 |
| mixed-turn | assistant / assistant | 11.7 -> 26.6 | 41.4 -> 51.0 | 90.5 -> 54.2 |
| reads-20 | tool_call / tool_call | 152.3 -> 33.3 | 446.8 -> 62.4 | 450.5 -> 81.3 |
| reasoning-long-prose | reasoning / reasoning | 13.4 -> 15.3 | 19.4 -> 27.0 | 27.5 -> 32.5 |
| reasoning-long-sections | reasoning / reasoning | 20.0 -> 18.2 | 27.8 -> 33.2 | 32.0 -> 39.1 |
| shell-log-large | assistant / assistant | 7.5 -> 18.2 | 234.4 -> 28.0 | 234.4 -> 28.0 |
| table-streaming | assistant / assistant | 12.9 -> 17.8 | 19.2 -> 24.1 | 34.8 -> 49.6 |
| tool-expanded-streaming | tool_call / tool_call | 95.3 -> 17.0 | 187.5 -> 23.5 | 197.9 -> 37.8 |

##### Markdown, layout, RPC, loops

| fixture | md parses | md parse ms | format flips | height decreases (streaming) | highlight RPC | loops at end | loops peak | md.finalRerender |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| codeblock-streaming | 203 -> 168 | 16.2 -> 41.5 | 0 -> 0 | 5 -> 1 (0 -> 0) | 6 -> 6 | 0 -> 0 | 0 -> 0 | n/m -> 0 |
| diff-large | 4 -> 6 | 0.1 -> 0.9 | 0 -> 0 | 1 -> 1 (0 -> 0) | 0 -> 0 | 3 -> 0 | 4 -> 1 | n/m -> 0 |
| history-100 | 10 -> 12 | 3.1 -> 3.6 | 3 -> 3 | 0 -> 0 (0 -> 0) | 1 -> 2 | 35 -> 0 | 40 -> 0 | n/m -> 0 |
| markdown-long | 334 -> 350 | 842.0 -> 267.9 | 0 -> 0 | 1 -> 0 (0 -> 0) | 0 -> 0 | 0 -> 0 | 0 -> 0 | n/m -> 0 |
| mixed-turn | 21 -> 20 | 1.7 -> 6.1 | 0 -> 0 | 14 -> 4 (0 -> 0) | 8 -> 0 | 13 -> 1 | 22 -> 3 | n/m -> 0 |
| reads-20 | 13 -> 10 | 0.7 -> 29.1 | 0 -> 0 | 9 -> 3 (0 -> 0) | 24 -> 0 | 33 -> 0 | 40 -> 3 | n/m -> 0 |
| reasoning-long-prose | 4 -> 5 | 0.1 -> 0.9 | 0 -> 0 | 1 -> 1 (0 -> 0) | 0 -> 0 | 0 -> 0 | 3 -> 1 | n/m -> 0 |
| reasoning-long-sections | 2 -> 2 | 0.1 -> 0.4 | 0 -> 0 | 1 -> 0 (0 -> 0) | 0 -> 0 | 0 -> 0 | 3 -> 1 | n/m -> 0 |
| shell-log-large | 5 -> 6 | 0.1 -> 0.9 | 0 -> 0 | 2 -> 2 (0 -> 0) | 0 -> 0 | 2 -> 0 | 3 -> 1 | n/m -> 0 |
| table-streaming | 117 -> 118 | 56.8 -> 71.7 | 0 -> 0 | 3 -> 0 (0 -> 0) | 0 -> 0 | 0 -> 0 | 0 -> 0 | n/m -> 0 |
| tool-expanded-streaming | 2 -> 3 | 0.0 -> 0.5 | 0 -> 0 | 0 -> 0 (0 -> 0) | 0 -> 0 | 2 -> 0 | 3 -> 1 | n/m -> 0 |

##### Frames, long tasks, layout shift, heap

| fixture | dropped ratio | longest frame ms | long tasks | layout shift | JS heap MB |
| --- | ---: | ---: | ---: | ---: | ---: |
| codeblock-streaming | 0.358 -> 0.436 | 249 -> 391 | n/m -> n/m | n/m -> n/m | n/m -> n/m |
| diff-large | 0.025 -> 0.066 | 159 -> 224 | n/m -> n/m | n/m -> n/m | n/m -> n/m |
| history-100 | 0.126 -> 0.141 | 418 -> 374 | n/m -> n/m | n/m -> n/m | n/m -> n/m |
| markdown-long | 0.482 -> 0.514 | 340 -> 422 | n/m -> n/m | n/m -> n/m | n/m -> n/m |
| mixed-turn | 0.083 -> 0.164 | 149 -> 363 | n/m -> n/m | n/m -> n/m | n/m -> n/m |
| reads-20 | 0.277 -> 0.224 | 896 -> 377 | n/m -> n/m | n/m -> n/m | n/m -> n/m |
| reasoning-long-prose | 0.174 -> 0.210 | 138 -> 284 | n/m -> n/m | n/m -> n/m | n/m -> n/m |
| reasoning-long-sections | 0.244 -> 0.233 | 154 -> 314 | n/m -> n/m | n/m -> n/m | n/m -> n/m |
| shell-log-large | 0.047 -> 0.051 | 354 -> 258 | n/m -> n/m | n/m -> n/m | n/m -> n/m |
| table-streaming | 0.121 -> 0.190 | 178 -> 270 | n/m -> n/m | n/m -> n/m | n/m -> n/m |
| tool-expanded-streaming | 0.317 -> 0.097 | 336 -> 285 | n/m -> n/m | n/m -> n/m | n/m -> n/m |


### 2.4 Desktop proxy: web production build in Chrome 155.0.8059.40 (1 run)

Cells read `before -> after` (web, 1 run).

##### Render counts (plugin probe, whole run)

| fixture | events | user_message | assistant | reasoning | tool_call | todo | total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| codeblock-streaming | n/m | 7 -> 4 | 402 -> 1115 | 0 -> 0 | 0 -> 0 | 0 -> 0 | 409 -> 1119 |
| diff-large | n/m | 6 -> 4 | 18 -> 21 | 0 -> 0 | 5 -> 2 | 0 -> 0 | 29 -> 27 |
| history-100 | n/m | 4332 -> 6144 | 4261 -> 183 | 2027 -> 55 | 5991 -> 165 | 0 -> 0 | 16611 -> 6547 |
| markdown-long | n/m | 8 -> 4 | 774 -> 2506 | 0 -> 0 | 0 -> 0 | 0 -> 0 | 782 -> 2510 |
| mixed-turn | n/m | 6 -> 4 | 50 -> 85 | 81 -> 28 | 35 -> 14 | 13 -> 4 | 185 -> 135 |
| reads-20 | n/m | 8 -> 4 | 31 -> 64 | 21 -> 6 | 126 -> 48 | 0 -> 0 | 186 -> 122 |
| reasoning-long-prose | n/m | 7 -> 5 | 14 -> 18 | 794 -> 298 | 0 -> 0 | 0 -> 0 | 815 -> 321 |
| reasoning-long-sections | n/m | 7 -> 4 | 10 -> 5 | 735 -> 268 | 0 -> 0 | 0 -> 0 | 752 -> 277 |
| shell-log-large | n/m | 7 -> 4 | 21 -> 23 | 0 -> 0 | 6 -> 2 | 0 -> 0 | 34 -> 29 |
| table-streaming | n/m | 7 -> 4 | 240 -> 773 | 0 -> 0 | 0 -> 0 | 0 -> 0 | 247 -> 777 |
| tool-expanded-streaming | n/m | 7 -> 4 | 111 -> 10 | 0 -> 0 | 99 -> 96 | 0 -> 0 | 217 -> 110 |

##### Commit time of the busiest card kind (ms)

| fixture | kind (before / after) | p50 | p95 | max |
| --- | ---: | ---: | ---: | ---: |
| codeblock-streaming | assistant / assistant | 5.9 -> 1.2 | 10.5 -> 1.7 | 19.3 -> 9 |
| diff-large | assistant / assistant | 1.3 -> 0.9 | 208.9 -> 1.9 | 208.9 -> 2.7 |
| history-100 | tool_call / user_message | 42.2 -> 13.7 | 95.6 -> 32.4 | 772.8 -> 52.4 |
| markdown-long | assistant / assistant | 9.4 -> 1.1 | 16.3 -> 1.7 | 107.6 -> 11.6 |
| mixed-turn | reasoning / assistant | 1.9 -> 1 | 8.7 -> 1.7 | 47 -> 7.5 |
| reads-20 | tool_call / assistant | 13.3 -> 1.1 | 230.2 -> 2 | 317.9 -> 3.5 |
| reasoning-long-prose | reasoning / reasoning | 2.2 -> 0.5 | 3.1 -> 0.8 | 7.1 -> 2.6 |
| reasoning-long-sections | reasoning / reasoning | 3.7 -> 0.5 | 5.5 -> 0.8 | 12.1 -> 2.4 |
| shell-log-large | assistant / assistant | 1.2 -> 1 | 30 -> 2.2 | 30.9 -> 2.8 |
| table-streaming | assistant / assistant | 1.3 -> 1 | 2 -> 1.4 | 10 -> 5.6 |
| tool-expanded-streaming | assistant / tool_call | 8.1 -> 0.8 | 16.7 -> 1.3 | 20.1 -> 2.8 |

##### Markdown, layout, RPC, loops

| fixture | md parses | md parse ms | format flips | height decreases (streaming) | highlight RPC | loops at end | loops peak | md.finalRerender |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| codeblock-streaming | 199 -> 894 | 18.5 -> 90.5 | 0 -> 0 | 4 -> 4 (0 -> 4) | 6 -> 6 | 0 -> 0 | 0 -> 0 | n/m -> 0 |
| diff-large | 5 -> 13 | 0.1 -> 1.6 | 0 -> 0 | 1 -> 1 (0 -> 0) | 2 -> 0 | 3 -> 0 | 4 -> 1 | n/m -> 0 |
| history-100 | 91 -> 110 | 2.7 -> 12 | 21 -> 12 | 0 -> 0 (0 -> 0) | 22 -> 25 | 327 -> 0 | 327 -> 0 | n/m -> 0 |
| markdown-long | 385 -> 2106 | 114 -> 440.1 | 0 -> 1 | 1 -> 0 (0 -> 0) | 0 -> 0 | 0 -> 0 | 0 -> 0 | n/m -> 0 |
| mixed-turn | 20 -> 63 | 1.3 -> 11.6 | 0 -> 0 | 5 -> 2 (0 -> 0) | 8 -> 0 | 21 -> 1 | 22 -> 3 | n/m -> 0 |
| reads-20 | 12 -> 50 | 0.4 -> 9.4 | 0 -> 0 | 3 -> 1 (0 -> 0) | 48 -> 0 | 72 -> 0 | 76 -> 4 | n/m -> 0 |
| reasoning-long-prose | 5 -> 12 | 0.1 -> 1.8 | 0 -> 0 | 2 -> 0 (0 -> 0) | 0 -> 0 | 0 -> 0 | 3 -> 1 | n/m -> 0 |
| reasoning-long-sections | 2 -> 2 | 0.1 -> 0.3 | 0 -> 0 | 1 -> 0 (0 -> 0) | 0 -> 0 | 0 -> 0 | 3 -> 1 | n/m -> 0 |
| shell-log-large | 7 -> 15 | 0 -> 1.9 | 0 -> 0 | 1 -> 1 (0 -> 0) | 0 -> 0 | 2 -> 0 | 3 -> 1 | n/m -> 0 |
| table-streaming | 117 -> 654 | 8.5 -> 98.1 | 0 -> 0 | 3 -> 0 (0 -> 0) | 0 -> 0 | 0 -> 0 | 0 -> 0 | n/m -> 0 |
| tool-expanded-streaming | 4 -> 4 | 0.2 -> 0.9 | 0 -> 0 | 1 -> 1 (0 -> 0) | 0 -> 0 | 2 -> 0 | 3 -> 1 | n/m -> 0 |

##### Frames, long tasks, layout shift, heap

| fixture | dropped ratio | longest frame ms | long tasks | layout shift | JS heap MB |
| --- | ---: | ---: | ---: | ---: | ---: |
| codeblock-streaming | 0.010 -> 0.002 | 133 -> 50 | 2 -> n/m | 0.128 -> 0.116 | 142.5 -> 183.4 |
| diff-large | 0.148 -> 0.003 | 517 -> 33 | 6 -> n/m | 0.024 -> 0.007 | 349.1 -> 202.9 |
| history-100 | 0.776 -> 0.454 | 833 -> 183 | 73 -> 38 | 0.435 -> 0.562 | 351.7 -> 384.1 |
| markdown-long | 0.054 -> 0.002 | 200 -> 50 | 5 -> n/m | 0.639 -> 0.587 | 147.2 -> 156.8 |
| mixed-turn | 0.011 -> 0.002 | 117 -> 50 | 2 -> n/m | 0.085 -> 0.038 | 157.7 -> 140.9 |
| reads-20 | 0.091 -> 0.005 | 567 -> 50 | 15 -> 1 | 0.031 -> 0.013 | 325.0 -> 147.8 |
| reasoning-long-prose | 0.005 -> 0.001 | 67 -> 33 | 1 -> n/m | 0.099 -> 0.002 | 159.3 -> 141.7 |
| reasoning-long-sections | 0.004 -> 0.002 | 67 -> 33 | 1 -> n/m | 0.161 -> 0.002 | 142.5 -> 153.3 |
| shell-log-large | 0.008 -> 0.003 | 133 -> 50 | 1 -> n/m | 0.005 -> 0.007 | 153.8 -> 151.5 |
| table-streaming | 0.006 -> 0.001 | 67 -> 33 | 1 -> n/m | 0.040 -> 0.045 | 224.0 -> 145.5 |
| tool-expanded-streaming | 0.003 -> 0.002 | 50 -> 33 | n/m -> n/m | 0.014 -> 0.007 | 152.2 -> 148.5 |


Notes on the tables: `md.finalRerender` is a probe counter added by S2 (a finished Markdown block that rendered again); it is 0 in every after run on all three layers. On the Chrome layers `n/m` for long tasks means none observed (0); on iOS it means the metric does not exist in React Native. The offline "plugin renders beyond host-active updates" column is an upper bound on non-active plugin renders (probe renders minus renders of rows whose data changed).

## 3. Plan section 3.2 budget (basis: web production build, 1 run; offline and iOS shown for context)

| Budget row | Target | Result | Verdict |
|---|---|---|---|
| Non-active card re-renders per chunk | 0 | Offline `current` (worst host): plugin renders beyond active updates fell from 26-171,382 to 2-374 (about 0 per chunk; e.g. `codeblock-streaming` 991 -> 2, `mixed-turn` 571 -> 15, `reads-20` 1,052 -> 77). The never-changing user prompt renders 4 times per single-turn fixture on web and iOS (offline `current` 1, was 990), not once per chunk. **Many live rows still fan out on web**: `history-100` renders the user prompt 6,144 times for 110 cards (about 56 each; baseline 4,332; offline `cached` floor 110) | **Pass** for single-turn scenes; **Fail** for `history-100` as a live head on web (see defect D3) |
| Streaming commit p95 <= 4 ms and >= 50% below baseline | <= 4 ms, -50% | Web busiest card kind p95: 1.7 / 1.9 / 1.7 / 1.7 / 2.0 / 0.8 / 0.8 / 2.2 / 1.4 / 1.3 ms for `codeblock-streaming`, `diff-large`, `markdown-long`, `mixed-turn`, `reads-20`, both reasoning fixtures, `shell-log-large`, `table-streaming`, `tool-expanded-streaming` (baseline 2.0-230 ms, lower by 30-99%; `table-streaming` is only -30% from an already 2.0 ms baseline, `reasoning-long-prose` -74%). `history-100`: 32.4 ms (baseline 95.6, -66%). iOS dev build, same kinds: 23-62 ms (A/B shows 2-6x lower than the baseline build for every kind except the user card) | **Pass** on web for 10 of 11 fixtures (the -50% clause is missed only by `table-streaming`, which is already under 4 ms); `history-100` fails the absolute 4 ms (it is a 110-card live head at max speed); iOS dev not comparable to a 4 ms target |
| Finished Markdown block re-renders | 0 | `md.finalRerender` = 0 in all 66 offline runs, 11 iOS and 11 web dumps | **Pass** |
| Format flips | 0 | Offline 0 in all fixtures (was 10 `codeblock-streaming`, 6 `table-streaming`, 25 `history-100`). Real hosts: web `markdown-long` **1** (was 0), web `history-100` **12** (was 21), iOS `history-100` **3** (was 3); 0 elsewhere | **Pass** offline; **Fail** on real hosts for `markdown-long` (web) and `history-100` |
| Height decreases while streaming (excl. user collapse) | 0 | `codeblock-streaming`: 6 of 6 fence closes shrink the card by 18 px while streaming (offline) and 4 on web (`whileStreaming`); iOS records 0 flagged streaming (the iOS card knows no phase for it). Other fixtures: 0 flagged streaming; total decreases (not flagged streaming) 1-4 per fixture, e.g. when a tool completes | **Fail** (D4) |
| Highlight RPC per code block | <= 1 | `codeblock-streaming` 6 RPCs for 6 blocks on every layer; `reads-20` 48 -> 0 (offline/web), 24 -> 0 (iOS) | **Pass** |
| Long tasks > 50 ms in a 60 s replay | 0 | Web: none observed in 9 fixtures; `reads-20` 15 -> 1 and `history-100` 73 -> 38 (max speed, not a 60 s replay). Offline: 1 in `codeblock-streaming`, 0 elsewhere (was 4 / 12 / 638 in `diff-large` / `reads-20` / `history-100`) | **Marginal fail** (1 long task in `reads-20` on web); otherwise pass |
| Dropped-frame ratio | < 5% | Web: 0.1-0.5% for 10 fixtures (baseline 0.3-15%), `history-100` 45% (max speed; was 78%). Offline: 0. iOS dev: 8-51% (baseline 5-48%; not comparable) | **Pass** on web and offline (except the max-speed `history-100`); iOS dev not a valid target |

Other measured outcomes: loops mounted at the end of a run are 0 everywhere except 1 `RunningDot` in `mixed-turn` (was 13-414), JS heap is 5-60% lower on tool-heavy fixtures (`diff-large` 349 -> 203 MB, `reads-20` 325 -> 148 MB on web) and layout shift fell 0.03-0.16 -> about 0.00-0.04 on reasoning and mixed fixtures, but **layout shift stays high on long Markdown on web** (`markdown-long` 0.639 -> 0.587, `history-100` 0.435 -> 0.562).

## 4. The iOS user-message commit anomaly (S3's observation)

Method: baseline plugin `4637382` (= `42b61d8` plus inert probes) installed as `bc-base`, `main` as `bc-final` (one enabled at a time), same simulator and session, app relaunched and a fresh agent used for every run, `mixed-turn`, alternating `base1, final1, base2, final2, base3, final3, base4, final4` (4 runs each; raw dumps in `raw-ab/`). Each run's dump identifies its build (`counters` exist only in the new code).

| Card kind (commit ms, median of 4 runs) | base p50 | final p50 | base p95 | final p95 | base total | final total |
|---|---|---|---|---|---|---|
| **user_message** (4 renders) | **18.0** | **26.6** (+48%) | 31.1 | 31.9 | 92 | 106 (+15%) |
| assistant | 23.4 | 15.5 (-34%) | 103 | 25 | 1,272 | 731 |
| reasoning | 26.7 | 12.9 (-52%) | 100 | 23 | 1,078 | 406 |
| tool_call | 52.2 | 18.9 (-64%) | 125 | 32 | 1,937 | 283 |
| todo | 74.5 | 28.5 (-62%) | 146 | 41 | 736 | 128 |

Per run, user p50: base 18.2 / 16.2 / 22.9 / 17.9, final 28.0 / 25.3 / 40.5 / 22.4.

Findings:
- **It is real but smaller than 2x**: +48% on p50 and +15% on total commit time of the four renders, while the first mount (the max, 31-32 ms) is unchanged. In absolute terms the user card costs about 14 ms more over a whole turn, against savings of 0.6-1.7 s on the other cards.
- **Cross-session deltas exaggerate it**: comparing the old baseline file with the final run gives 11 -> 29 ms (2.5x) because the baseline session ran faster overall; the paired runs differ by 1.5x.
- **Not reproduced elsewhere**: offline `user_message` commit p50 4.1 -> 4.1 ms (cached) and 6.3 -> 2.7 ms (current); on web it is faster (8.0 -> 3.3 ms in `mixed-turn`). Only iOS regresses, and only this one card kind (every other kind is 2-6x faster).
- **Most likely cause (hypothesis, not isolated): the user card is the settings "leader"**. `PreferenceSyncSlot` (S5, `client/state/preference-sync-slot.tsx`) elects the first mounted card as the one that runs the host `useSettings` hook and the sync status subscription; the first card mounted in every agent view is the user prompt. Its commit therefore includes the react-query settings subscription and the extra updates when the daemon settings arrive, which exist only in the new build. Supporting evidence: the effect is specific to one card kind and absent where `useSettings` is a stub (offline) or cheap (web); in `history-100` (123 user renders, one leader) iOS user p50 moves only 22.7 -> 29.7 ms. Against it: the first-mount maximum did not grow, so the cost sits in the later re-renders. Other candidates not excluded: `useCopy`/`useToast` hooks that are new to this card, and the host `useAgent` selector that returns a new object. **To confirm**: time `PreferenceSyncLeader` separately, or A/B with the slot mounted only in the assistant card.

## 5. Functional acceptance

Requirement numbering follows `writing-block.md` section 16.1 (the plan's fixture README uses a different numbering for the same scenarios). Evidence paths are under `docs/bench/raw-v1/` unless noted.

### 5.1 Section 16.1 scenarios

| # | Scenario | Status | Evidence |
|---|---|---|---|
| 1 | 20+ consecutive file reads | **Pass** | Collapsed one-line rows on web and iOS (`web-reads-20-final.png`, `ios-reads-collapsed.png`); web commit p95 2.0 ms, 1 long task (was 15), 72 loops -> 0, heap 325 -> 148 MB. Row pitch 48 px (card 32) on web, 46 pt on iOS, against 32 for host-native rows: the host adds a 16 px gap between plugin rows (H0 not applied, was 22 px more per row before) |
| 2 | Huge shell log | **Pass** | Expanding the 2,852-line log took 115 ms on web (`web-shell-log-expanded.png`, 51,441 px row); web commit p95 2.2 ms. No row cap: all 2,852 lines mount (S2 noted this; not walked on iOS) |
| 3 | Long streaming reasoning | **Pass** | Collapsed "Thought, 19 steps" row; expanded body has titles with no numbering (`web-reasoning-sections-expanded.png`, `reasoning-walk` JSON `web-walk-1.json`: no "Step N"); web commit p95 0.8 ms, layout shift 0.161 -> 0.002 |
| 4 | Long streaming Markdown | **Pass with notes** | Stable rendering; commit p95 1.7 ms web (16.3 before); parse count and total time rose on web (385 -> 2,106 parses, 114 -> 440 ms) because the reply now renders per frame (`ASSISTANT_REVEAL`, D1); layout shift still 0.587 |
| 5 | Dynamic code blocks | **Pass with a note** | Flat code frame with language icon and Copy (`web-codeblock-final-bottom.png`, iOS `ios-code-hscroll.png`); 0 format flips offline/web/iOS; 6 RPCs for 6 blocks. Note: 18 px height drop at each fence close (D4) |
| 6 | Dynamic tables | **Pass** | Tables aligned, right-aligned numerics (`web-table-final.png`, `ios-table-before.png`); 0 flips (was 6); each table scrolls horizontally on its own on iOS (`ios-table-hscroll.png`) and web |
| 7 | Large diff | **Pass** | Expanding the 5,128-line diff renders about 400 lines with "Show all" (`web-diff-large-expanded.png`, row 7,334 px); web commit p95 208.9 -> 1.9 ms, long tasks 6 -> 0, heap 349 -> 203 MB; on iOS the tool card commit fell from p50 2,170 ms / p95 4,500 ms to 19.8 / 24.4 ms (the UI no longer freezes) |
| 8 | 100+ history messages | **Partial** | Probes: web commit p95 95.6 -> 32.4 ms, long tasks 73 -> 38, loops 327 -> 0, offline `current` render count 172,327 -> 1,319; but web user cards still re-render 6,144 times (D3), flips 12, dropped frames 45% (max speed) |
| 9 | Scroll up during streaming | **Pass (web)** | While `markdown-long` streamed (page height 4,297 -> 8,006 px) the scroll position stayed at 1,801 px after a 1,800 px wheel scroll up and was not pulled back (`web-walk-3.json`, `web-scrolled-up-during-stream.png`). iOS not driven (host behaviour) |
| 10 | Expanded tool receiving content | **Pass** | `tool-expanded-streaming`: web commit p95 16.7 -> 1.3 ms, iOS tool p95 188 -> 24 ms; 1 `RunningDot` while running, 0 at the end |
| 11 | User message and tool header sticky | **Requires H2a/H2b** | Not part of the plugin on 0.11.2; no sticky header observed on any layer |
| 12 | Change Paseo font settings | **Requires H1** | Settings page states "This Paseo version does not share its font settings with plugins, so Follow Paseo uses the defaults: the embedded Iosevka at 12px" (`web-settings-top.png`); the fallback works, the follow behaviour cannot be exercised on 0.11.2 |
| 13 | Switch project/workspace/worktree | **Not verified end to end** | In-app switch could not be automated reliably (history navigation produced a blank page, `web-reads-expand-state-after-inapp-switch.png`); state is keyed `agentId:callId` and unit-tested; each fresh agent opened with correct collapsed state |
| 14 | Light/dark theme | **Pass (web)** | Light (`web-mixed-turn-bottom.png`) and dark via `prefers-color-scheme: dark` (`web-mixed-turn-dark.png`) both render with the host palette; iOS shown in light only |
| 15 | iOS/Android copy and file jump | **Pass on iOS; Android not verifiable** | iOS: code-block Copy puts the raw code in the clipboard (pasted into the composer, `ios-code-copy-pasted.png`); tapping a path shows "Copied" and the pasted text is the full absolute path `/Users/dev/workspace/acme-chat/shared/snapshot-chunk.tsx` (`ios-read-expanded.png`, `ios-path-copy-pasted.png`); long-press on a row header copies its path. File reveal was not exercised: on web a click would open Finder on this machine. No Android device |

### 5.2 Section 16.3 checklist and earlier unverified items

| Item | Status | Evidence |
|---|---|---|
| Tool calls compact by default | **Pass** | All tools one flat row, failed Bash with a red one-line error (`web-mixed-turn-collapsed-rows.png`); static check: `rg "Animated.loop" client` = RunningDot only |
| Tool details expandable | **Pass** | Row click expands thought/bash/read/edit (`web-mixed-turn-expanded-thought-bash.png`, `ios-read-expanded-body.png`, `ios-bash-expanded.png`) |
| Reasoning without meaningless numbering | **Pass** | See scenario 3 |
| Dual sticky | **Requires H2a/H2b** | See scenario 11 |
| Markdown on a verified modern engine | **Pass** | `marked` vendored and lowered for Hermes; `npm run check:hermes` compiles and runs the bundle; plugin loads on iOS (Settings, Plugins: running); 573 unit tests pass |
| Stable layout while streaming | **Partial** | 0 flips offline, 0 finished-block re-renders, but D4 (18 px drop per fence) and layout shift 0.587 on long Markdown (web) |
| Code and tables correct | **Pass** | See scenarios 5-6 |
| Flatter, finer visuals | **Pass** | No shadows/frames in tool, reasoning, code, table rows (screenshots above); static checks: `rg "boxShadow\|frosted\|glowing\(" client/components` hits only `approval-card.tsx` (not mounted, kept per D7) and the overlay helpers; `rg "borderRadius: [0-9]" client` = 0. The Tasks card keeps a frame with a green 2 px rule under its header |
| Animations unobtrusive | **Pass** | Loops at end 0 (was up to 414); only `RunningDot` loops; **Reduced Motion on web**: the dot's opacity pulses 0.4-1.0 normally and stays 1.0 under `prefers-reduced-motion: reduce` (`web-walk-4.json`, `web-running-dot-reduced.png`). Reduced Motion on iOS not re-driven |
| Local (partial) copy | **Pass** | Web: code Copy and reply Copy put raw code / raw Markdown with 12 fence markers in the clipboard (`web-walk-2.json`); iOS: long-press in Markdown text and in expanded tool output shows the system selection "Copy" callout (`ios-markdown-longpress-select.png`, `ios-tool-output-longpress.png`) |
| Monospace font configurable | **Pass** | Settings offers Follow Paseo / Iosevka / Iosevka Code / Custom; Custom `Menlo` changes the code block family to `Menlo, "OMP Iosevka", ...` (`web-walk-5.json`, `web-codeblock-menlo.png`); iOS code is monospace (`ios-code-hscroll.png`), fixing the baseline's proportional fallback |
| Inherits Paseo font when supported | **Not supported on 0.11.2, falls back as designed** | Settings notice quoted under scenario 12 |
| Paths relative to the project | **Not verifiable with the fixtures** | Every fixture path lies outside the agent workspace (`/tmp/bc-orchestrate/s0d-project`), so rows show abbreviated absolute paths (`/…/lib/x.ts`); relative formatting is covered by unit tests only |
| File locating and tool behaviour unaffected | **Pass for copy; reveal not exercised** | `file.reveal`, `file.image`, `highlight.tokens` methods are registered by the daemon plugin; clicking a path on web would open Finder, so it was not clicked |
| Mobile reading experience | **Pass** | iOS screenshots: single-line rows, monospace code, readable tables, 46 pt row pitch |
| iOS text selection in Markdown and tool output | **Pass** | Callouts in `ios-markdown-longpress-select.png` and `ios-tool-output-longpress.png` |
| iOS code-block copy button, path press, header long-press | **Pass** | Clipboard contents verified by pasting / `simctl pbpaste` (section 5.1 item 15) |
| Horizontal scrolling of wide code and tables, iOS and web | **Pass** | iOS: `ios-code-hscroll.png`, `ios-table-hscroll.png`. Web: a synthetic wide fixture (10-column table, 160-character code line, replay harness) shows scroll containers of 2,448 and 936 px inside a 664-688 px column and `scrollLeft` moves (`web-wide-before-scroll.png`, `web-wide-after-scroll.png`); the message column does not widen |
| Reduced Motion on web | **Pass** | Above |
| Reduced Motion on iOS, Android, iPad pointer, Electron | **Not verifiable here** | Not driven in this run (no Android device, no Electron automation allowed, simulator Reduce Motion not toggled) |

## 6. Defects and risks (severity-ranked)

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| D3 | Medium | The user-prompt card re-renders on host updates: on web `history-100` it renders 6,144 times for 110 cards (about 56 each; floor 110). The likely source is the card's `useAgent(agentId, agent => ({status, updatedAt}))` selector, which returns a new object on every call; not a regression (baseline 4,332) but it defeats the semantic memo when many rows are live | `raw-host-final/web-history-100-*.json`; table 2.4 |
| D1 | Medium | Frame-paced reveal (`ASSISTANT_REVEAL = true`, `client/live-renderers.tsx`) multiplies assistant renders and parses on web for slow streams: `markdown-long` 774 -> 2,506 renders and 385 -> 2,106 parses (114 -> 440 ms total), `table-streaming` 240 -> 773 renders. Commit p95 stays 1.4-1.7 ms, so it is a JS-load trade-off, not a budget breach | table 2.4; code comment says to switch it off if per-frame renders measure too expensive |
| D4 | Low-Medium | Each closing code fence shrinks the streaming card by 18 px (6 of 6 blocks in `codeblock-streaming`), breaking the "no height regression" budget | `raw-final/codeblock-streaming.*.snapshot.json` `heightDecreases.events`, offline and web |
| D5 | Low | Format flips on real hosts although 0 offline: web `markdown-long` 1, web `history-100` 12, iOS `history-100` 3 | tables 2.3 and 2.4 |
| D6 | Low | iOS user-message commit is about 1.5x slower (+8 ms p50) than the baseline build in paired runs; probable cause is the settings-leader slot (section 4) | `raw-ab/` |
| D7 | Low | Layout shift remains high on long Markdown on web (0.587 `markdown-long`, 0.562 `history-100`) | table 2.4 |
| D8 | Info | Host spacing (H0) not applied: plugin rows keep a 16 px gap while native rows touch (pitch 48 vs 32 px web, 46 vs 32 pt iOS) | section 5.1 item 1 |
| D9 | Info | The expanded 2,852-line shell log mounts all lines (no cap); fine on web (115 ms), not tried on iOS | `web-walk-8.json` |

No blocker found: typecheck, 573 unit tests and `check:hermes` pass, and the plugin loads and renders on web and iOS.

## 7. Not verified, and why

- Paseo.app (Electron) itself: not automated by decision; the web production build is the proxy.
- Android, iPad pointer, Reduced Motion on iOS/Android: no device or not driven.
- Scenarios 11 and 12 and the Paseo-font inheritance: need host changes H2a/H2b/H1.
- Scenario 13 (workspace switch) end to end, workspace-relative paths, `file.reveal` click: see table 5.1/5.2.
- iOS numbers are single dev-build simulator runs; baseline-to-final deltas across sessions are about 2x noisy (use the paired A/B).
- On a cold relaunch the iOS app sometimes restores a route stuck at "loading workspace" until a sidebar entry is tapped; this is host behaviour seen with the baseline plugin as well and is unrelated to the plugin.

## 8. Reproduce

```
npm run replay -- --fixtures <streams> --host current|cached --runs 3 --speed 1 --speeds history-100=0,tool-expanded-streaming=4 --out <dir>
paseo --home ~/.paseo-bench plugin install <worktree> --id bc-final     # iOS: /bc-perf on|reset|dump <fixture> per fresh agent
node .showcase/tools/web-bench.mjs <fixture>:<speed> ...                # web production build on :8090
node docs/bench/tools/final-report.mjs offline-current|offline-cached|ios|web
node docs/bench/tools/web-walk-1.mjs ... web-walk-8.mjs                 # functional walk-through
```
