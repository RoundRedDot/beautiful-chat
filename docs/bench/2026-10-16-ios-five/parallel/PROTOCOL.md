# Concurrent iOS five-fix campaign

Authorized regime: `concurrent-max4`, beginning 2026-10-16T06:39:42Z. The main session's history campaign is group 1; this agent owns only lanes 2/3/4. These observations are not serial measurements and will not be pooled with the original calibration or history campaign.

Files: `parallel/tools/{prepare-lane,runner,resources,audit,cleanup}` plus this protocol, summaries and raw/logs. No production source changes. Each lane owns its fresh home, daemon, Metro, source snapshot, active link, provider instance, workspace, simulator, host clone and caches.

- Parent `7f01b2d95c87cb6879adf701571de3778a167060`; fixed `722238de2fcc1ade46d542a7a540868932d9dc89`; native disables only that lane's Better Paseo. No Beautiful Chat comparator.
- Host SHA `75953250959979b8f088bbca8dbd6ee61d0151b1` plus the existing measurement-only patch, cloned without source changes. Dependency bytes may share APFS blocks; mutable caches and project directories are separate. Same installed 0.11.2/build11002999 development-Hermes binary, fresh iPhone16Pro/iOS18.6 simulator per lane.
- Lanes 2/3/4: private home `.paseo-bench-ios-five-laneN`; daemon `688N`; Metro `818N`; new simulator `bc-five-parallel-N`. No existing simulator, home, active pointer or service is used for execution.
- For fixture index `f` (0..4) and rep `r` (1..5), lane is `2 + ((f+r-1)%3)`. All four modes of that fixture/rep remain together, so fixed A/A is same-lane and same-repetition. Order rotates by `(f+r)%4`. Exactly 100 core samples, with 32/36/32 distributed among lanes. Each lane runs its tasks serially.
- Every sample cold-launches and uses a fresh synthetic provider agent; speeds and default disclosure match the prior protocol. `tool-expanded-streaming` is growing log at defaults, not a forced-expanded body. Primary metric remains host Profiler `allRows.sum`.
- Before sampling, all lanes pass small smoke with endpoint/serverId/UDID/Metro/source verification, a real streaming thought opened midstream, latest complete copy-source via the actual copy handler and native clipboard readback. Smoke remains outside core timing. Injected fiber/handler inspection is a functional diagnostic input, not a claim of physical HID expanded-body timing.

## Concurrent resource gate

Initial Studio baseline: CPU idle 91.69%, 1-minute load 1.63, pressure level 1 (normal); 64 GiB physical RAM. One-minute load is recorded, not used as a <=4 gate.

All lanes use the same admission rule: `kern.memorystatus_vm_pressure_level == 1`, `memory_pressure -Q` system-wide free percentage >=10%, and sampled CPU idle >=15%. This permits concurrent work while refusing sustained saturation or memory pressure. Record every gate wait. After 120 s without admission, retain a failure and stop that lane; report a reduced-concurrency recommendation rather than modifying protected resources. End excursions are retained and flagged, never silently replaced.

Resource records include UTC time, CPU idle, load averages, pressure level, reclaimable-free percentage, VM statistics, and filtered active campaign process/activity snapshots. Each sample includes start/end time, lane, source/fixture hashes and execution regime. This gate does not normalize away shared hardware contention; report per-lane distributions and paired A/A variation.

Group 1 completed its 80 captures before 07:11 UTC and its owner reported cleanup complete at **07:12:05 UTC** (private ports 6871/8085/8092 closed; dedicated simulator Shutdown). Its last activity file can remain idle after process exit. Process presence is authoritative for overlap; the regime means **up to four**, not continuously four active campaigns. Core samples crossing this boundary are preserved, and later risk phases run with only this campaign's three lanes unless the recorded processes show other work. No successful sample is rerun to conceal this change.

## Acceptance and reporting

At least 5 runs per fixture/mode, fixed A/A 5 pairs. Check all completion/display/source/renderer gates; preserve every failed attempt and never overwrite an output. Report unrounded median, full observed range, parent delta, native delta, lane assignment and A/A differences. Relative <10% is even for iOS; no Web small-duration rule.

A/A is a stability check, not a confidence interval. Flag pair differences >10% and show both values plus per-lane medians. If contention produces material instability, do not claim the speedup is established; retain the concurrent results and propose a lower-concurrency confirmation batch. Risk regressions follow the core result, using a new phase and the same regime labels.

Cleanup stops only processes descended from this campaign's new PID markers, only its three private daemons, and only its freshly created simulator UDIDs. Preserve evidence and fresh simulator directories (Shutdown); do not erase or delete devices. Read back group 1 and protected-resource presence without changing them.

## Setup readback and risk matrix

The initial default Metro worker count created about 33 workers across the new lanes. At 06:46:12 UTC only the three owned Metro process trees were restarted with `--max-workers 2`; individual cache roots remain separate. The main session reported the setup load peak separately; no setup/smoke run is a formal sample. Setup failures are retained: plugins were initially globally disabled in fresh homes, endpoint comparison initially rejected the host's `localhost` canonicalization, CLI `send` initially waited until completion, and a copy assertion initially omitted the existing `.trim()` contract. The clipboard contents themselves matched the actual copy source. The passing lane 3 smoke was not rerun while lanes 2/4 completed their corrected checks.

All three functional smokes plus native/parent boundary checks passed before the formal barrier. Core started **2026-10-16T06:53:22Z**. Expected core counts are 100. Post-core audit must pass before risk collection.

Risk checks: remaining six iOS fixtures (`mixed-turn`, `history-100`, `shell-log-large`, `table-streaming`, `codeblock-streaming`, `markdown-long`), parent/fixed x5 =60; affected Web paths (`diff-large`, `reads-20`, both reasoning fixtures, growing tool log, `mixed-turn`), parent/fixed x5 =60. The same lane-balanced fixture/rep assignment applies. Each new Web export is built only after iOS risk completes, with two workers and its lane's daemon override; Web static ports 8282/8283/8284 are checked before binding. Each Web page's WebSocket routing permits only its own loopback daemon, and runtime endpoint/serverId is read back. Separate Web smoke precedes its formal phase. These are additional risk checks, never pooled with core or old serial data.

All 60 iOS risk samples completed with zero audit failures. Three Web exports completed before smoke. The first parent deep link in each fresh Web profile was redirected by host initialization to `/open-project`, with the private daemon online but no chat Profiler loaded; all three attempts timed out. A separate fresh-profile diagnostic reproduced this route transition. The harness now first initializes the root route, waits for the exact private host to become online, then navigates the new agent. The three failed parent outputs and initial barrier failures are retained in `laneN/raw/web-setup` and logs; successful fixed smoke samples were not rerun. The initial Web harness is retained as `raw/web-runner-initial.mjs`. All three parent retries passed. `resume-web.mjs` only schedules the previously unstarted Web phase; its formal start is **2026-10-16T07:34:48.577Z**. Every formal Web sample records the new harness hashes, canonical workspace URL and exact private runtime identity.
