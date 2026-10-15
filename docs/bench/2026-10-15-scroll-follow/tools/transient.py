"""Frames that differ from both neighbours while the neighbours match each other: a one- or two-frame flash."""
import subprocess, sys
import numpy as np
video = sys.argv[1]
W, H = 402, 874
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", video, "-fps_mode", "passthrough", "-vf", f"scale={W}:{H},format=gray",
                      "-f", "rawvideo", "-"], capture_output=True).stdout
fr = np.frombuffer(raw, dtype=np.uint8).reshape(-1, H, W).astype(np.float32)
top = float(sys.argv[2]) if len(sys.argv) > 2 else 0.19
bot = float(sys.argv[3]) if len(sys.argv) > 3 else 0.84
y0, y1 = int(H * top), int(H * bot)
reg = fr[:, y0:y1, 10:W - 10]
def best(a, b, M=45):
    pa, pb = (255 - a).mean(axis=1), (255 - b).mean(axis=1)
    L = len(pa); out = 1e9
    for s in range(-M, M + 1):
        lo, hi = max(0, -s), min(L, L - s)
        if hi - lo < L * 0.5: continue
        out = min(out, np.abs(a[lo:hi] - b[lo + s:hi + s]).mean())
    return out
hits = []
n = len(reg)
for i in range(1, n - 2):
    d1 = np.abs(reg[i] - reg[i - 1]).mean()
    if d1 < 0.3: continue
    for k in (1, 2, 3, 4):  # flash of up to 4 frames
        if i + k >= n: break
        skip = np.abs(reg[i + k] - reg[i - 1]).mean()
        if skip < 0.25 * d1 and d1 > 1.0:
            hits.append((i, k, round(float(d1), 2), round(float(skip), 2)))
            break
print(video, "changed frames scanned:", int(sum(np.abs(reg[i] - reg[i - 1]).mean() >= 0.3 for i in range(1, n))), "transient flashes:", len(hits))
for h in hits[:15]: print("  frame", h)
