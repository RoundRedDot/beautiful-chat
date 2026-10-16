# iOS five regressions: diagnosis and proposed implementation

Status: minimal plan confirmed by the main session; code and local functional validation complete, Studio performance acceptance pending scheduling.

## Fixed scope

- Worktree: `ios-five-regressions-20261016`; branch `fix/ios-five-regressions-20261016`.
- Base: `c4c9f3f57c43a72b2b8fccc91030eb19df6e500d`; tree `dca92c3e280ef73d89c110b0813b1daeb7e7a068`.
- Studio source snapshot: `/tmp/bc-ios-five-20261016/baseline`; all 3,092 tracked blobs verified.
- Host stays at `75953250959979b8f088bbca8dbd6ee61d0151b1` with its existing measurement-only patch.
- Prior `48a6646` data is historical only. This directory contains new evidence only.

## Ranked hypotheses (not confirmed root causes)

1. `useTimelineToolGroup` returns the previous singleton array during the render receiving a tool update; its layout effect then updates the store and notifies the same row. Prediction: one standalone call update reaches the real renderer twice; returning its current singleton snapshot removes that duplicate while merged headers and other panes still update.
2. A collapsed reasoning row passes changing text into `useRevealedText(..., "complete")` although it draws the raw text. The exact host hook settles in a passive effect and calls `forceRender`. Prediction: a collapsed update produces a second render with no visible content change; memoizing the card isolates its unchanged subtree from the settle commit. Keep the full hook input: an empty input was rejected because opening mid-stream would replay the existing body from zero.
3. Summary/diff recomputation may amplify those renders. Prediction: if duplicate commits are insufficient, component counters/profile will show remaining count/summary work; no speculative cache is included in the first patch.
4. The `0e53757` / `c4c9f3f` toolbar changes may affect the baseline. Their new details-layer effects are gated on Web/open details; formal c4 controls establish the current result instead of attributing the old table to c4.

Initial calibration: `diff-large` native 54.296459555625916 ms, c4 67.4744371175766 ms (+24.2704%, n=1 each). c4 tool rows committed 10 times versus native 4. This is diagnostic, not a five-run acceptance result.

## Proposed files and sequence

1. Add regression cases in `test/unit/live-tool-group.test.ts` and `test/unit/reveal-commit.test.ts`: one current single-call update must not add a store echo render; collapsed thought growth must not redraw the unchanged card on the host reveal-settle render; opening must immediately show the current body, with current complete copy text. Retain coverage for merged groups, two panes, changing paths, completion, spacing, expansion and latest content.
2. Change only `client/timeline-order.ts` (singleton snapshot) and `client/live-renderers.tsx` (memoized `ReasoningCard`) for the two redundant-update paths. Keep all displayed text, default disclosure behavior, copying, previews, animation, footers, pacing when expanded, and history contracts.
3. If the first patch leaves material cost, profile that residual before proposing any broader production change. Do not publish measurement-only variants as the candidate.
4. Run focused tests, typecheck and Hermes registration checks on Studio, serially outside measured samples. Record exact source blobs and patch hash for the uncommitted candidate.

## Acceptance

- Primary metric remains the identical host Profiler `allRows.sum`. Five core fixtures each get same-round c4, native and fixed controls (at least five per mode), plus paired fixed A/A samples, rotating order and cold-launching each iOS sample, serial simulator, start load <=4.
- Report unrounded medians, full observed ranges, A/A differences, all failures/exclusions and source/fixture identity. Under 10% relative to native is even; no Web small-duration rule on iOS.
- `tool-expanded-streaming` measures growing tool log with default disclosure state. A separate actual expanded-body check must document its input and must not be substituted into the default comparison.
- Remaining iOS fixtures receive risk-based c4/fixed regression checks; Web receives c4/fixed checks for affected tool/reasoning paths. Each selected comparison has five runs per mode.
- Long-history cold-open, older reveal, actual block unmount/remount and exact 59,427-character copy remain functional gates. No old baseline duplicate-key samples enter speed conclusions.
- Restore the captured private plugin state/pointer; stop only services started here and the dedicated simulator. Read back protected resources and port state. No commit, push, merge, daily plugin update or production action.
- Simulator development-Hermes evidence is not iPhone 15 Pro Release acceptance. Any remaining >10% result stays explicitly unresolved with measured cost attribution.
