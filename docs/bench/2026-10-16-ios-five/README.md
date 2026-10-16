# iOS five regressions: isolated diagnosis and fix

Status: **committed, pushed to main and deployed after explicit user authorization; concurrent Studio core 100 + iOS risk 60 + Web risk 60 completed with zero audit failures; owned resources cleaned up**.

最新正式验证见 [并发报告](parallel/README.md) 与 [协议](parallel/PROTOCOL.md)。本批直接比较 `7f01b2d` parent 与已部署 `722238d` fixed，制度为 `concurrent-max4`，与旧串行校准分开。五项尚未全部达到 native 持平，且 A/A 有波动标记。下文旧 c4 candidate/source 与独占排期叙述保留为诊断历史，不代表当前源码或调度状态。

## Authorized deployment on 2026-10-16

- User requested commit and deployment. The four source/test files were committed, rebased onto latest `7f01b2d`, fast-forwarded into main and pushed as `722238de2fcc1ade46d542a7a540868932d9dc89` (`fix: avoid redundant tool and reasoning subtree renders`). Author/committer are `luke <luopeihuan@gmail.com>` with the RoundRedDot co-author trailer.
- Updated only the local daily daemon at `luoph-mbp`, `127.0.0.1:6767`, using `paseo plugin update better-paseo --ref 722238de2fcc1ade46d542a7a540868932d9dc89 --json`. Independent readback confirms enabled/running at the exact revision, byte-identical deployed production files, and a new `Plugin ready` log. No daemon restart. Rollback revision: `7f01b2d95c87cb6879adf701571de3778a167060`.
- On the integrated revision, full suite: **2,128 passed / 4 failed**, 111 files. The same four `p4-highlight-equivalence` Markdown/HTML snapshot failures were independently reproduced on unchanged `7f01b2d`; they are existing failures, not a clean full-suite pass. Typecheck and Hermes compile/stock/sticky registration passed.
- [Deployment readback and file hashes](raw/deployment-722238d.json), [deployed production patch](raw/production-deployed.patch.gz), and compressed `deployment-*.log.gz` retain the evidence. The earlier `production.patch` and `fixed-source.json` below describe the original c4-based candidate and are historical snapshots, not the integrated deployment manifest.
- Studio's pinned long-history campaign was not changed. Its current matrix remains c4-based. The later fixed performance matrix must identify the deployed revision and its `7f01b2d` parent separately; it must not call the difference from c4 solely this two-file patch. iPhone 15 Pro Release performance remains unverified.

## Source and boundaries

- Worktree: `beautiful-chat/.worktrees/ios-five-regressions-20261016`, branch `fix/ios-five-regressions-20261016`.
- Base: `c4c9f3f57c43a72b2b8fccc91030eb19df6e500d`; base tree `dca92c3e280ef73d89c110b0813b1daeb7e7a068`.
- Historical c4-based production patch: [`raw/production.patch`](raw/production.patch.gz), SHA256 `ffbbdcc8cccbe93cb41a079f812f4056993a2372db4e230570ecb4d02278eb8c`.
- Historical [`raw/fixed-source.json`](raw/fixed-source.json) contains 3,092 tracked source blob hashes including the four changed files. It describes the old c4-based candidate. The current integrated manifests are `parallel/raw/{parent,fixed}-source.json`; no old candidate snapshot is used in the concurrent matrix.
- Old report/source/data at `perf-readme-20261016` and `/tmp/bc-readme-20261016` were read only. Historical `48a6646` results are not current c4 results.
- Host remains `75953250959979b8f088bbca8dbd6ee61d0151b1` with its existing measurement-only patch. Local Git objects at that exact SHA supplied the reveal implementation for review.

## Current-base calibration (diagnostic only)

Ten fresh-agent iOS samples completed serially on Studio. Each cold-launched the dedicated simulator client; all start loads were <=4 and no display error was reported. This is **one run per mode per fixture**, not a five-run acceptance matrix or an A/A estimate. All ten remain outside formal speed conclusions.

| Fixture | Native row work, ms | c4 row work, ms | Difference | Fixed result |
| --- | ---: | ---: | ---: | --- |
| diff-large | 54.296459555625916 | 67.4744371175766 | +24.2704% | Pending |
| reads-20 | 283.58673310279846 | 340.77443850040436 | +20.1659% | Pending |
| reasoning-long-prose | 302.7510395050049 | 360.5222125053406 | +19.0821% | Pending |
| reasoning-long-sections | 253.5563439130783 | 339.0879203081131 | +33.7328% | Pending |
| tool-expanded-streaming | 206.6564189195633 | 329.30581510066986 | +59.3494% | Pending |

A 747 ms red-test invocation mistakenly ran on Studio at 05:43:03 UTC during `ios-native-reasoning-long-sections-r1` (timed interval 05:42:49.023 UTC plus 18,280 ms). The sample and original test log are retained. No calibration sample is promoted into the formal matrix. The initial comparator's `REGRESSION` label is a red-capable diagnostic signal, not an acceptance verdict.

The metric is the same host React Profiler **`allRows.sum` over the replay**, not per-commit p95. `tool-expanded-streaming` uses the default disclosure state and performs no expand action; it is a growing-log default-state test, not an expanded-body benchmark. `history-100` remains a fixture name, not a count of real provider turns.

## Confirmed redundant-work patterns and patch

1. **Tools (`diff-large`, `reads-20`, growing log):** `useTimelineToolGroup` returned its previous singleton array while the current tool was already available through props. Its layout effect then published that same result, causing another renderer invocation. The regression test exercises the real registered renderer/store path: before the fix an update rendered twice; current singleton snapshots render once in one pane and once per pane in two panes. Existing merged-group, changing-path, spacing, unmount/remount and multi-pane cases remain covered. This confirms a redundant path; its contribution to each fixture's remaining native gap is not yet measured.
2. **Both reasoning fixtures:** the host `useRevealedText(text, "complete")` settles in a passive effect and rerenders its parent. The segmentation and card props are unchanged on this second pass. `memo(ReasoningCard)` keeps this duplicate pass out of the card subtree while retaining the host's full text tracking and normal streaming pacing. Parent hook settlement still occurs; this patch does not claim to eliminate every row commit.
3. **Rejected diagnostic implementation:** an empty collapsed hook input removed parent settlement but made opening mid-stream start from empty text. A more faithful mock caught the empty expanded body. That implementation is retained only as `raw/rejected-empty-input.patch` and is not the candidate. The final test verifies one card render, current collapsed preview, immediate existing body on opening, and the exact current copy-source string.

Production changes remain confined to `client/timeline-order.ts` and `client/live-renderers.tsx`. No feature/default/content was removed, no dependencies were added, and footer/history code was not changed.

## Validation and remaining work

- Local focused functional suite: **14 files / 247 tests passed**, covering the changed call sites plus grouping, panes, spacing, disclosure, reasoning segmentation, previews, copy content, assistant splitting and footers.
- Local `npm run typecheck`: passed.
- Local `npm run check:hermes`: compile passed; stock/sticky hosts each registered `6 transformers, 6 renderers, 1 settings screen`.
- Local harness audit tests: **5 passed** (unrounded iOS threshold, group-wide diagnostic exclusion, A/A pairing/ranges, missing repetitions/source identity, load gates).
- The original serial matrix proposal is superseded by the explicitly authorized [concurrent protocol](parallel/PROTOCOL.md): five fixtures x five repetitions x `native,parent,fixed-a,fixed-b` = 100, followed by 60 iOS and 60 Web risk samples. The core has completed; all modes, ranges, sources and A/A flags are retained.
- Integrated focused/typecheck/Hermes evidence above remains valid; no production source changed during the new performance campaign. Functional expanded-body smoke is separate from timing, and does not establish expanded-body performance.
- The main session owns the new long-history fixtures/missing-phase calibration and N/A resolution. Coordinate cold-open/older/remount/full-copy acceptance with it; do not edit old captures or invent a remount value when the target never unmounted.
- iPhone 15 Pro physical Release acceptance remains open; simulator development-Hermes results cannot establish it.

## Studio release

At **2026-10-16 05:46:10 UTC**, current replay had naturally finished and Studio was released to the main session. [`raw/cleanup.json`](raw/cleanup.json) records the restored private plugin state and pointer, stopped owned services, dedicated simulator Shutdown, protected simulator Booted, both protected AVD processes preserved, and no listeners on 6871/8085/8092.

That release closed the initial serial calibration phase. The user's later authorization started three independent new environments under `/tmp/bc-ios-five-parallel-20261016`; their cleanup and actual concurrency are recorded separately in the parallel report. The old cleanup record is not proof that the new environments have stopped.

## README review-copy storage

Original log and patch bytes with trailing whitespace are stored as gzip in this documentation copy; [copy-packing-manifest.json](copy-packing-manifest.json) records their exact uncompressed hashes. The parallel evidence index describes original archive paths: read the original file or inflate its `.gz` companion when verifying. The original campaign archive and the worker worktree remain unchanged.
