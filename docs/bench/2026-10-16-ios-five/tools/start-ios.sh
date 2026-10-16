#!/bin/zsh
set -eu
export PATH=/opt/homebrew/bin:$PATH
ROOT=/tmp/bc-ios-five-20261016
if lsof -nP -iTCP:8085 -sTCP:LISTEN; then exit 1; fi
cd /tmp/bc-ios/paseo/packages/app
nohup env CI=1 APP_VARIANT=development EXPO_PUBLIC_LOCAL_DAEMON=127.0.0.1:6871 EXPO_PUBLIC_BC_HOST_PERF=1 npx expo start --dev-client --port 8085 > "$ROOT/logs/metro.log" 2>&1 < /dev/null &
echo $! > "$ROOT/metro.pid"
