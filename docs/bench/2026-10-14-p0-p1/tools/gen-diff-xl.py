# Writes the TEMPORARY fixture test/fixtures/streams/diff-xl-p0p1.jsonl (delete after use):
# one Edit tool call whose unified diff has 400,000 body lines (max line number 392,000).
import json, sys
N = 400000
body = []; old = new = 0
for i in range(N):
    if i % 50 == 25: body.append("-a"); old += 1
    elif i % 50 == 26: body.append("+b"); new += 1
    else: body.append(" c"); old += 1; new += 1
diff = f"--- a/huge.txt\n+++ b/huge.txt\n@@ -1,{old} +1,{new} @@\n" + "\n".join(body)
fp = "/Users/dev/workspace/acme-chat/huge.txt"
lines = [
    {"kind": "meta", "name": "diff-xl-p0p1", "description": f"TEMP (P0/P1 QA, delete after): one Edit with a {N}-line diff body.", "scenario": "Extra-long diff numbers array beyond the V8 spread limit."},
    {"t": 0, "item": {"type": "user_message", "text": "Apply the huge edit."}, "mode": "append"},
    {"t": 100, "item": {"type": "assistant_message", "text": "Applying the huge edit.\n\n"}, "mode": "append"},
    {"t": 150, "item": {"type": "tool_call", "callId": "toolu_diffxl0001", "name": "Edit", "detail": {"type": "edit", "filePath": fp}, "status": "running", "error": None}, "mode": "replace"},
    {"t": 800, "item": {"type": "tool_call", "callId": "toolu_diffxl0001", "name": "Edit", "detail": {"type": "edit", "filePath": fp, "unifiedDiff": diff}, "status": "completed", "error": None}, "mode": "replace"},
    {"t": 900, "item": {"type": "assistant_message", "text": "Done."}, "mode": "append"},
]
open(sys.argv[1] if len(sys.argv) > 1 else "diff-xl-p0p1.jsonl", "w").write("\n".join(json.dumps(l) for l in lines) + "\n")
