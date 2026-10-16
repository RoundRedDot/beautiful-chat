#!/bin/zsh
set -e
source /tmp/bc-history-complete-20261016/tools/environment.sh
trap 'echo $? > "$BC_ROOT/campaign.status"' EXIT
while kill -0 "$(cat "$BC_ROOT/calibration.pid")" 2>/dev/null; do sleep 3; done
[ "$(cat "$BC_ROOT/calibration.status")" = 0 ]
node --input-type=module <<'NODE'
import fs from'node:fs';import{execFileSync}from'node:child_process';
const root=process.env.BC_ROOT;
for(const mode of ['candidate','baseline','native']){
 const s=JSON.parse(fs.readFileSync(`${root}/raw/ios/smoke2-incident-${mode}-1.json`));
 if(!s.completed||s.error||!s.sessionPreparation.unmounted||!s.phases.sessionRemount.remounted||(mode==='candidate'&&!s.returnCopyGate.exactMatch))throw Error('native smoke failed '+mode);
}
const app=execFileSync('xcrun',['simctl','get_app_container',process.env.BC_SIM_UDID,'sh.paseo.debug','app'],{encoding:'utf8'}).trim();
const version=execFileSync('/usr/libexec/PlistBuddy',['-c','Print :CFBundleShortVersionString',app+'/Info.plist'],{encoding:'utf8'}).trim();
const build=execFileSync('/usr/libexec/PlistBuddy',['-c','Print :CFBundleVersion',app+'/Info.plist'],{encoding:'utf8'}).trim();
if(version!=='0.11.2'||build!=='11002999')throw Error('native binary identity mismatch');
fs.writeFileSync(root+'/raw/native-environment.json',JSON.stringify({version,build,app,simulator:process.env.BC_SIM_UDID},null,2));
NODE
BC_FIXTURE_SOURCE="$BC_ROOT/candidate/test/fixtures/streams/history-long-load.jsonl" node --test "$BC_ROOT/tools/"*.test.mjs > "$BC_ROOT/logs/tool-tests.txt" 2>&1
xcrun simctl terminate "$BC_SIM_UDID" sh.paseo.debug
xcrun simctl shutdown "$BC_SIM_UDID"
node "$BC_ROOT/tools/stop-metro.mjs" "$BC_ROOT/metro.pid" > "$BC_ROOT/logs/metro-smoke-stop.txt"
BC_WEB_HISTORY_PREFIX=smoke4- node "$BC_ROOT/tools/run-web.mjs" --smoke > "$BC_ROOT/logs/web-smoke4.log" 2>&1
node --input-type=module <<'NODE'
import fs from'node:fs';const root=process.env.BC_ROOT;
for(const mode of ['candidate','baseline','native']){const s=JSON.parse(fs.readFileSync(`${root}/raw/web/smoke4-incident-${mode}-1.json`));if(!s.completed||s.error||s.displayErrors.length||(mode==='candidate'&&!s.returnCopyGate.exactMatch))throw Error('Web smoke failed '+mode);}
NODE
node "$BC_ROOT/tools/run-web.mjs" > "$BC_ROOT/logs/web.log" 2>&1
node "$BC_ROOT/tools/verify-source.mjs" "$BC_ROOT" > "$BC_ROOT/logs/source-audit-after-web.txt"
xcrun simctl boot "$BC_SIM_UDID"
xcrun simctl bootstatus "$BC_SIM_UDID" -b
cd /tmp/bc-ios/paseo/packages/app
nohup env CI=1 APP_VARIANT=development EXPO_PUBLIC_LOCAL_DAEMON=127.0.0.1:6871 EXPO_PUBLIC_BC_HOST_PERF=1 npx expo start --dev-client --port 8085 > "$BC_ROOT/logs/metro-formal.log" 2>&1 < /dev/null &
echo $! > "$BC_ROOT/metro.pid"
for attempt in {1..60}; do curl -sf http://127.0.0.1:8085/status >/dev/null && break; sleep 2; done
node "$BC_ROOT/tools/run-native.mjs" > "$BC_ROOT/logs/ios.log" 2>&1
node "$BC_ROOT/tools/capture-errors.mjs" "$BC_ROOT/raw" "$BC_ROOT/logs/metro-formal.log"
node "$BC_ROOT/tools/report.mjs" "$BC_ROOT" > "$BC_ROOT/logs/audit.txt"
node "$BC_ROOT/tools/verify-source.mjs" "$BC_ROOT" > "$BC_ROOT/logs/source-audit-final.txt"
