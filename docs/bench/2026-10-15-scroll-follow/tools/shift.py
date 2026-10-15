"""Per-frame vertical content shift of the timeline region in a simulator recording.

    python3 shift.py video.mp4 [top_frac bottom_frac]
Positive shift = content moved up. Prints a summary and writes <video>.shifts.json.
"""
import json, subprocess, sys
import numpy as np

video = sys.argv[1]
top_frac = float(sys.argv[2]) if len(sys.argv) > 2 else 0.19   # below the agent header
bot_frac = float(sys.argv[3]) if len(sys.argv) > 3 else 0.84   # above the composer
W, H = 402, 874  # 1/3 scale
probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "frame=pts_time",
                        "-of", "csv=p=0", video], capture_output=True, text=True).stdout.split()
times = [float(t.strip(",")) for t in probe if t.strip(",")]
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", video, "-fps_mode", "passthrough", "-vf", f"scale={W}:{H},format=gray",
                      "-f", "rawvideo", "-"], capture_output=True).stdout
frames = np.frombuffer(raw, dtype=np.uint8).reshape(-1, H, W)
n = min(len(frames), len(times))
y0, y1 = int(H * top_frac), int(H * bot_frac)
# darkness per row, over the text column
profiles = (255 - frames[:n, y0:y1, 10:W - 10].astype(np.float32)).mean(axis=2)
M = 40  # max shift tested, scaled px
results = []
for i in range(1, n):
    a, b = profiles[i - 1], profiles[i]
    if np.abs(a - b).max() < 0.5:
        continue  # identical frame
    best, best_err = 0, None
    L = len(a)
    for s in range(-M, M + 1):
        # b shifted up by s: b[y] ~ a[y + s]; compare on the upper 75% so new text at the bottom does not count
        lo, hi = max(0, -s), min(L, L - s, int(L * 0.75))
        if hi - lo < L * 0.3:
            continue
        err = np.abs(b[lo:hi] - a[lo + s:hi + s]).mean()
        if best_err is None or err < best_err - 1e-6 or (abs(err - best_err) < 1e-6 and abs(s) < abs(best)):
            best, best_err = s, err
    results.append({"i": i, "t": round(times[i], 4), "shift": best * 3, "err": round(float(best_err), 3)})
moves = [r for r in results if r["shift"] != 0]
down = [r for r in moves if r["shift"] < 0]
# a down move undone within 5 frames
flickers = []
for r in down:
    later = [x for x in results if r["i"] < x["i"] <= r["i"] + 5 and x["shift"] > 0]
    if later:
        flickers.append((r, later[0]))
ups = sorted(r["shift"] for r in moves if r["shift"] > 0)
print(f"{video}: frames {n}, changed {len(results)}, moved {len(moves)} (up {len(ups)}, down {len(down)}), down-then-up within 5 frames: {len(flickers)}")
if ups:
    import collections
    print("  up shift sizes (px @3x):", collections.Counter(ups).most_common(8))
for r, u in flickers[:10]:
    print(f"  flicker at t={r['t']}s: {r['shift']}px then t={u['t']}s: +{u['shift']}px")
json.dump(results, open(video + ".shifts.json", "w"))
