# Long-history loading benchmark (pending)

This is a required addition to the next README comparison, separate from the existing
`history-100` and streaming `markdown-long` scenarios. No comparison has been run for it yet;
keep the October 15 results and charts unchanged until the new matrix is complete.

## Fixture

`test/fixtures/streams/history-long-load.jsonl` is entirely synthetic. It preserves the
reported iOS incident's projected shape: 810 items (12 prompts, 260 thoughts, 398 tools and
140 replies), a 59,427-character Markdown reply (including a 244-item tight list), and tool lifecycle updates delayed across
many intervening items. The delayed updates intentionally exercise projected-tail expansion.
No conversation text, real file paths, credentials, account names or captured tool output
are included. Its 1,208 replay events are not a byte-for-byte copy of the original history.

```bash
node test/fixtures/streams/generate-history-long-load.mts
node test/fixtures/streams/generate-history-long-load.mts --check
```

Use the existing [bench provider](../../../tools/bench-provider/README.md) and an isolated
daemon. Seed the history before starting a timed loading measurement:

```bash
paseo --home "$BC_BENCH_HOME" send "$BC_BENCH_AGENT" 'fixture:history-long-load speed:max'
paseo --home "$BC_BENCH_HOME" wait "$BC_BENCH_AGENT" --timeout 300
```

Both variables must identify the disposable benchmark environment, never the daily-driver
daemon or the reported real conversation. The seeding replay is preparation, not a result.

## Required matrix

Compare no plugin, Beautiful Chat `42b61d8`, and the candidate Better Paseo revision on the
same instrumented host. Pin the host SHA, each plugin SHA and settings, fixture hash, device,
build type and runtime. Use a single simulator serially; do at least five alternating runs
per mode and phase, with same-round A/A pairs. Repeat Web separately. Real iOS release-build
acceptance is recorded separately from simulator measurements.

| Phase | Procedure | Primary measures |
| --- | --- | --- |
| `history-long-load/open` | Cold-launch the app, reset probes, open the pre-seeded history, wait until visible rows and the footer settle | Longest JS/frame gap, first usable viewport time, row render total, native commit time, requested/returned page counts and payload size |
| `history-long-load/older` | From the settled tail, drag upward to trigger the first older-history reveal; repeat at a fixed source-message boundary | Longest JS/frame gap, row render total, grouping rebuilds, layout measurements, mounted rows, RPC count |
| `history-long-load/remount` | Scroll the long reply out of the virtualization window and back in, without changing content | Mounted Markdown blocks, longest JS/frame gap, row render total, footer/RPC count |

Capture input/scroll actions and the source boundary, not just an arbitrary pixel offset:
native and plugin modes split Markdown into different numbers of rows. Keep initial-load
and warm-remount samples separate. A programmatic call to the history callback is useful
for diagnosis but does not replace the actual scroll path in this comparison.

Always record requested versus returned timeline sizes. Lifecycle overlap can make a tail
larger than its limit in Paseo 0.11.2; do not hide that by changing limits for one mode. A host
pagination change needs a separate same-host comparison, with cursor/reconnect correctness.
The plugin fix does not change that host cursor/coverage contract: oversized tail delivery
remains a separate host issue and must stay visible in the next comparison's results.

Functional gates: full reply text remains copyable once, one completed-turn footer per
reply, stable code/table contents and block order, no missing history across pagination or
reconnect, no React key/hook errors, and no persistent blank rows after scrolling settles.
Do not count fewer visible characters, omitted blocks or disabled features as a speedup.

Write raw samples, build identity, A/A spread and median results alongside this document
when run. Only then replace the pending entries in both README languages and extend the
charts; the earlier incident's diagnostic timings are not cross-version benchmark results.
