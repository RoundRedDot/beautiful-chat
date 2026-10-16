#!/bin/zsh
set -e
source /tmp/bc-history-complete-20261016/tools/environment.sh
trap 'echo $? > "$BC_ROOT/calibration.status"' EXIT
while kill -0 "$(cat "$BC_ROOT/web-smoke.pid")" 2>/dev/null; do sleep 2; done
node --input-type=module <<'NODE'
import fs from 'node:fs';
const root=process.env.BC_ROOT;
for(const mode of ['candidate','baseline','native']){
  const row=JSON.parse(fs.readFileSync(`${root}/raw/web/smoke3-incident-${mode}-1.json`));
  if(!row.completed||row.error||row.displayErrors.length||!row.sessionPreparation.unmounted||!row.phases.sessionRemount.remounted)throw Error('Web calibration failed '+mode);
}
NODE
node "$BC_ROOT/tools/verify-source.mjs" "$BC_ROOT" > "$BC_ROOT/logs/source-audit.txt"
xcrun simctl boot "$BC_SIM_UDID"
xcrun simctl bootstatus "$BC_SIM_UDID" -b
cd /tmp/bc-ios/paseo/packages/app
nohup env CI=1 APP_VARIANT=development EXPO_PUBLIC_LOCAL_DAEMON=127.0.0.1:6871 EXPO_PUBLIC_BC_HOST_PERF=1 npx expo start --dev-client --port 8085 > "$BC_ROOT/logs/metro-smoke.log" 2>&1 < /dev/null &
echo $! > "$BC_ROOT/metro.pid"
for attempt in {1..60}; do curl -sf http://127.0.0.1:8085/status >/dev/null && break; sleep 2; done
BC_RUN_PREFIX=smoke- node "$BC_ROOT/tools/run-native.mjs" --smoke > "$BC_ROOT/logs/ios-smoke.log" 2>&1
