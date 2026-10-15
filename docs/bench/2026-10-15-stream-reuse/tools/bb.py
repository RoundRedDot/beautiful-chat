import plistlib, sys
src, dst = sys.argv[1], sys.argv[2]
a = plistlib.load(open(src, "rb")); b = plistlib.load(open(dst, "rb"))
def find(d, path=()):
    if isinstance(d, dict):
        for k, v in d.items():
            if k == "sh.paseo.debug": return path + (k,)
            r = find(v, path + (k,))
            if r: return r
    return None
p = find(a); print("path", p)
sv = a
for k in p[:-1]: sv = sv[k]
dv = b
for k in p[:-1]: dv = dv.setdefault(k, {})
dv[p[-1]] = sv[p[-1]]
plistlib.dump(b, open(dst, "wb"), fmt=plistlib.FMT_BINARY)
print("ok")
