"""Before/after medians of the iOS host-probe dumps.

    python3 docs/bench/2026-10-15-stream-reuse/tools/summarize.py [raw/ios dir]
"""
import collections
import glob
import json
import os
import statistics
import sys

root = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "raw", "ios")
runs = collections.defaultdict(lambda: collections.defaultdict(list))
for path in glob.glob(os.path.join(root, "*.json")):
    dump = json.load(open(path))
    kinds = dump["kinds"]
    main = "reasoning" if dump["fixture"].startswith("reasoning") else "assistant"
    runs[dump["fixture"]][dump["mode"]].append({
        "rep": dump["rep"],
        "all": dump["allRows"]["sum"],
        "main": kinds.get(main, {}).get("sum", 0),
        "p95": kinds.get(main, {}).get("p95", 0),
        "dropped": (dump.get("frames") or {}).get("droppedRatio") or 0,
    })

median = statistics.median
print("| fixture | n | all rows sum ms | change | main card p95 ms | dropped frames | runs before / after |")
print("|---|---:|---:|---:|---:|---:|---|")
for fixture in sorted(runs):
    before = sorted(runs[fixture]["before"], key=lambda run: run["rep"])
    after = sorted(runs[fixture]["after"], key=lambda run: run["rep"])
    b, a = median([r["all"] for r in before]), median([r["all"] for r in after])
    print(
        f"| {fixture} | {len(before)}+{len(after)} | {b:.1f} -> {a:.1f} | {100 * (a - b) / b:+.0f}% "
        f"| {median([r['p95'] for r in before]):.1f} -> {median([r['p95'] for r in after]):.1f} "
        f"| {median([r['dropped'] for r in before]):.2f} -> {median([r['dropped'] for r in after]):.2f} "
        f"| {', '.join(f'{r['all']:.0f}' for r in before)} / {', '.join(f'{r['all']:.0f}' for r in after)} |"
    )
