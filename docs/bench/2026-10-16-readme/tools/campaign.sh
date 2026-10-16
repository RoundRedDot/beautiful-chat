#!/bin/zsh
set -e
export PATH=/opt/homebrew/bin:$PATH
ROOT=/tmp/bc-readme-20261016
trap 'echo $? > "$ROOT/campaign.status"' EXIT
BC_SMOKE_LABEL=3 zsh "$ROOT/tools/env.sh" web --smoke > "$ROOT/logs/web-smoke3.log" 2>&1
zsh "$ROOT/tools/env.sh" web > "$ROOT/logs/web.log" 2>&1
xcrun simctl boot 4497FFF9-93D1-4713-B55B-A9988BC2209E
xcrun simctl bootstatus 4497FFF9-93D1-4713-B55B-A9988BC2209E -b
cd /tmp/bc-ios/paseo/packages/app
nohup env CI=1 APP_VARIANT=development EXPO_PUBLIC_LOCAL_DAEMON=127.0.0.1:6871 EXPO_PUBLIC_BC_HOST_PERF=1 npx expo start --dev-client --port 8085 > "$ROOT/logs/metro.log" 2>&1 < /dev/null &
echo $! > "$ROOT/metro.pid"
for attempt in {1..60}; do
  curl -sf http://127.0.0.1:8085/status >/dev/null && break
  sleep 2
done
zsh "$ROOT/tools/env.sh" ios --smoke > "$ROOT/logs/ios-smoke.log" 2>&1
zsh "$ROOT/tools/env.sh" ios > "$ROOT/logs/ios.log" 2>&1
