# Complete long-history comparison: independent follow-up

Status: **80/80 collected and audited, all 36 row-work cells measured, zero collection/display failures**. Evidence is preserved independently of the older 420-run campaign. The separate deployed-fix 220-run matrix remains in progress and is not part of this history report.

## Completed evidence and limits

- Web 40/40 and iOS 40/40 complete; each scenario/platform has 10 candidate samples (five A/A pairs), five no-plugin and five Beautiful Chat controls. All 80 prove older reveal, whole-session unmount/return and unique row IDs. All 40 candidate samples pass exact 59,427-character copying both before reveal and after return.
- All 36 row-work cells are numeric; full medians, ranges, JS-ready proxies and timer gaps are in [RESULTS.md](RESULTS.md). The summary and raw records preserve all metrics, A/A pairs and admission/end-resource checks. The original duplicate-key input remains an unresolved historical input case; successful uniquely tagged input does not establish its fix.
- Web finished before concurrency preparation. iOS has 17 samples before the reported preparation boundary, three further samples under the old load gate that can overlap preparation, and 20 with explicit concurrent-resource admission. Do not pool this into a uniform controlled speedup claim. `incident-native-5` has an end-load excursion retained in the summary.
- Candidate iOS older-reveal A/A row-work differences reach **90.8 ms** in the 810-entry scenario and **62.3 ms** in the 832-entry scenario. The host can render different row sets during reveal; small differences between modes are not reliable wins. Cold-open/return totals and JS-ready proxies remain distinct metrics.
- Final source audit: candidate c4 has 3,092 blobs; both original/registered Beautiful Chat sources have 87 blobs each; zero mismatches. Host remains pinned to `759532509`. Eleven local harness tests pass, including byte-preserving evidence packing and report CLI invocation through symlinks. A `/tmp` versus `/private/tmp` CLI-entry check initially skipped report generation; the canonical-path check and a subprocess regression test corrected it before publishing any new result.
- Group 1 cleaned up at **07:12:05 UTC**: its private daemon supervisor 99104/listener 99106, own Metro and Web stopped; ports 6871/8085/8092 read back clear; `bc-perf-ios` Shutdown; protected Align205 Booted and both AVD PIDs preserved. [Cleanup readback](raw/cleanup.json). The private plugin pointer and enabled states are restored; parallel lanes remain under their own owner.

The downloaded collection archive SHA256 is `c2fa9acbd06bd4e4056412a1d135becbb685bd166a7aed7a0cab05ef7c3437ae`. Raw samples/seeds and logs may be stored as gzip with byte-exact roundtrip and SHA256 records in `packing-manifest.json`; control JSON and screenshots remain directly readable. `tools/report.mjs` reads plain or compressed samples. To unpack a separate review directory, use `../2026-10-16-readme/tools/unpack.mjs` with this benchmark directory and a new output path.

## Authorized concurrency transition

The user subsequently authorized up to four isolated groups on Studio. Group 1 continues this history campaign; lanes 2–4 independently validate the deployed five-regression patch. The worker reported preparation beginning at **2026-10-16 06:39:42 UTC**. [Preparation metadata](raw/concurrency-preparation.json) records this earlier boundary, the reported resource policy and group-1 records potentially affected; [the original transition record](raw/concurrency-transition.json) is preserved. Preparation start is not the first concurrent timed sample: final overlap must be checked against the worker's actual execution intervals.

Web collection finished before this transition. iOS records before and after it must be identified separately; mixed totals must not be described as a uniform serial performance comparison. Existing sample bytes remain unchanged, and no successful sample is overwritten. The separate fixed-patch batch balances native/parent/fixed A/A within each lane and reports lane-specific ranges and A/A stability.

Group 1's original runner was stopped only while waiting at the pre-timing load gate, after 60 successful samples. `raw/resume-boundary.json` retains their SHA256 hashes and the exact owned PID; the original runner is preserved in `raw/run-native-before-concurrent.mjs`. The resumed runner skips those completed tasks, reuses the already prepared untimed seed, and records `executionRegime=concurrent-max4`, resource snapshots and lane activity for new samples. Its gate matches the other lanes: CPU idle ≥15%, memory-pressure free ≥10%, and pressure level 1; load averages are recorded without the obsolete ≤4 gate. The original campaign's signal exit is a scheduling transition, not a failed timed sample; follow `resume.status` and `logs/ios-concurrent.log` for active collection. Nine harness tests passed before resuming.

## README screenshot refresh

The README's 27 published PNGs were recaptured locally from clean tracked source `7f01b2d95c87cb6879adf701571de3778a167060` on 2026-10-16. Both hero themes use 2x scale; the remaining feature and English/Chinese settings captures retain 1x scale. These are offline React Native Web showcase scenes, including the illustrative phone frame, not device acceptance. Local capture did not occupy Studio or overlap its CPU workload. Source revision, dimensions and SHA256 for every published PNG are recorded in [the capture manifest](raw/screenshots.json). The performance campaign remains pinned to `c4c9f3f`; screenshot refresh does not validate the later model-name-copy change for performance.

## Protocol and scope

- Source candidate: `c4c9f3f57c43a72b2b8fccc91030eb19df6e500d`, unmodified. The separate five-regression worker's fixed patch is not part of this matrix.
- Beautiful Chat: original `42b61d8` source and locked dependencies, original plugin ID and defaults. No plugin is the third control.
- Same pinned Paseo `75953250959979b8f088bbca8dbd6ee61d0151b1`, identical measurement-only host row probes. Web production profiling export from the prior campaign is reused; native remains iOS 18.6 / iPhone 16 Pro development Hermes on Studio.
- New fixture `history-complete-v1`: same 810 projected entries, item-kind counts, lifecycle overlap and exact 59,427-character tail reply. Each of the 260 reasoning texts has a distinct synthetic tag, keeping its original 550-character length. This avoids identical text/timestamp ID seeds at separately hydrated page boundaries; it is a new comparison input, not a fix or acceptance of the original incident fixture.
- Second scenario adds 11 true small provider turns before the large turn: 832 entries / 12 actual turns. The first scenario has one actual provider turn. Seeded page/cursor/epoch/count readbacks remain mandatory.
- Each platform/scenario has five candidate A/A pairs plus five no-plugin and five Beautiful Chat runs: **40 Web + 40 iOS**, serial and rotating order. The Studio one-minute load gate remains ≤4 before timed work. Failures and end-load excursions are retained.

## Three measured phases

1. Cold opening a fresh synthetic agent; host row work plus JS-ready proxy and unfiltered timer/rAF gaps.
2. First actual wheel/HID older-history reveal; preparation is untimed and cannot already advance the recorded source boundary.
3. **Whole-session view unmount and return**, including the long reply. The host's pane target changes to `new_tab`, the probe must observe that the target agent's viewport is absent (including hidden trees), then a live pane context restores the same agent. Probe reset happens after leaving and before return. This is not independent-block scroll remount, browser document reload, or native commit time.

Beautiful Chat's default enhanced user bubbles leave zero Web virtualized rows in the original fixture. Merely moving the long reply cannot produce an unload there. Whole-session return is the common operation approved by the user; settings are not weakened to force a block-remount result. The target switch does not archive the agent or change its history.

All modes must complete every phase, retain unique projected row IDs, render the asserted source, and show no display errors. Candidate exact full-copy checks remain separate functional gates. No missing phase is converted to zero; no invalid sample becomes a public speedup.

## Calibration notes

The original captured native Beautiful Chat timeline has a duplicate thought ID only after older pagination. Its old display-error samples remain diagnostic and are not reused here. The new uniquely tagged input completed all 20 Beautiful Chat samples without display errors; this verifies that new comparison input, not a production fix for the original duplicate-key input.

The first Web navigation calibration used the host's close action, which archives ordinary agent tabs; this affected only its own disposable synthetic agent and is excluded. The second used a target switch but attempted to return through the stale unmounted pane callback, producing no row work and failing the gate. The corrected probe restores the saved target through the live new-tab pane; regression tests model the stale callback. All calibration records are retained outside the formal matrix.

The original long-reply location is retained because the user chose whole-session return instead of changing disclosure settings or forcing independent block virtualization. This supersedes the earlier proposed relocation: no relocation is required for a whole-view unmount.

## Ownership

Studio artifact root: `/tmp/bc-history-complete-20261016`. This group owns only private daemon 6871, Metro 8085, Web 8092 and dedicated `bc-perf-ios`. The five-regression worker owns its three parallel lanes separately; group 1 must not stop their services. Never operate daily daemon 6767, `Align205-iPhone17Pro` or either protected Pixel AVD as part of this benchmark.

No commit, merge, push or daily plugin update is authorized. Simulator results do not establish iPhone 15 Pro Release acceptance.
