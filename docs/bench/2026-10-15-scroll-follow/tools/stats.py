import json, sys, collections
r = json.load(open(sys.argv[1] + ".shifts.json"))
good = [x for x in r if x["shift"] != 0 and x["err"] < 1.0]
bad = [x for x in r if x["shift"] != 0 and x["err"] >= 1.0]
down = [x for x in good if x["shift"] < 0]
print(sys.argv[1], f"clean moves {len(good)} (down {len(down)}), unexplained changes {len(bad)}")
print("  clean up steps (px@3x):", collections.Counter(x["shift"] for x in good if x["shift"] > 0).most_common(10))
for x in down[:10]: print("  down:", x)
# time between consecutive clean up moves
ts = [x["t"] for x in good if x["shift"] > 0]
gaps = [round(b - a, 3) for a, b in zip(ts, ts[1:])]
if gaps:
    gaps.sort(); print("  gap between moves s: p10 %.3f p50 %.3f p90 %.3f" % (gaps[len(gaps)//10], gaps[len(gaps)//2], gaps[9*len(gaps)//10]))
