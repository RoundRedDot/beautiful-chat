# 2026-10-16 full README performance rerun

Status: complete. All timing and runtime validation ran on Mac Studio; public README numbers and charts use only this round. Changes remain uncommitted in the isolated `perf/readme-20261016` worktree.

Final repository readback: other work advanced `main` to `c4c9f3f` during this campaign (`0e53757`, `c4c9f3f`, turn-detail hover/expansion changes). This campaign remains pinned to `48a6646`; its results do not validate those later changes. The main worktree's unrelated `.agents/` and `docs/plans/2026-10-16-paseo-pr-review-follow-up.md` remain untouched.

## Results and acceptance

- Replay: **330/330 complete**, 66 groups of five, zero collection failures or display-error groups. All start/end load readings stayed within the ≤4 gate.
- Long history: **Web 40/40 + iOS 50/50 complete**. All 20 candidate runs on each platform passed exact full-copy and older-reveal gates; all 20 native candidate remounts passed. Web retains these long-reply blocks in its recent segment, so Web remount is N/A.
- Native Beautiful Chat emitted **9 duplicate-key error lines** in its historical namespace. All 10 native baseline-history runs are diagnostic, leaving 40 native history runs eligible. Only the native baseline group is excluded; all 10 error-free Web baseline samples are included in the public tables and charts. Replay baseline groups have no display errors.
- Continuous native scroll: **103 HID actions, all 70 long-reply blocks observed**, exact 59,427-character copy after returning to the tail. Longest timer gap was 132.6 ms outward / 124.8 ms on return; no ≥1-second timer stall in this check.
- Studio validation: **10 harness tests + 133 focused component tests passed**; typecheck and Hermes compile / both registration modes passed. Source readback found zero mismatches across candidate 3,092 files and upstream 87 files, including the actual registered upstream directory.

The result is mixed against no plugin. Web Task time has 9 lower / 1 even / 1 higher scenarios; row-render work has 9 lower / 2 higher. The Web history replay remains slower: 0.864 s versus 0.737 s Task time, and 214.9 versus 157.8 ms row work. iOS row-render work has 3 lower / 3 even / 5 higher scenarios; compared with Beautiful Chat, 10 lower / 1 even. The bilingual README retains these regressions.

For cold opening existing history, native candidate row work is 116.9 / 118.9 ms (810 / 832 entries), versus 496.1 / 495.4 ms before the fix (`57f995d`) and 147.4 / 147.6 ms without a plugin. Candidate JS-ready proxies are 620.4 / 628.0 ms, versus 1,055.8 / 1,055.0 ms before the fix. These are different from first-usable viewport and native commit times.

Older reveal is not a uniform win: native candidate row work is 162.4 / 214.1 ms, versus 178.1 / 179.9 ms without a plugin and 176.4 / 137.9 ms before the fix. The candidate's maximum paired A/A row-work differences are 85.3 / 67.0 ms for this phase, compared with 5.7 / 2.4 ms for opening and 17.5 / 14.3 ms for remount. Row sets differ across renderers and reveal steps; do not interpret these totals as equal-work throughput or an isolated footer attribution.

| Evidence | Contents |
| --- | --- |
| [Detailed results](RESULTS.md) | Group medians, full ranges and A/A spread |
| [Replay summary](raw/summary.json) | Complete matrix audit and all metrics |
| [Native history audit](history/raw/audit.json) / [summary](history/raw/summary.json) | Structural, display, copy and remount gates; per-phase metrics |
| [Web history summary](history/raw/web-summary.json) | Forty samples, phase ranges and A/A pairs |
| [Validation logs](logs/) | Harness, component, typecheck, Hermes and collection logs |
| [Cleanup readback](raw/cleanup.json) | Restored private plugin pointer/state and stopped owned resources |

The private plugin pointer and enabled state were restored before stopping its daemon. Owned ports 6871 / 8085 / 8092 have no listeners, and `bc-perf-ios` is shut down. The protected `Align205-iPhone17Pro` and both protected Android emulators remain running. Source directories and evidence are retained. The daily daemon, commit history and remote branches were not changed.

## Scope and pinned inputs

- Studio: `rrd-mac-studio`, Apple M5 Max / 18 cores / 64 GB / macOS 27.0.1.
- Host: Paseo 0.11.2, `75953250959979b8f088bbca8dbd6ee61d0151b1`; measurement-only row Profiler and profiling-renderer patches are retained under `raw/`.
- Candidate: `48a6646bebc42b34baf7db6268c759079faefb5d`, unmodified production plugin source.
- Beautiful Chat: `42b61d8301b5400a67821bbbfcf99fa8b681dc37`; its original `beautiful-chat` plugin ID and locked dependency installation are preserved.
- No plugin: both chat plugins disabled; synthetic `bc-bench` remains enabled solely as a replay provider.
- Private daemon: `/Users/rrd/.paseo-bench-p0p1`, port 6871. Daily port 6767 is excluded from browser connections and is not modified.
- Dedicated simulator: `bc-perf-ios`, UDID `4497FFF9-93D1-4713-B55B-A9988BC2209E`, iPhone 16 Pro / iOS 18.6, `sh.paseo.debug` 0.11.2 / build 11002999, development Hermes.
- The reported physical device is iPhone 15 Pro. Its OS/client versions and physical Release acceptance are not established by this campaign.

The source Git-blob audit covers every tracked file, including the actual registered upstream directory. Dependency directories are excluded from this source identity claim. The Web host is freshly exported from the retained host checkout, with `BC_REACT_PROFILING=1` and `EXPO_PUBLIC_BC_HOST_PERF=1`; the main JS hash is in `raw/environment.json`. Candidate feature settings use schema defaults. Replay measurements and native-history measurements explicitly enable candidate counters and let preference work settle before resetting probes. Web history measures the cold document with the host probe only; it does not enable the candidate's extra counters during that opening.

Defaults are part of the comparison: Beautiful Chat opens running tools, while Better Paseo keeps them collapsed. This is not a comparison with every tool forced into the same expanded state. The historical fixture name `tool-expanded-streaming` is misleading: neither the old runner nor this protocol performs an expand action. It is now labelled “Growing tool log (defaults)”; it does not establish expanded-body performance. A forced-expanded comparison needs its own verified input procedure and remains separate.

## Replay matrix

Web and iOS each run 11 fixtures × 3 modes × 5 repetitions: **330 planned formal samples**. Runs are serial, rotating mode order per fixture and repetition. Web completes before iOS starts; no parallel benchmark simulators. Every timed replay gets a fresh synthetic agent; iOS cold-launches before each sample, and Web reloads the production page. The synthetic provider is not an intelligent delegated coding agent.

Fixtures: `codeblock-streaming`, `diff-large`, `history-100`, `markdown-long`, `mixed-turn`, `reads-20`, `reasoning-long-prose`, `reasoning-long-sections`, `shell-log-large`, `table-streaming`, and `tool-expanded-streaming`. Speeds match the earlier documented scenario definitions: `history-100:max`, `tool-expanded-streaming:4`, others `1`.

`history-100` is a fixture name, not proof of 100 actual provider turns. The public captions use “History replay”. A replayed user-message item does not start another provider turn.

Primary render measure: host `React.Profiler` `allRows.sum` over the whole replay, not per-commit p95. Web main-thread Task time comes from CDP `Performance.getMetrics` with `threadTicks`; GC occurs after the timed interval, followed by JS heap / DOM-node readings. Heap is not total application/process memory. Layout shift is captured separately. The older host frame meter ignores gaps over one second; frame statistics from that meter are not used to claim that a freeze is fixed. The separate history meters retain multi-second gaps.

The start-load gate is the Studio one-minute load average ≤4. End-load excursions are retained and flagged rather than silently discarded. Group medians and full ranges are retained. Five repetitions do not establish a formal confidence interval; close comparisons remain sensitive to host noise. The public presentation calls under-10% differences even; only whole Web Task comparisons also use the both-under-0.5-second rule. Memory uses signed MB differences without that rule.

Each sample records fixture hash, renderer identity, source revision, host row kinds, load, completion and page/display errors. One display error makes the entire fixture/mode group diagnostic; samples are retained, and public comparisons show N/A. Page errors or incomplete runs fail the matrix. Measurements from the historical October 15 round are not mixed into the new charts.

## Existing long-history matrix

Separate fresh seeding precedes every timed opening; seeding is untimed and read back via the daemon API. The fixture hash and cursor/epoch/count validation are in each seed record.

- `incident`: 810 projected entries, 12 user messages, 260 reasoning items, 398 tools, 140 replies, **one actual provider turn/footer**, longest reply 59,427 characters.
- `multi-turn`: 11 real boundary turns, then the full incident-shaped turn: 832 entries / **12 actual provider turns/footers**.
- Per platform/scenario: five candidate A/A pairs, five no-plugin controls, five Beautiful Chat controls. iOS additionally repeats five pre-fix `57f995d` controls per scenario for diagnosis. Planned total: Web 40 + iOS 50 = **90 formal history samples**.
- Opening, first older-history reveal and long-reply block remount are separate phases. Preparation offsets are recorded separately; measured history reveal and remount use actual Playwright wheel input or AXe native HID drags, not direct pagination callbacks.
- Remount is N/A if a renderer has no independently virtualized long-reply block at that boundary. Web uses the host's actual `historyVirtualized` / `historyMounted` segments: a retained recent block is not an unload/remount target. Fewer mounted rows do not establish equivalent work.
- Candidate copy gates reset the clipboard sentinel and require the exact 59,427-character source text with one visible copy toolbar.
- The native continuous-scroll run is a separate functional check: all long-reply blocks must enter the mounted set while traversing out and back, with exact full-copy verification after returning.

Paseo 0.11.2 can return an expanded tail because of overlapping tool lifecycles. Record requested limit, actual returned entries and serialized payload size. Do not reduce the limit for just one variant. The first older reveal may expose cached entries without a new RPC; its progress-key numbers are local window indexes, not necessarily remote cursor sequence numbers.

JS-ready proxies are explicitly limited: native waits for authoritative history, measured viewport and a mounted row; Web waits for authoritative timeline props and mounted DOM rows after a cold document navigation. The clock origins differ across platforms. Neither is native commit time or proven first-usable viewport time. Host row-render work excludes native layout and whole-app CPU. Simulator relative measurements do not establish iPhone hardware frame rate, memory pressure, thermals or Release performance.

RPC probes wrap host timeline-page requests, not the plugin server's footer RPCs. Canonical footer counts come from seed/API readback, not a claim that every offscreen footer was mounted. The continuous-scroll/copy gates and focused component tests provide separate functional evidence. This rerun does not isolate the cost of an individual footer change.

Historical Beautiful Chat duplicate-key errors are a known risk for this fixture. The full diagnostic group is retained and marked unavailable if errors recur, rather than selecting the cleaner repetitions. Display validity is platform-specific: the native display audit excludes only the native group; valid Web samples remain comparable.

## Calibration and validation

All smoke runs are outside the formal matrix. Early Web calibration found a `/tmp` versus `/private/tmp` canonical-path check mismatch; fixed by canonicalizing both sides. One subsequent preflight launch collided with the still-running calibration Chrome profile; its launch failed before a sample and was retained as `web-smoke3-profile-busy.log`. The runner then waited for that owned calibration process to finish and restarted serially. No formal timing sample is replaced by either calibration attempt.

The first Web-history smoke passed opening, older reveal and exact full copy, but failed the remount gate: its chosen block belonged to the host's retained recent segment and never unmounted. The corrected probe records segment membership and selects only an actually virtualized block. Where none exists, the result and A/A remount delta are N/A, not zero. The failed `smoke-incident-candidate-1.json`, failed post status and log are retained separately; `smoke2-` passed before all 40 formal Web-history samples. No production source was changed.

Harness unit tests cover the under-10% / Web-only small-replay rules, group-wide error exclusion, multi-second timer/rAF stalls, RPC receiver/expanded-page preservation, and viewport ownership. Production plugin tests, typecheck and Hermes checks run on Studio after timing work so validation does not contaminate samples.

## Reproduction and review

The scripts reference the retained, explicitly private Studio environment. `tools/campaign.sh` runs replay measurements; `tools/post-campaign.sh` waits for that exact campaign and then runs history measurements and validation. They refuse sample overwrites. The setup is not a general-purpose installer and must not be pointed at a daily daemon or another user's simulator.

After collection:

```bash
node docs/bench/2026-10-16-readme/tools/report.mjs docs/bench/2026-10-16-readme/raw
node docs/bench/2026-10-16-readme/tools/update-readme.mjs .
node docs/perf/readme-charts.mjs
git diff --check
```

Detailed JSON samples, original logs and the host patch may be stored as gzip; packing hashes and exact decompression checks are recorded in `packing-manifest.json`. The replay report and public generator read them directly. The native-history audit requires plain files: use `tools/unpack.mjs <benchmark-directory> <new-review-directory>` to inflate a separate review copy; it refuses an existing target and never edits the captured source.

Only the isolated worktree is edited. No commit, push, merge, daily plugin update, protected simulator shutdown, or protected AVD operation is part of this task.
