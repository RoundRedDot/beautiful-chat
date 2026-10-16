#!/bin/zsh
set -eu
export PATH=/opt/homebrew/bin:$PATH
lane=$1
[[ "$lane" == 2 || "$lane" == 3 || "$lane" == 4 ]]
root=/tmp/bc-ios-five-parallel-20261016/lane${lane}
if lsof -nP -iTCP:818${lane} -sTCP:LISTEN; then exit 1; fi
cd "$root/host/packages/app"
nohup env CI=1 APP_VARIANT=development EXPO_PUBLIC_LOCAL_DAEMON=127.0.0.1:688${lane} EXPO_PUBLIC_BC_HOST_PERF=1 TMPDIR="$root/tmp" EXPO_HOME="$root/expo-home" EXPO_NO_TELEMETRY=1 npx expo start --dev-client --port 818${lane} --max-workers 2 > "$root/logs/metro-capped.log" 2>&1 < /dev/null &
echo $! > "$root/metro.pid"
