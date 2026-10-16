#!/bin/zsh
set -eu
export PATH=/opt/homebrew/bin:$PATH
lane=$1
[[ "$lane" == 2 || "$lane" == 3 || "$lane" == 4 ]]
root=/tmp/bc-ios-five-parallel-20261016/lane${lane}
home=/Users/rrd/.paseo-bench-ios-five-lane${lane}
cli=/tmp/bc-perf-p0p1/paseo-cli/node_modules/.bin/paseo
[[ ! -e "$root/host" && ! -e "$home" ]]
date -u
cp -cR /tmp/bc-ios/paseo "$root/host"
for variant in parent fixed; do
  cp -cR /tmp/bc-ios-five-parallel-20261016/source/$variant "$root/$variant"
  ln -s /tmp/bc-readme-20261016/candidate/node_modules "$root/$variant/node_modules"
done
cp -cR "$root/fixed/tools/bench-provider" "$root/provider"
ln -s /tmp/bc-v5/latest/tools/bench-provider/node_modules "$root/provider/node_modules"
printf 'export const FIXTURES_DIR = %s;\n' "\"$root/fixed/test/fixtures/streams\"" > "$root/provider/server/fixtures-dir.generated.ts"
ln -s "$root/fixed" "$root/active"
"$cli" --home "$home" daemon config set daemon.listen 127.0.0.1:688${lane}
"$cli" --home "$home" daemon start > "$root/logs/daemon-start.log" 2>&1
"$cli" --home "$home" plugin install "$root/provider" --json > "$root/raw/provider-install.json"
"$cli" --home "$home" plugin install "$root/active" --json > "$root/raw/plugin-install.json"
"$cli" --home "$home" workspace create --isolation local --path "$root/workspace" --json > "$root/raw/workspace.json"
udid=$(xcrun simctl create bc-five-parallel-${lane} com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro com.apple.CoreSimulator.SimRuntime.iOS-18-6)
printf '%s\n' "$udid" > "$root/sim.udid"
xcrun simctl boot "$udid"
xcrun simctl bootstatus "$udid" -b
app=/Users/rrd/Library/Developer/CoreSimulator/Devices/4497FFF9-93D1-4713-B55B-A9988BC2209E/data/Containers/Bundle/Application/CA308A1E-72F8-4DA1-A8D2-DB3E58943CBB/PaseoDebug.app
xcrun simctl install "$udid" "$app"
cd "$root/host/packages/app"
nohup env CI=1 APP_VARIANT=development EXPO_PUBLIC_LOCAL_DAEMON=127.0.0.1:688${lane} EXPO_PUBLIC_BC_HOST_PERF=1 TMPDIR="$root/tmp" EXPO_HOME="$root/expo-home" EXPO_NO_TELEMETRY=1 npx expo start --dev-client --port 818${lane} > "$root/logs/metro.log" 2>&1 < /dev/null &
echo $! > "$root/metro.pid"
printf 'prepared %s %s\n' "$lane" "$udid"
