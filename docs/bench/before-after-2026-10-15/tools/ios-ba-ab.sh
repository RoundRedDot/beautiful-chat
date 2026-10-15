#!/bin/zsh
# Three-copy before/after host-probe measurement on the iOS simulator (dev build).
#
#   ios-ba-ab.sh <mode> <fixture> <speed> <rep>
#     mode: before | before2 | after
#
# Needs: control-server.mjs on :8099, the patched Paseo JS served by Metro on
# $METRO_PORT (EXPO_PUBLIC_BC_HOST_PERF=1), the A/B daemon, and simulator
# $BC_SIM_UDID. The app is relaunched before every run.
#
# Defaults are the original bench (daemon ~/.paseo-bench-ab, CLI `paseo`,
# bundle and URL scheme sh.paseo, fork toggled with plugin enable/disable).
# Overrides: BC_BENCH_HOME BC_PASEO_BIN BC_BUNDLE_ID BC_URL_SCHEME BC_CWD
# BC_DEV_SCHEME (dev-client opener; defaults to BC_URL_SCHEME) METRO_PORT.
# Three builds share one plugin entry via BC_PLUGIN_LINK and the three
# BC_BEFORE_DIR / BC_BEFORE2_DIR / BC_AFTER_DIR directories.
# BC_SKIP_EXISTING=1 skips a dump whose stamped identity already matches.
# BC_IDENTITY_ATTEMPTS (default 3) is how many times a mismatched run is redone.
# BC_DISMISS_OPEN_ALERT=1 taps the Expo "Open in …?" alert after the probe polls.
# The dev client shows that alert on a cold launch while already polling, so the
# poll wait alone leaves it over the timeline. Unset, relaunch matches the
# original script. BC_SERVE_SIM_PORT (default 3160) is the serve-sim AX port.
set -u
setopt pipefail
H=${BC_BENCH_HOME:-$HOME/.paseo-bench-ab}
PASEO=${BC_PASEO_BIN:-paseo}
U=${BC_SIM_UDID:?set BC_SIM_UDID}
METRO_PORT=${METRO_PORT:-8085}
BUNDLE=${BC_BUNDLE_ID:-sh.paseo}
SCHEME=${BC_URL_SCHEME:-sh.paseo}
DEV_SCHEME=${BC_DEV_SCHEME:-$SCHEME}
CTL=http://127.0.0.1:8099
SERVER_ID=$(cat "$H/server-id")
OUT=${OUT:?set OUT}
SIM=${BC_SERVE_SIM:?set BC_SERVE_SIM to the serve-sim executable}
SERVE_PORT=${BC_SERVE_SIM_PORT:-3160}
DISMISS_ALERT=${BC_DISMISS_OPEN_ALERT:-0}
PLUGIN_LINK=${BC_PLUGIN_LINK:-}
BEFORE_DIR=${BC_BEFORE_DIR:-}
BEFORE2_DIR=${BC_BEFORE2_DIR:-}
AFTER_DIR=${BC_AFTER_DIR:-}
CWD=${BC_CWD:-/tmp/bc-perf-p0p1/project}
WORKSPACE=${BC_WORKSPACE_ID:-}
SKIP=${BC_SKIP_EXISTING:-0}
ATTEMPTS=${BC_IDENTITY_ATTEMPTS:-3}
mode=$1 fixture=$2 speed=$3 rep=$4
label="ios-$mode-$fixture-r$rep"
here=${0:A:h}
mkdir -p "$OUT"
plugin_path=""

paseo_cli() { "$PASEO" --home "$H" "$@"; }

plugin_field() {
  local field=$1
  paseo_cli plugin ls better-paseo --json | node -e '
    let raw = "";
    process.stdin.on("data", (chunk) => { raw += chunk; });
    process.stdin.on("end", () => {
      const parsed = JSON.parse(raw);
      const row = Array.isArray(parsed) ? parsed[0] : parsed;
      if (!row) process.exit(1);
      if (process.argv[1] === "enabled") process.stdout.write(row.enabled ? "1" : "0");
      else process.stdout.write(String(row.status ?? ""));
    });
  ' "$field"
}

# Prints "swapped" or "same". Upstream/fork need the symlink; native never moves it.
point_plugin() {
  local target=""
  case $mode in
    before) target=$BEFORE_DIR ;;
    before2) target=$BEFORE2_DIR ;;
    after) target=$AFTER_DIR ;;
    *) echo "unknown mode $mode" >&2; return 1 ;;
  esac
  if [ -z "$target" ]; then
    if [ -z "$PLUGIN_LINK" ]; then print -r -- same; return 0; fi
    echo "no plugin directory for mode $mode" >&2
    return 1
  fi
  if [ -z "$PLUGIN_LINK" ]; then
    echo "BC_PLUGIN_LINK is required to switch plugin builds" >&2
    return 1
  fi
  local next current=""
  next=$(realpath "$target")
  if [ -e "$PLUGIN_LINK" ]; then current=$(realpath "$PLUGIN_LINK"); fi
  if [ "$current" = "$next" ]; then print -r -- same; return 0; fi
  ln -sfn "$target" "$PLUGIN_LINK"
  print -r -- swapped
}

assert_plugin_path() {
  local expected=""
  case $mode in
    before) expected=$BEFORE_DIR ;;
    before2) expected=$BEFORE2_DIR ;;
    after) expected=$AFTER_DIR ;;
  esac
  [ -n "$expected" ] || { echo "missing plugin directory for $mode" >&2; return 1; }
  plugin_path=$(realpath "$PLUGIN_LINK") || return 1
  local target_path
  target_path=$(realpath "$expected") || return 1
  [ "$plugin_path" = "$target_path" ] || {
    echo "plugin path mismatch for $mode: expected $target_path, got $plugin_path" >&2
    return 1
  }
}

set_mode() {
  local plugin_on=0 swapped enabled ready i
  [ "$mode" != native ] && plugin_on=1
  swapped=$(point_plugin) || return 1
  enabled=$(plugin_field enabled) || return 1
  if [ "$enabled" != "$plugin_on" ]; then
    if [ "$plugin_on" = 1 ]; then paseo_cli plugin enable better-paseo >/dev/null || return 1
    else paseo_cli plugin disable better-paseo >/dev/null || return 1
    fi
  fi
  # enable can keep the bundle compiled before the symlink moved, so reload after a swap.
  if [ "$swapped" = swapped ] && [ "$plugin_on" = 1 ]; then
    paseo_cli plugin reload better-paseo >/dev/null || return 1
  fi
  for i in {1..30}; do
    if [ "$plugin_on" = 1 ]; then
      ready=$(plugin_field status) || return 1
      [ "$ready" = running ] && return 0
    else
      enabled=$(plugin_field enabled) || return 1
      [ "$enabled" = 0 ] && return 0
    fi
    sleep 1
  done
  echo "better-paseo did not reach mode $mode" >&2
  return 1
}

app_alive() {
  local ms
  ms=$(curl -sf "$CTL/seen" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>process.stdout.write(String(JSON.parse(s).msAgo)))') || return 1
  [ "$ms" -lt 1500 ]
}

# Expo dev launcher asks "Open in …?" on cold start. The bundle polls under it.
# Tap Open until the accessibility tree no longer contains the alert.
dismiss_open_alert() {
  [ "$DISMISS_ALERT" = 1 ] || return 0
  # Xcode 27 delivers serve-sim taps through Device Hub. Bring it forward once.
  osascript -e 'tell application "DeviceHub" to activate' >/dev/null 2>&1 || true
  local i body
  for i in {1..8}; do
    body=$(curl -sf --max-time 3 "http://127.0.0.1:${SERVE_PORT}/ax" || true)
    if [ -n "$body" ] && ! print -r -- "$body" | grep -q "Open in"; then
      return 0
    fi
    "$SIM" tap -d "$U" 0.666 0.5515 >/dev/null 2>&1 || true
    sleep 0.7
  done
  echo "open alert still up" >&2
  return 1
}

relaunch() {
  xcrun simctl terminate "$U" "$BUNDLE" 2>/dev/null || true
  sleep 1
  # The dev client reopens the last Metro URL by itself. Opening it again while that
  # bundle loads trips a Reanimated assertion in the debug build, so only fall back
  # to the URL (and its "Open in Paseo?" alert) if nothing polls within 30 s.
  xcrun simctl launch "$U" "$BUNDLE" >/dev/null
  local i
  for i in {1..15}; do
    sleep 2
    app_alive && { sleep 6; dismiss_open_alert; return $?; }
  done
  xcrun simctl openurl "$U" "${DEV_SCHEME}://expo-development-client/?url=http%3A%2F%2Flocalhost%3A${METRO_PORT}"
  sleep 1.5
  "$SIM" tap -d "$U" 0.666 0.5515 >/dev/null 2>&1 || true
  for i in {1..45}; do
    sleep 2
    app_alive && { sleep 6; dismiss_open_alert; return $?; }
  done
  echo "app did not come up" >&2
  return 1
}

wait_workspace_ready() {
  local i body
  for i in {1..60}; do
    body=$(curl -sf --max-time 3 "http://127.0.0.1:${SERVE_PORT}/ax" 2>/dev/null || true)
    if [ -n "$body" ] && ! print -r -- "$body" | grep -q "Loading workspace"; then
      return 0
    fi
    sleep 1
  done
  echo "REDO $label: simulator stayed on Loading workspace" >&2
  return 1
}

# Reads identity JSON into IDENTITY. Pre-check has no dump; post-check requires one.
# Native is confirmed twice, a second apart, so a late plugin load cannot pass.
wait_identity() {
  local phase=$1
  local deadline=$(( $(date +%s) + 20 ))
  local -a extra
  extra=(--probes-off)
  [ "$phase" = post ] && extra+=(--dump "$OUT/$label.json")
  local last="" code
  while [ "$(date +%s)" -lt "$deadline" ]; do
    last=$(node "$here/ios-identity.mjs" --port "$METRO_PORT" --expect fork "${extra[@]}")
    code=$?
    if [ "$code" -eq 0 ]; then
      if ! print -r -- "$last" | node -e '
        let s = "";
        process.stdin.on("data", (d) => { s += d; });
        process.stdin.on("end", () => process.exit(JSON.parse(s).probesEnabled === false ? 0 : 1));
      '; then
        echo "REDO $label probes are not off ($phase): $last" >&2
        return 1
      fi
      if [ "$mode" = native ] && [ "$phase" = pre ]; then
        sleep 1
        last=$(node "$here/ios-identity.mjs" --port "$METRO_PORT" --expect fork)
        code=$?
        if [ "$code" -eq 0 ]; then IDENTITY=$last; return 0; fi
        echo "REDO $label identity mismatch (native recheck): $last" >&2
        return 1
      fi
      IDENTITY=$last
      return 0
    fi
    if [ "$code" -eq 1 ]; then
      echo "REDO $label identity mismatch ($phase): $last" >&2
      return 1
    fi
    # Upstream has no DOM marker on iOS, so the pre-check stays pending until a
    # dump exists. One live reading with the fork marker absent is enough to
    # start; holding the inspector open for the whole wait leaves Hermes in
    # debug mode and inflates the timed section. The dump is the proof.
    if [ "$phase" = pre ] && [ "$mode" = upstream ] && print -r -- "$last" | node -e '
      let s = "";
      process.stdin.on("data", (d) => { s += d; });
      process.stdin.on("end", () => {
        const row = JSON.parse(s);
        process.exit(row.host === true && row.fork !== true ? 0 : 1);
      });
    '; then
      echo "$label: no DOM marker before the run; the dump must show plugin rows" >&2
      IDENTITY=$last
      return 0
    fi
    sleep 1
  done
  echo "REDO $label identity not ready ($phase): $last" >&2
  return 1
}

stamp_dump() {
  local stream_s=$1 aid=$2
  STREAM_S=$stream_s AGENT_ID=$aid IDENTITY_JSON=$IDENTITY FIXTURE=$fixture MODE=$mode REP=$rep PLUGIN_PATH=$plugin_path \
    node -e '
      const fs = require("fs");
      const file = process.argv[1];
      const dump = JSON.parse(fs.readFileSync(file, "utf8"));
      const identity = JSON.parse(process.env.IDENTITY_JSON);
      identity.mode = process.env.MODE;
      identity.pluginPath = process.env.PLUGIN_PATH;
      dump.identity = identity;
      dump.streamS = Number(process.env.STREAM_S);
      dump.agentId = process.env.AGENT_ID;
      dump.fixture = process.env.FIXTURE;
      dump.mode = process.env.MODE;
      dump.rep = Number(process.env.REP);
      fs.writeFileSync(file, JSON.stringify(dump, null, 2));
    ' "$OUT/$label.json"
}

attempt_once() {
  local aid="" stream_s start
  set_mode || return 1
  assert_plugin_path || return 1
  relaunch || return 1
  local -a run_args
  run_args=(run -d -q --provider bc-bench)
  if [ -n "$WORKSPACE" ]; then
    run_args+=(--workspace "$WORKSPACE")
  else
    run_args+=(--cwd "$CWD")
  fi
  run_args+=(--title "ab-$label")
  aid=$(paseo_cli "${run_args[@]}" "list" | tail -1) || true
  if [ -z "${aid:-}" ]; then
    echo "REDO $label: no agent id" >&2
    return 1
  fi
  paseo_cli wait "$aid" --timeout 60 >/dev/null 2>&1 || true
  # The first deep link after a relaunch can land on the workspace instead of the agent;
  # the second one always opens the agent tab. No blind taps here: they would hit the chat.
  xcrun simctl openurl "$U" "${SCHEME}:///h/${SERVER_ID}/agent/${aid}"
  sleep 5
  xcrun simctl openurl "$U" "${SCHEME}:///h/${SERVER_ID}/agent/${aid}"
  sleep 5
  wait_workspace_ready || {
    paseo_cli archive "$aid" >/dev/null 2>&1 || true
    return 1
  }
  if ! wait_identity pre; then
    paseo_cli archive "$aid" >/dev/null 2>&1 || true
    return 1
  fi
  # Drop the debugger before the timed section. reset then clears launch samples.
  sleep 1
  curl -sf -X POST "$CTL/queue" -d '{"cmd":"reset"}' >/dev/null || return 1
  sleep 1.5
  start=$(date +%s)
  paseo_cli send "$aid" "fixture:$fixture speed:$speed" >/dev/null || {
    paseo_cli archive "$aid" >/dev/null 2>&1 || true
    echo "REDO $label: send failed" >&2
    return 1
  }
  paseo_cli wait "$aid" --timeout 900 >/dev/null 2>&1 || true
  stream_s=$(( $(date +%s) - start ))
  sleep 4
  rm -f "$OUT/$label.json"
  curl -sf -X POST "$CTL/queue" -d "{\"cmd\":\"dump\",\"label\":\"$label\"}" >/dev/null || return 1
  local i
  for i in {1..60}; do
    sleep 1
    [ -f "$OUT/$label.json" ] && break
  done
  if [ ! -f "$OUT/$label.json" ]; then
    echo "REDO $label: NO DUMP (stream ${stream_s}s, agent $aid)" >&2
    paseo_cli archive "$aid" >/dev/null 2>&1 || true
    return 1
  fi
  if ! wait_identity post; then
    rm -f "$OUT/$label.json"
    paseo_cli archive "$aid" >/dev/null 2>&1 || true
    return 1
  fi
  stamp_dump "$stream_s" "$aid" || return 1
  if [ "$fixture" = mixed-turn ] && [ "$rep" = 1 ]; then
    xcrun simctl io "$U" screenshot "$OUT/$label.png" >/dev/null 2>&1 || true
  fi
  paseo_cli archive "$aid" >/dev/null 2>&1 || true
  local reason
  reason=$(print -r -- "$IDENTITY" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{process.stdout.write(JSON.parse(s).reason||"")}catch{}})')
  echo "$label: dumped (stream ${stream_s}s, agent $aid, identity ${reason})"
}

if [ "$SKIP" = 1 ] && [ -f "$OUT/$label.json" ]; then
  if node "$here/ios-identity.mjs" --check-file "$OUT/$label.json" --expect fork >/dev/null; then
    echo "$label: skip existing"
    exit 0
  fi
fi

n=1
while [ "$n" -le "$ATTEMPTS" ]; do
  if attempt_once; then exit 0; fi
  echo "REDO $label attempt $n of $ATTEMPTS failed" >&2
  n=$(( n + 1 ))
done
echo "$label: FAILED after $ATTEMPTS attempts" >&2
exit 1
