#!/bin/zsh
set -e
source /tmp/bc-readme-20261016/tools/environment-only.sh
ROOT=/tmp/bc-readme-20261016
trap 'echo $? > "$ROOT/post.status"' EXIT
while kill -0 "$(cat "$ROOT/campaign.pid")" 2>/dev/null; do sleep 5; done
[ "$(cat "$ROOT/campaign.status")" = 0 ]
# The streaming matrix is complete. Shut down only the owned benchmark simulator.
if [ "$1" != --resume-history ]; then
  xcrun simctl terminate "$BC_SIM_UDID" sh.paseo.debug 2>/dev/null || true
  xcrun simctl shutdown "$BC_SIM_UDID"
  node "$ROOT/tools/stop-metro.mjs" "$ROOT/metro.pid"
fi
export BC_ROOT="$ROOT/history"
BC_WEB_HISTORY_PREFIX=smoke2- node "$BC_ROOT/tools/run-web.mjs" --smoke > "$ROOT/logs/history-web-smoke2.log" 2>&1
node "$BC_ROOT/tools/run-web.mjs" > "$ROOT/logs/history-web.log" 2>&1
node "$BC_ROOT/tools/report-web.mjs" "$BC_ROOT/raw/web" > "$ROOT/logs/history-web-report.txt"
xcrun simctl boot "$BC_SIM_UDID"
xcrun simctl bootstatus "$BC_SIM_UDID" -b
cd /tmp/bc-ios/paseo/packages/app
nohup env CI=1 APP_VARIANT=development EXPO_PUBLIC_LOCAL_DAEMON=127.0.0.1:6871 EXPO_PUBLIC_BC_HOST_PERF=1 npx expo start --dev-client --port 8085 > "$BC_ROOT/logs/metro.log" 2>&1 < /dev/null &
echo $! > "$BC_ROOT/metro.pid"
for attempt in {1..60}; do curl -sf http://127.0.0.1:8085/status >/dev/null && break; sleep 2; done
node "$BC_ROOT/tools/run-native.mjs" > "$ROOT/logs/history-ios.log" 2>&1
node "$BC_ROOT/tools/capture-errors.mjs" "$BC_ROOT/raw" "$BC_ROOT/logs/metro.log"
node "$BC_ROOT/tools/audit.mjs" "$BC_ROOT/raw" > "$ROOT/logs/history-audit.log" 2>&1
node "$BC_ROOT/tools/report.mjs" "$BC_ROOT/raw" > "$ROOT/logs/history-report.txt"
"$BC_ROOT/run-env.sh" --full-scroll > "$ROOT/logs/full-scroll.log" 2>&1
node "$ROOT/tools/report.mjs" "$ROOT/raw" > "$ROOT/logs/report.txt"
node --test "$ROOT/tools/"*.test.mjs "$BC_ROOT/tools/"*.test.mjs > "$ROOT/logs/tool-tests.txt" 2>&1
cd "$ROOT/candidate"
npx vitest run test/unit/long-history-fixture.test.ts test/unit/turn-footers.test.ts test/unit/turn-footer.test.ts test/unit/timeline-order.test.ts test/unit/live-turn-footer.test.ts test/unit/assistant-transform.test.ts test/unit/host-row-gap.test.ts > "$ROOT/logs/vitest.txt" 2>&1
npm run typecheck > "$ROOT/logs/typecheck.txt" 2>&1
npm run check:hermes > "$ROOT/logs/hermes.txt" 2>&1
