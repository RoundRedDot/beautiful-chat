p = "/tmp/bc-ss/tools/ios-ba-ab.sh"
s = open(p).read()
old = '''  xcrun simctl openurl "$U" "${SCHEME}:///h/${SERVER_ID}/agent/${aid}"
  sleep 5
  xcrun simctl openurl "$U" "${SCHEME}:///h/${SERVER_ID}/agent/${aid}"
  sleep 5'''
new = '''  # Opened from inside the app through the probe's control channel: iOS asks
  # before an outside openurl, and nothing here taps.
  open_in_app "${SCHEME}:///h/${SERVER_ID}/agent/${aid}"
  sleep 5
  open_in_app "${SCHEME}:///h/${SERVER_ID}/agent/${aid}"
  sleep 5'''
assert old in s
s = s.replace(old, new, 1)
s = s.replace("relaunch() {", '''open_in_app() {
  curl -sf -X POST "$CTL/queue" -d "{\\"cmd\\":\\"open\\",\\"url\\":\\"$1\\"}" >/dev/null
}

relaunch() {''', 1)
open(p, "w").write(s)
