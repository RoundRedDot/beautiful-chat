#!/bin/zsh
# Native Paseo rendering vs the better-paseo fork on the iOS simulator (dev build).
#
#   ios-ab.sh <mode> <fixture> <speed> <rep>        mode: native | fork
#
# Needs: control-server.mjs on :8099, the patched Paseo JS served by Metro on $METRO_PORT
# (EXPO_PUBLIC_BC_HOST_PERF=1, EXPO_PUBLIC_LOCAL_DAEMON=localhost:6869), the A/B daemon
# ~/.paseo-bench-ab, and the simulator $BC_SIM_UDID with the sh.paseo dev client.
# Mode toggles better-paseo in the daemon; the app is relaunched before every run.
set -u
H=$HOME/.paseo-bench-ab
U=${BC_SIM_UDID:?set BC_SIM_UDID}
METRO_PORT=${METRO_PORT:-8085}
CTL=http://127.0.0.1:8099
SERVER_ID=$(cat $H/server-id)
OUT=${OUT:?set OUT}
SIM=${BC_SERVE_SIM:?set BC_SERVE_SIM to the serve-sim executable}
mode=$1 fixture=$2 speed=$3 rep=$4
label="ios-$mode-$fixture-r$rep"

current_mode() {
  paseo --home $H plugin ls better-paseo --json | node -e 'const [r]=JSON.parse(require("fs").readFileSync(0));console.log(r.enabled?"fork":"native")'
}

app_alive() {
  local ms=$(curl -s $CTL/seen | node -e 'console.log(JSON.parse(require("fs").readFileSync(0)).msAgo)')
  [ "$ms" -lt 1500 ]
}

relaunch() {
  xcrun simctl terminate $U sh.paseo 2>/dev/null
  sleep 1
  # The dev client reopens the last Metro URL by itself. Opening it again while that
  # bundle loads trips a Reanimated assertion in the debug build, so only fall back
  # to the URL (and its "Open in Paseo?" alert) if nothing polls within 30 s.
  xcrun simctl launch $U sh.paseo >/dev/null
  for i in {1..15}; do
    sleep 2
    app_alive && { sleep 6; return 0; }
  done
  xcrun simctl openurl $U "sh.paseo://expo-development-client/?url=http%3A%2F%2Flocalhost%3A$METRO_PORT"
  sleep 1.5
  "$SIM" tap -d $U 0.666 0.5515 >/dev/null 2>&1
  for i in {1..45}; do
    sleep 2
    app_alive && { sleep 6; return 0; }
  done
  echo "app did not come up" >&2
  return 1
}

# Every run starts from a freshly launched app, so neither mode inherits the other's heap.
if [ "$(current_mode)" != "$mode" ]; then
  if [ $mode = fork ]; then paseo --home $H plugin enable better-paseo >/dev/null
  else paseo --home $H plugin disable better-paseo >/dev/null; fi
  sleep 2
fi
relaunch || exit 1

AID=$(paseo --home $H run -d -q --provider bc-bench --workspace ${BC_WORKSPACE:?set BC_WORKSPACE} --title "ab-$label" "list" | tail -1)
paseo --home $H wait $AID --timeout 60 >/dev/null 2>&1
# The first deep link after a relaunch can land on the workspace instead of the agent;
# the second one always opens the agent tab. No blind taps here: they would hit the chat.
xcrun simctl openurl $U "sh.paseo:///h/$SERVER_ID/agent/$AID"
sleep 5
xcrun simctl openurl $U "sh.paseo:///h/$SERVER_ID/agent/$AID"
sleep 5
curl -s -X POST $CTL/queue -d '{"cmd":"reset"}' >/dev/null
sleep 1.5
start=$(date +%s)
paseo --home $H send $AID "fixture:$fixture speed:$speed" >/dev/null
paseo --home $H wait $AID --timeout 900 >/dev/null 2>&1
stream_s=$(( $(date +%s) - start ))
sleep 4
curl -s -X POST $CTL/queue -d "{\"cmd\":\"dump\",\"label\":\"$label\"}" >/dev/null
for i in {1..60}; do
  sleep 1
  curl -s $CTL/last-dump | grep -q "\"$label\"" && break
done
xcrun simctl io $U screenshot "$OUT/$label.png" >/dev/null 2>&1
paseo --home $H archive $AID >/dev/null 2>&1
if [ -f "$OUT/$label.json" ]; then
  echo "$label: dumped (stream ${stream_s}s, agent $AID)"
else
  echo "$label: NO DUMP"
fi
