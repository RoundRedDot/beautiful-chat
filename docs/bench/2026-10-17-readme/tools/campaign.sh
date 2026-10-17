#!/bin/zsh
set -e
source /tmp/bc-readme-20261017/tools/environment.sh
trap 'echo $? > /tmp/bc-readme-20261017/campaign.status' EXIT
node "$BC_ROOT/tools/verify-source.mjs" "$BC_ROOT" > "$BC_ROOT/logs/source-audit-before.log"
node "$BC_ROOT/tools/replay.mjs" web --smoke > "$BC_ROOT/logs/web-smoke.log" 2>&1
node "$BC_ROOT/tools/replay.mjs" web > "$BC_ROOT/logs/web.log" 2>&1
source "$BC_ROOT/history/tools/environment.sh"
node "$BC_ROOT/tools/run-web.mjs" --smoke > "$BC_ROOT/logs/web-smoke.log" 2>&1
node "$BC_ROOT/tools/run-web.mjs" > "$BC_ROOT/logs/web.log" 2>&1
source /tmp/bc-readme-20261017/tools/environment.sh
xcrun simctl boot "$BC_SIM_UDID"
xcrun simctl bootstatus "$BC_SIM_UDID" -b
cd /tmp/bc-ios/paseo/packages/app
nohup env CI=1 APP_VARIANT=development EXPO_PUBLIC_LOCAL_DAEMON=127.0.0.1:6871 EXPO_PUBLIC_BC_HOST_PERF=1 npx expo start --dev-client --port 8085 > "$BC_ROOT/logs/metro.log" 2>&1 < /dev/null &
echo $! > "$BC_ROOT/metro.pid"
for attempt in {1..60}; do curl -sf http://127.0.0.1:8085/status >/dev/null && break; sleep 2; done
node "$BC_ROOT/tools/replay.mjs" ios --smoke > "$BC_ROOT/logs/ios-smoke.log" 2>&1
node "$BC_ROOT/tools/replay.mjs" ios > "$BC_ROOT/logs/ios.log" 2>&1
source "$BC_ROOT/history/tools/environment.sh"
node "$BC_ROOT/tools/run-native.mjs" --smoke > "$BC_ROOT/logs/ios-smoke.log" 2>&1
node "$BC_ROOT/tools/run-native.mjs" > "$BC_ROOT/logs/ios.log" 2>&1
node "$BC_ROOT/tools/capture-errors.mjs" "$BC_ROOT/raw" /tmp/bc-readme-20261017/logs/metro.log
node "$BC_ROOT/tools/report.mjs" "$BC_ROOT" > "$BC_ROOT/logs/audit.log" 2>&1
source /tmp/bc-readme-20261017/tools/environment.sh
node "$BC_ROOT/tools/verify-source.mjs" "$BC_ROOT" > "$BC_ROOT/logs/source-audit-after.log"
