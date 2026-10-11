# Real-host baseline

Companion to `baseline-showcase.md` (offline replay). Same fixtures, same metric names, measured in a real Paseo 0.11.2 client talking to the isolated bench daemon (`~/.paseo-bench`, port 6868) through the `bc-bench` replay provider.

## Status

| Target | Status |
|---|---|
| iOS Simulator, dev build | **Measured**, 11/11 fixtures, 1 run each |
| Paseo.app desktop (production Electron) | **Blocked, not measured** (reason below) |
| H0 spacing claim | **Measured on iOS** (screenshots in `raw-host/`); desktop not measured |

**Desktop is blocked.** The task asked to drive Paseo.app with desktop automation. The `cua-driver` skill routes Claude Code to the built-in `computer-use` MCP server only and says not to fall back to cua-driver when it is off. That server is not loaded in this session (the only desktop-automation tools present are the cua-driver MCP ones), so no desktop automation was used. Paseo.app was never opened or modified: its host list is unchanged (nothing was added, so nothing had to be removed), and the user's main daemon (`~/.paseo`, port 6767) and agents were not touched. To unblock: enable `computer-use` in `/mcp` for this session (or explicitly allow the cua-driver MCP), then run the procedure in `tools/bench-provider/README.md` section 6 with the `/bc-perf` commands described below.

## How it was measured

- **Control surface**: slash command `/bc-perf on | off | reset | dump [label]` (client `client/debug/perf-command.ts`, registered in `index.client.tsx`). `dump` calls the daemon RPC `debug.perf.dump` (`shared/perf-rpc.ts`, handler in `index.server.ts`, writer `server/perf-dump.ts`, unit tested) which writes `/tmp/bc-perf/<platform>-<label>-<timestamp>.json` on the daemon machine. Nothing happens until the command is typed. Raw dumps: `docs/bench/raw-host/ios-*.json`.
- **Per fixture**: a fresh agent on the `bc-bench` provider (created from the CLI with a `list` prompt, so each chat starts with one short assistant reply), opened in the app by deep link (`sh.paseo:///h/<serverId>/agent/<agentId>`), then `/bc-perf on`, `/bc-perf reset`, fixture started with `paseo send <agent> "fixture:<name> speed:<n>"`, wait for the agent to go idle, 4 s settle, `/bc-perf dump <name>`.
- **Speeds**: same as offline: 1 for everything except `history-100` (max) and `tool-expanded-streaming` (4).
- **Runs**: **1 run per fixture** (approved for real hosts). Numbers are single samples, not medians; expect noise, especially in frame metrics.
- **Driving the simulator**: no Simulator.app exists under Xcode 27, so taps and gestures go through `serve-sim` addressed by explicit UDID. Typing through it is unreliable under the simulator's Chinese pinyin keyboard (spaces and Enter are swallowed), so each command is pasted from the simulator pasteboard and sent with the send button (`/tmp/bc-orchestrate/tools/ios-cmd.sh`, `ios-fixture.sh`).

## Environment (iOS)

| | |
|---|---|
| Device | iPhone 16 Pro simulator, UDID `CE6149D8-A1AD-4BDC-A8DE-BD995927EB5C`, iOS 18.6, window 402 x 874 pt @3x |
| Host machine | Apple M5 Pro, macOS 27.0.1, Xcode 27 |
| Build | Paseo 0.11.2 **Debug / dev build** (`sh.paseo`), JS served by Metro (dev mode), Hermes; connected only to `127.0.0.1:6868` |
| Daemon | bench daemon 0.11.2; `beautiful-chat` from `.worktrees/s0-infra`, `bc-bench` from `tools/bench-provider` of the merged main checkout |
| Caveat | **Simulator, dev build: relative comparison only.** A dev build runs unminified JS with dev checks, so absolute times are much worse than a release build on a device. |

## iOS results (single run per fixture)


### Render counts, ios (1 run)

| fixture | speed | user_message | assistant | reasoning | tool_call | todo |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| codeblock-streaming | 1 | 7 | 410 | 0 | 0 | 0 |
| diff-large | 1 | 16 | 11 | 0 | 4 | 0 |
| history-100 | max | 123 | 13 | 4 | 19 | 0 |
| markdown-long | 1 | 7 | 672 | 0 | 0 | 0 |
| mixed-turn | 1 | 4 | 48 | 33 | 36 | 9 |
| reads-20 | 1 | 4 | 30 | 7 | 73 | 0 |
| reasoning-long-prose | 1 | 8 | 12 | 299 | 0 | 0 |
| reasoning-long-sections | 1 | 8 | 8 | 265 | 0 | 0 |
| shell-log-large | 1 | 8 | 14 | 0 | 4 | 0 |
| table-streaming | 1 | 7 | 238 | 0 | 0 | 0 |
| tool-expanded-streaming | 4 | 7 | 7 | 0 | 91 | 0 |

### User-message renders: real host vs offline replay (the card that never changes)

| fixture | real host | offline current | offline cached | stream events |
| --- | ---: | ---: | ---: | ---: |
| codeblock-streaming | 7 | 990 | 1 | 989 |
| diff-large | 16 | 11 | 1 | 10 |
| history-100 | 123 | 43831 | 110 | 781 |
| markdown-long | 7 | 511 | 1 | 510 |
| mixed-turn | 4 | 60 | 1 | 59 |
| reads-20 | 4 | 66 | 1 | 65 |
| reasoning-long-prose | 8 | 198 | 1 | 197 |
| reasoning-long-sections | 8 | 170 | 1 | 169 |
| shell-log-large | 8 | 11 | 1 | 10 |
| table-streaming | 7 | 177 | 1 | 176 |
| tool-expanded-streaming | 7 | 102 | 1 | 101 |

### Commit time (ms) and Markdown

| fixture | busiest kind | commit p50 | commit p95 | commit max | md parses | md parse total ms | block kind flips | height decreases | highlight RPC |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| codeblock-streaming | assistant | 22.8 | 39.7 | 90.5 | 203 | 16.2 | 0 | 5 | 6 |
| diff-large | user_message | 21.5 | 837.8 | 837.8 | 4 | 0.1 | 0 | 1 | 0 |
| history-100 | user_message | 22.7 | 51.9 | 148.3 | 10 | 3.1 | 3 | 0 | 1 |
| markdown-long | assistant | 35.5 | 69.3 | 149.4 | 334 | 842.0 | 0 | 1 | 0 |
| mixed-turn | assistant | 11.7 | 41.4 | 90.5 | 21 | 1.7 | 0 | 14 | 8 |
| reads-20 | tool_call | 152.3 | 446.8 | 450.5 | 13 | 0.7 | 0 | 9 | 24 |
| reasoning-long-prose | reasoning | 13.4 | 19.4 | 27.5 | 4 | 0.1 | 0 | 1 | 0 |
| reasoning-long-sections | reasoning | 20.0 | 27.8 | 32.0 | 2 | 0.1 | 0 | 1 | 0 |
| shell-log-large | assistant | 7.5 | 234.4 | 234.4 | 5 | 0.1 | 0 | 2 | 0 |
| table-streaming | assistant | 12.9 | 19.2 | 34.8 | 117 | 56.8 | 0 | 3 | 0 |
| tool-expanded-streaming | tool_call | 95.3 | 187.5 | 197.9 | 2 | 0.0 | 0 | 0 | 0 |

### Commit time per kind, p50 / p95 ms: real host vs offline (current / cached)

| fixture | kind | real host | offline current | offline cached |
| --- | ---: | ---: | ---: | ---: |
| codeblock-streaming | user_message | 17.7 / 25.6 | 1.4 / 2.6 | 3.6 / 3.6 |
| codeblock-streaming | assistant | 22.8 / 39.7 | 1.1 / 2.3 | 1.1 / 1.8 |
| diff-large | user_message | 21.5 / 837.8 | 114.7 / 174.3 | 5.9 / 5.9 |
| diff-large | assistant | 11.1 / 2171.1 | 17.8 / 174 | 1 / 11.9 |
| diff-large | tool_call | 2170.2 / 4499.8 | 115 / 173.8 | 9.8 / 439 |
| history-100 | user_message | 22.7 / 51.9 | 23.1 / 51.8 | 1.2 / 4.1 |
| history-100 | assistant | 55.0 / 176.0 | 22.5 / 50.9 | 1.2 / 4 |
| history-100 | tool_call | 61.7 / 173.9 | 19.4 / 46.7 | 2.8 / 5.8 |
| history-100 | reasoning | 75.0 / 156.1 | 35.5 / 76.2 | 2.6 / 6.5 |
| markdown-long | user_message | 15.6 / 36.2 | 4.6 / 8.2 | 7.2 / 7.2 |
| markdown-long | assistant | 35.5 / 69.3 | 4.1 / 7.7 | 4.7 / 9.5 |
| mixed-turn | user_message | 11.3 / 14.4 | 6.3 / 9.4 | 4.1 / 4.1 |
| mixed-turn | assistant | 11.7 / 41.4 | 3.3 / 7.5 | 0.6 / 2.8 |
| mixed-turn | reasoning | 12.5 / 55.4 | 3.4 / 8.1 | 1 / 3.4 |
| mixed-turn | todo | 41.4 / 71.2 | 4.9 / 7.7 | 1.1 / 1.9 |
| mixed-turn | tool_call | 28.3 / 63.6 | 3.1 / 6 | 1.7 / 4 |
| reads-20 | user_message | 7.2 / 15.4 | 30.5 / 60.1 | 3.9 / 3.9 |
| reads-20 | assistant | 12.2 / 43.4 | 23.9 / 59.3 | 0.5 / 5.1 |
| reads-20 | reasoning | 9.5 / 13.9 | 32.1 / 59.6 | 1 / 9.5 |
| reads-20 | tool_call | 152.3 / 446.8 | 24.8 / 52.9 | 2.3 / 5.4 |
| reasoning-long-prose | user_message | 12.0 / 17.6 | 1.7 / 2.8 | 3.4 / 3.4 |
| reasoning-long-prose | assistant | 8.0 / 19.1 | 1.2 / 2.8 | 0.4 / 2 |
| reasoning-long-prose | reasoning | 13.4 / 19.4 | 1.2 / 2.4 | 0.7 / 1 |
| reasoning-long-sections | user_message | 12.7 / 17.5 | 2.5 / 4 | 3.6 / 3.6 |
| reasoning-long-sections | assistant | 12.9 / 19.4 | 0.7 / 2.9 | 0.6 / 2.3 |
| reasoning-long-sections | reasoning | 20.0 / 27.8 | 2 / 3.4 | 1.2 / 1.9 |
| shell-log-large | user_message | 12.6 / 18.2 | 10.2 / 21.2 | 4.2 / 4.2 |
| shell-log-large | assistant | 7.5 / 234.4 | 2.1 / 20.5 | 0.5 / 7.4 |
| shell-log-large | tool_call | 233.6 / 299.3 | 11.2 / 20 | 3.3 / 21.4 |
| table-streaming | user_message | 16.5 / 18.9 | 2 / 3.3 | 3.9 / 3.9 |
| table-streaming | assistant | 12.9 / 19.2 | 1.6 / 2.7 | 0.8 / 1.3 |
| tool-expanded-streaming | user_message | 16.7 / 18.8 | 4.7 / 7.4 | 4.4 / 4.4 |
| tool-expanded-streaming | tool_call | 95.3 / 187.5 | 4.1 / 6.8 | 4 / 7.2 |
| tool-expanded-streaming | assistant | 15.8 / 162.5 | 4.3 / 7 | 0.7 / 7.6 |

### Animations, frames

| fixture | anim peak | anim mounted at dump | frames | dropped ratio | longest frame ms | long tasks | layout shift | JS heap |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| codeblock-streaming | 0 | 0 | 1016 | 0.358 | 249 | n/m | n/m | n/m |
| diff-large | 4 | 3 | 1586 | 0.025 | 159 | n/m | n/m | n/m |
| history-100 | 40 | 35 | 304 | 0.126 | 418 | n/m | n/m | n/m |
| markdown-long | 0 | 0 | 1634 | 0.482 | 340 | n/m | n/m | n/m |
| mixed-turn | 22 | 13 | 1408 | 0.083 | 149 | n/m | n/m | n/m |
| reads-20 | 40 | 33 | 863 | 0.277 | 896 | n/m | n/m | n/m |
| reasoning-long-prose | 3 | 0 | 1350 | 0.174 | 138 | n/m | n/m | n/m |
| reasoning-long-sections | 3 | 0 | 1109 | 0.244 | 154 | n/m | n/m | n/m |
| shell-log-large | 3 | 2 | 1206 | 0.047 | 354 | n/m | n/m | n/m |
| table-streaming | 0 | 0 | 1477 | 0.121 | 178 | n/m | n/m | n/m |
| tool-expanded-streaming | 3 | 2 | 1196 | 0.317 | 336 | n/m | n/m | n/m |

Not measured on iOS, and why: **long tasks** and **layout shift** (React Native has no `PerformanceObserver`), **JS heap** (Hermes exposes no `performance.memory`), **non-active card renders** (the offline "host-row spy" lives in the replay harness; a real host has no equivalent hook, so only totals per kind are available).

Frame meter notes: the rAF meter counts a callback per frame; the first `history-100` attempt was interrupted by an iOS microphone-permission dialog (a mis-tap on the empty-composer voice button) and its dump is kept only as `ios-history-100-...interrupted-by-mic-modal.json.txt`; the table uses the clean rerun.

## Does the real host confirm "every chunk re-renders all live rows"?

**No, not as stated.** The offline `current` mode re-renders every row on every event, which made the unchanging user prompt render once per chunk (990 times for `codeblock-streaming`). In the real host the same card rendered **7 times** for 989 events (4 to 8 across all fixtures; `history-100` 123 vs 43,831 offline-current and 110 offline-cached). The real host therefore already shields rows whose item has not changed; its user-message count sits next to the offline `cached` model (1 render), not the `current` one. The "every chunk re-renders the whole turn" hotspot (offline findings 1 and 2) should be treated as **not reproduced on a real host** and removed from the plan's priority list, unless a production Electron build shows otherwise (not measured, see Status).

What the real host does show:

1. **Active-card cost per commit is large.** Commit p50/p95 on the active card is 12-35 ms / 20-70 ms for text cards (`markdown-long` assistant 35.5 / 69.3 ms, offline 4.1 / 7.7 ms; `codeblock-streaming` 22.8 / 39.7 ms, offline 1.1 / 2.3 ms) and 95-235 ms for tool cards (`tool-expanded-streaming` 95 / 188 ms; `shell-log-large` 234 / 299 ms; `reads-20` 152 / 447 ms vs 2.3 / 5.4 ms offline-cached). That is 5-60x the offline numbers. A dev build on a simulator explains part of it, but the ordering matches the plan: the cost sits in what an active card re-renders per chunk, not in fan-out.
2. **Large tool bodies block the UI thread**: `diff-large` tool card commit p50 2.2 s / p95 4.5 s (offline 115 / 174 ms current, 9.8 / 439 ms cached); after the fixture finished the UI needed seconds before it accepted the next command.
3. **`reads-20`: tool cards cost 152 ms each at p50** (24 cards, 40 looping animations mounted at peak, 33 still mounted at the end) with 24 highlight RPCs and a 0.28 dropped-frame ratio and a 896 ms longest frame.
4. **Markdown re-parse**: `markdown-long` spent 842 ms across 334 parses on iOS (offline 148 ms / 509 parses). Dropped-frame ratio 0.48 on this fixture and 0.36 on `codeblock-streaming` (offline 0). Parses are fewer than events (334 vs 510) because React batches several chunks per render on device.
5. **Format flips**: 0 on iOS for `codeblock-streaming` and `table-streaming` (offline 10 and 6), because with batching the unclosed-fence state is rarely rendered on its own; 3 in `history-100`. Height decreases: 14 in `mixed-turn`, 9 in `reads-20`, 5 in `codeblock-streaming`.
6. **Animations are not released**: `reads-20` ends with 33 mounted loops (offline 72), `mixed-turn` 13 (offline 21), `history-100` 35 (offline 414), `diff-large` 3, `shell-log-large` and `tool-expanded-streaming` 2 each. Markdown-only and reasoning-only fixtures end at 0 except the 3 reasoning loops that stop once the card completes.
7. **Frames overall**: reasoning, table and markdown fixtures at speed 1 still drop 12-48% of frames in the simulator dev build. Read as relative, not absolute.

## Native client finding: class syntax breaks the plugin on Hermes

While preparing this run, the plugin failed to load in the iOS app (Settings, Plugins, beautiful-chat "failed"). The Hermes runtime evaluates the plugin client bundle as plain source and the host's compiler does not lower class syntax. Two causes found by bisecting in the simulator, both only visible on native (the daemon compiles fine and a Node run of the same bundle passes):

- **`marked@18.1.0` cannot be bundled into the client as the host compiles it**: importing it makes evaluation fail with `right operand of 'in' is not an object` (`remend@1.4.0` alone loads fine). This invalidates the earlier S0-A "bundling smoke test", which proved only that the daemon compiles the bundle and that Node runs it. The debug probe import was removed (commit "drop class syntax ..."), and the `marked` dependency is currently unused. Plan decision D4 (marked as the Markdown engine) needs a native-safe path before S2, for example a pre-lowered vendored build, or a different tokenizer.
- **`class` in the plugin's own code** (the perf store used two classes) failed with `Cannot read property 'prototype' of undefined`. `client/debug/store.ts` now uses closures. Rule for all slices: no `class` in client code or in client dependencies; verify on a device or simulator, not only on desktop.

## H0: spacing between consecutive tool rows (iOS, `reads-20`)

Measured from simulator screenshots at 3x (402 pt wide), same chat with and without the plugin (`beautiful-chat` disabled for the control, then re-enabled):

| | card/row height | gap between rows | row pitch |
|---|---|---|---|
| Plugin tool cards | 90 px = 30 pt | **72 px = 24 pt** | 162 px = 54 pt |
| Host native read rows (plugin off) | n/a (text rows) | **0** (rows touch) | 96 px = 32 pt |

Evidence: `raw-host/h0-ios-plugin-on.png` and `raw-host/h0-ios-plugin-off-host-native.png`. Each plugin tool row therefore costs 22 pt more than a native row (24 pt of gap, minus the plugin card being 2 pt shorter than a native row's 32 pt pitch). Over the 24 consecutive reads in the fixture that is about 24 x 22 = 528 pt of extra scroll height, more than the plan's estimate of 16 px per gap (about 320 px for 20 reads): the measured gap is 24 pt, not 16. Where the extra 8 pt comes from (the plugin card's own margin or a host spacing token) was not separated. Desktop spacing was not measured (blocked).

## Reproduce

```
# daemon: beautiful-chat from the worktree, bc-bench from the main checkout (see tools/bench-provider/README.md)
paseo --home ~/.paseo-bench plugin install <path> [--id <id>]
# per fixture, in the app (agent open): /bc-perf on, /bc-perf reset, then
paseo --home ~/.paseo-bench send <agent> "fixture:<name> speed:<n>"
# in the app: /bc-perf dump <name>      -> /tmp/bc-perf/<platform>-<name>-<ts>.json
node .showcase/tools/host-report.mjs ios   # regenerate the tables above from docs/bench/raw-host
```
