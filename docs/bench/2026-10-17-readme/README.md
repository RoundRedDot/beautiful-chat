# 2026-10-17 README comparison rerun

Status: completed all **630 planned attempts** under the user-authorized concurrent-max4 protocol: 550 replay and 80 long-history attempts. Structural source/identity audits pass; this is not a claim that all 630 attempts passed runtime/content validation.

[Replay results and A/A](parallel-v2/RESULTS.md) · [Long-history results](parallel-v2/history/RESULTS.md) · [Final audit](parallel-v2/raw/final-audit.json) · [Source and harness verification](parallel-v2/raw/provenance-after.json)

- Twenty iOS replay samples recorded display errors, making **17 platform/scenario/configuration groups** diagnostic. Six primary current-version iOS scenarios are N/A; the affected parent/A/A groups are also withheld from numeric comparisons. All 110 replay A/A pairs remain recorded, including 12 pairs with a display-error sample.
- One iOS long-history attempt (`incident-candidate-3-2`) timed out during `simctl pbpaste`. All three iOS incident/candidate phase cells and their A/A summaries are N/A. Seven quality-gate messages describe that one failed/unverified attempt; they are not seven independent failures. No successful subset supplies replacement medians.
- Candidate 4,624, parent 4,623 and Beautiful Chat 87 tracked files match their Git blobs before and after collection. Maximum actual sample and measured-phase overlap is four groups. No measured end-resource excursions occurred; the failed IPC attempt has one missing end snapshot, reported as unknown.
- All four dedicated benchmark simulators and private daemons are stopped; all 12 owned ports are clear. The protected Align205 simulator remains Booted, and both protected Android AVD process identities are unchanged. No daily plugin update, commit or push was performed.

The campaign first captured 18 serial formal Web samples, then changed execution by explicit user request. Their original bytes and SHA256 hashes remain in `raw/serial-transition.json`. They are diagnostic only and are never pooled into the new 630-sample parallel matrix under `parallel-v2/`.

The first parallel attempt also remains under `parallel/`: 27 formal replay samples and 20 calibration samples are diagnostic. Its WebSocket forwarding depended on the same Node event loop that synchronous CLI waits blocked, coalescing streamed updates. The entire attempt is excluded, not selected individual repetitions. `parallel/runner-attempt1.tar.gz` preserves its scripts and `parallel/lane*/raw/routing-invalid.json` records the stop boundaries. The corrected observer enables no WebSocket routing. An independent streaming regression proves 20/20 frames arrive during a blocked driver interval; a proxy control receives 0/20 during that interval. New private daemon homes and outputs are used for `parallel-v2/`, reusing the hash-verified fresh Web exports as immutable inputs.

## Frozen inputs

- Better Paseo: `b9dfae6e31453b962d90f7d3c7ca972c0e523cb3`, the latest local and remote `main` at campaign setup.
- Parent: `2fc6476acbdf75e8802668b0260cfd128513c990`.
- Beautiful Chat: `42b61d8301b5400a67821bbbfcf99fa8b681dc37`, original ID and default disclosure settings.
- Paseo host: `75953250959979b8f088bbca8dbd6ee61d0151b1` / 0.11.2, retained measurement-only row Profiler patches. Changing the plugin revision does not change this controlled host baseline.
- Mac Studio: Apple M5 Max, 18 cores, 64 GB, macOS 27.0.1. Fresh private daemons on ports 6891–6894, freshly exported production profiling Web builds on ports 8311–8314; Chrome 155.0.8059.40, 1280×900.
- iOS: dedicated `bc-perf-ios`, `4497FFF9-93D1-4713-B55B-A9988BC2209E`, iPhone 16 Pro / iOS 18.6, development Hermes app 0.11.2 / 11002999, Metro ports 8211–8214. Three further dedicated iPhone 16 Pro / iOS 18.6 simulators occupy lanes 2–4; their UDIDs and exact environments are recorded per lane. Cold launch before each replay/history sample.

Candidate, parent and actual registered Beautiful Chat source snapshots are compared against every tracked Git blob before and after collection. Dependency directories are reused and excluded from that source identity claim. The exact per-lane Web assets, host patches, fixture hashes, simulator identities and harness hashes are retained with the environment evidence. The retained host source and measurement patches have identical hashes across all four lanes; default daemon endpoints differ per build. Plugin source is unchanged.

The [post-collection native inventory](parallel-v2/raw/native-binaries-after.json) finds identical hashes for all six native executable files across the four simulators, with React 19.1.0, React Native 0.81.5, Reanimated 4.3.1 and Worklets 0.8.3 in every lane. This is an after-only binary/dependency inventory, separate from before/after tracked-source proof.

## Replay and regression matrix: 550 samples

Web and iOS each run 11 scenarios × 5 configurations × 5 repetitions = 275 samples. Configurations are no plugin (`native`), Beautiful Chat (`upstream`), current main (`fork`), a separate current-main A/A repeat (`aa`), and the parent (`parent`). Configuration order rotates by scenario and repetition. Each fixture/repetition assigns every configuration to the same lane, with `lane = 1 + (fixtureIndex + repetition - 1) % 4`, balancing each mode across four isolated groups. All Web work in all lanes completes before native collection starts. Up to four timed groups run concurrently; actual overlap varies and is reconstructed from start/end timestamps. Calibration is stored separately and does not replace formal samples.

Scenarios: code-block streaming, large diff, history replay, long reply, mixed turn, 20 reads, reasoning prose, reasoning sections, large shell log, table streaming, growing tool log with default disclosure. Speeds are unchanged: `history-100:max`, `tool-expanded-streaming:4`, all others `1`.

The public three-mode tables use five `fork` samples per group. Five `aa` samples independently expose same-version variability; parent comparisons use the same five `fork` samples, without pooling a larger current group against a smaller control. All 110 replay A/A pairs remain visible, including differences above 10%. A paired repetition can contain intervening controls because configuration order rotates; this is not necessarily an adjacent A/A run.

Host React.Profiler `allRows.sum` measures cumulative row-render work, not per-commit p95, whole-app CPU, native layout, frame rate or first-visible time. Web CDP reads main-thread Task time with `threadTicks`; forced GC and heap/DOM readings occur after the timed interval. Web CLS is recorded independently. Changes under 10% count as even; only whole-replay Web Task time additionally counts both values below 0.5 seconds as even. Heap uses signed MB differences.

Parallel admission requires CPU idle ≥15%, memory free percentage ≥10%, and pressure level 1, with a second check after setup. Load averages are recorded but are not a parallel cutoff. Formal replay/history records start/end resource evidence and per-lane activity. End-resource excursions are retained and flagged. These are descriptive medians under the same resource policy, not uniform fixed-concurrency throughput or guaranteed stable improvements. Existing protected simulators/emulators remain untouched.

`history-100` is a fixture name, not 100 provider turns. `tool-expanded-streaming` performs no explicit expand action. Beautiful Chat opens running tools by default; Better Paseo keeps them collapsed. These runs do not establish forced-expanded-body performance.

Replay page/collection failures block the structural audit, except that an already measured display-only failure is preserved as diagnostic. Any display error makes the entire scenario/configuration group diagnostic; no clean repetitions are selected to conceal an error. Long-history runtime/content-gate failures make affected groups N/A, while planned identities and source/shape/admission checks remain mandatory. Existing output is never overwritten and failed attempts remain in evidence.

## Long-history matrix: 80 samples

The retained `history-complete-v1` input has SHA256 `401cba25910431543cb9be5a68110674825e0204701ace37678d809f8c9725e7`. It preserves 810 entries / one provider turn and a 59,427-character tail reply. A second scenario has 832 entries / 12 provider turns. Distinct equal-length synthetic reasoning tags avoid the original duplicate-key input; successful results do not establish a production fix for that original case.

Each platform/scenario runs five candidate A/A pairs, five no-plugin controls and five Beautiful Chat controls. Repetition `r` uses lane `1 + (r - 1) % 4`; every A/A pair and its controls share that lane. All modes therefore have the same lane distribution. Fresh untimed seeding is read back through the daemon API, checking counts, actual turn boundaries, page cursors and exact fixture hash.

Measured phases are cold opening, first real wheel/HID older-history reveal, and whole-session unmount/return. The third phase changes the host pane to an empty `draft`, proves target unmount, and returns through the live draft pane without archiving the synthetic agent. It is not independent Markdown-block remount during scrolling. Numeric candidate groups require copying all 59,427 source characters both before reveal and after return. All 80 planned attempt identities and all 36 phase cells must be represented. A failed attempt makes its entire platform/scenario/mode group N/A in every phase and A/A summary; no successful subset supplies a replacement median. Source, fixture, canonical shape, admission and identity mismatches still block publication. JS-ready proxies and unfiltered timer/rAF gaps remain separate from row work.

## Screenshots and publication

All 52 published themed PNG assets are recaptured from the same fixed production source using the offline React Native Web showcase. Hero captures use 2× scale; feature and English/Chinese settings captures use 1×. Capture runs on the local laptop, avoiding Studio timing interference. The phone frame and fixture data are illustrative, not native device acceptance. `docs/images/screenshots.json` records source SHA, capture source hashes, dimensions and image hashes.

Only this round's audited data will replace public tables and charts. Earlier campaigns remain intact as historical evidence. No commit, merge, push or daily plugin update is included. Cleanup restores this private daemon's original plugin pointer/enabled states, stops only owned processes and shuts down only the four dedicated benchmark simulators. The daily daemon, Align205 simulator and protected Android AVDs are excluded.

## Reproduction after collection

```bash
node docs/bench/2026-10-17-readme/tools/aggregate.mjs /tmp/bc-readme-20261017
node docs/bench/2026-10-17-readme/tools/update-readme.mjs .
node docs/perf/readme-charts.mjs
node docs/bench/2026-10-17-readme/tools/history-charts.mjs .
node --test docs/bench/2026-10-17-readme/tools/*.test.mjs
node --test docs/bench/2026-10-17-readme/history/tools/*.test.mjs
node --test .showcase/tools/readme-shots.test.mjs
git diff --check
```

Preparation and collection scripts are explicitly bound to this retained Studio environment, not general-purpose installers. The aggregate step runs on Studio while lane roots are retained; public generators and tests run from the repository after the evidence has been downloaded.

The [transfer receipt](evidence-transfer.json) verifies all 2,096 downloaded files against archive SHA256 `3ef58c078a3a554bafce979a85ff8df2fec6694c5cf5f5b9abcd0c17f4328286`. Daemon homes, credentials, browser profiles, dependency directories, source snapshot trees and Web bundles are excluded. Large raw JSON and logs are stored as gzip with byte-exact roundtrip checks and uncompressed/packed SHA256 hashes in each `packing-manifest.json`. A recorded `.json` path refers to the decompressed bytes of its `.json.gz` counterpart. Studio originals remain untouched. Current source scripts and public generators remain directly readable.

## History calibration correction

The first complete-history Web calibration failed its actual-unmount gate in all four fresh daemon workspaces. The host automatically replaces a sole `new_tab` with its active agent, leaving that timeline mounted. The failed `smoke-incident-candidate-1` samples remain diagnostic. A separate diagnostic proved that the host's empty conversation `draft` target removes the timeline; returning through the live draft pane restores the original agent without archiving it. All formal Web and iOS history samples use this explicit draft operation. No production source or fixture changed. `parallel-v2/provenance-history-amendment.json` preserves the before/after harness hashes and proves zero formal history samples existed at that transition; the pre-change source archive is retained. The 275 completed valid Web replay samples are preserved unchanged.

## First older-reveal preparation correction

The first draft-based Web history attempt captured 14 samples before the early-reveal guard rejected preparation: the old untimed `scrollTop = 700` jump could advance pagination after virtualized scroll re-anchoring. The host's history-start threshold is 96px. The entire 14-sample attempt, including successful samples, is retained under each lane's `history/raw/web-prep-v1/`; its seeds, logs and source archive remain separate. It is not pooled with the new history matrix.

All published Web history samples now start the measured older phase from the tail and use a real full-height wheel input, with **no untimed pre-scroll**. Every mode receives that same operation. The native protocol retains its recorded positioning and real HID drag, with an explicit guard against pagination during positioning. The preparation amendment records excluded sample hashes and the exact before/after source hashes before the replacement formal matrix starts. Web calibration repeats each of the three modes twice per lane before the formal history barrier.

## Native first-launch calibration

The initial iOS history calibration passed lane 1 but failed the candidate copy gate in lanes 2–4: their first-launch notification permission alert covered the Expo developer-menu onboarding. The original `smoke2-*` JSON, screenshots and logs remain diagnostic. The observed notification alerts were declined, the developer introduction continued, and the developer menu closed in those three dedicated simulators. All four lanes then repeated the three-mode history calibration with fresh `smoke3-*` agents before the formal iOS barrier. No production source, fixture or measurement harness changed at this transition; `tools/resume-ios.sh` records the resumed sequence.

## Retained native display failure

The first iOS `fork/diff-large/r1` sample recorded `Exception in HostFunction` in the host worklets UI queue. Its original JSON and stack are retained without rerunning or replacing that identity. The whole platform/scenario/configuration group is diagnostic and must appear as N/A in public comparisons, even if its other repetitions render cleanly. The collector originally stopped on non-baseline display errors; its continuation policy was made uniform across all configurations, preserving completed timing and separately flagging display errors. Other collection failures still stop collection and block publication. `parallel-v2/provenance-replay-display-policy-amendment.json` records the transition, hashes all eight iOS records already captured, and retains the previous source archive. No timing operation, fixture, production source, lane allocation or admission policy changed. Any A/A pair involving a display-error sample is diagnostic as recorded in the full summary.

## Repository validation

Validation runs on the local laptop, separately from Studio measurements. The benchmark/publication harness has 13 passing tests, the long-history harness 11, and screenshot validation 2. Type checking and Hermes compilation plus stock/sticky registration checks pass. These checks validate the tooling and build boundaries; they do not establish physical-device acceptance.

The full existing unit suite has 2,146 passes and six failures: two in `test/unit/live-turn-footer.test.ts` and four in `test/unit/p4-highlight-equivalence.test.ts`. The same six failures reproduce against the unmodified parent `2fc6476` with the same installed dependencies (253 focused passes, six failures). This documentation task does not alter those production paths or tests. Exact logs and counts are retained in [validation evidence](logs/validation/summary.json).

## Retained long-history IPC failure

The iOS `incident-candidate-3-2` attempt timed out in `xcrun simctl pbpaste` (`NSPOSIXErrorDomain`, code 60) after cold opening. Its original record is retained without a replacement run. The report now distinguishes structural audit failures from recorded runtime/content-quality failures: any runtime or content-gate failure makes all three phase cells of that platform/scenario/mode N/A, and all five A/A identities remain visible as diagnostic. Partial phase data stays in the original record; missing intervals are explicitly listed rather than fabricated. This changes reporting only, without changing collection, fixtures or production code. `parallel-v2/history-reporting-before.tar.gz` preserves the prior reporting sources, and `parallel-v2/history-reporting-policy.json` records the new source hashes and the preserved failed sample.

`parallel-v2/history-reporting-final.json` chains the final reporting correction: archival state and end resources missing after the IPC error are unverified, rather than inferred to have changed or exceeded pressure limits. The aggregate was regenerated from the same original records and passed structural audits again.
