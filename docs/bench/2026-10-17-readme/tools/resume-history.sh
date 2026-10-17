#!/bin/zsh
set -eu
source /tmp/bc-readme-20261017/parallel-v2/lane${1}/environment.sh
trap 'echo $? > "$BC_LANE_ROOT/campaign.status"' EXIT
export BC_ROOT="$BC_LANE_ROOT/history"
BC_WEB_HISTORY_PREFIX=smoke3- node "$BC_ROOT/tools/run-web.mjs" --smoke > "$BC_ROOT/logs/web-smoke3.log" 2>&1
touch "$BC_LANE_ROOT/history-web-smoke3.done"
for lane in 1 2 3 4; do
  while [[ ! -e /tmp/bc-readme-20261017/parallel-v2/lane${lane}/history-web-smoke3.done ]]; do sleep 2; done
done
node "$BC_ROOT/tools/run-web.mjs" > "$BC_ROOT/logs/web.log" 2>&1
touch "$BC_LANE_ROOT/web.done"
for lane in 1 2 3 4; do
  while [[ ! -e /tmp/bc-readme-20261017/parallel-v2/lane${lane}/web.done ]]; do sleep 2; done
done
export BC_ROOT="$BC_LANE_ROOT"
xcrun simctl boot "$BC_SIM_UDID"
xcrun simctl bootstatus "$BC_SIM_UDID" -b
cd "$BC_HOST/packages/app"
nohup env CI=1 APP_VARIANT=development EXPO_PUBLIC_LOCAL_DAEMON=127.0.0.1:${BC_BENCH_PORT} EXPO_PUBLIC_BC_HOST_PERF=1 TMPDIR="$BC_LANE_ROOT/tmp" EXPO_HOME="$BC_LANE_ROOT/expo-home" EXPO_NO_TELEMETRY=1 npx expo start --dev-client --port "$METRO_PORT" --max-workers 2 > "$BC_ROOT/logs/metro.log" 2>&1 < /dev/null &
echo $! > "$BC_ROOT/metro.pid"
for attempt in {1..60}; do curl -sf http://127.0.0.1:${METRO_PORT}/status >/dev/null && break; sleep 2; done
node "$BC_ROOT/tools/replay-parallel.mjs" ios --smoke > "$BC_ROOT/logs/ios-smoke.log" 2>&1
export BC_ROOT="$BC_LANE_ROOT/history"
BC_RUN_PREFIX=smoke2- node "$BC_ROOT/tools/run-native.mjs" --smoke > "$BC_ROOT/logs/ios-smoke2.log" 2>&1
export BC_ROOT="$BC_LANE_ROOT"
touch "$BC_ROOT/ios-smoke.done"
for lane in 1 2 3 4; do
  while [[ ! -e /tmp/bc-readme-20261017/parallel-v2/lane${lane}/ios-smoke.done ]]; do sleep 2; done
done
node "$BC_ROOT/tools/replay-parallel.mjs" ios > "$BC_ROOT/logs/ios.log" 2>&1
export BC_ROOT="$BC_LANE_ROOT/history"
node "$BC_ROOT/tools/run-native.mjs" > "$BC_ROOT/logs/ios.log" 2>&1
touch "$BC_LANE_ROOT/ios.done"
