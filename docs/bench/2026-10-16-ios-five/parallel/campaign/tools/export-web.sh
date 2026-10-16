#!/bin/zsh
set -eu
export PATH=/opt/homebrew/bin:$PATH
lane=$1
[[ "$lane" == 2 || "$lane" == 3 || "$lane" == 4 ]]
root=/tmp/bc-ios-five-parallel-20261016/lane${lane}
[[ $(cat "$root/core.status") == 0 ]]
[[ ! -e "$root/web-dist" ]]
node /tmp/bc-ios-five-parallel-20261016/tools/quiesce-native.mjs "$lane"
mkdir -p "$root/tmp-web" "$root/expo-home-web"
node - "$lane" <<'JS'
const fs=require('node:fs'),{execFileSync}=require('node:child_process'),lane=Number(process.argv[2]),home=`/Users/rrd/.paseo-bench-ios-five-lane${lane}`,root=`/tmp/bc-ios-five-parallel-20261016/lane${lane}`;
fs.writeFileSync(`${root}/activity.json`,JSON.stringify({lane,stage:'web-export',at:new Date().toISOString(),executionRegime:'concurrent-max4'}));
const config=JSON.parse(fs.readFileSync(`${home}/config.json`));
const origins=[...new Set([...(config.daemon?.cors?.allowedOrigins??['https://app.paseo.sh']),`http://127.0.0.1:${8280+lane}`,`http://localhost:${8280+lane}`])];
const cli='/tmp/bc-perf-p0p1/paseo-cli/node_modules/.bin/paseo';
execFileSync(cli,['--home',home,'daemon','config','set','daemon.cors.allowedOrigins',JSON.stringify(origins)],{stdio:'inherit'});
execFileSync(cli,['--home',home,'daemon','reload'],{stdio:'inherit'});
JS
cd "$root/host/packages/app"
env CI=1 APP_VARIANT=development BC_REACT_PROFILING=1 EXPO_PUBLIC_LOCAL_DAEMON=127.0.0.1:688${lane} EXPO_PUBLIC_BC_HOST_PERF=1 TMPDIR="$root/tmp-web" EXPO_HOME="$root/expo-home-web" EXPO_NO_TELEMETRY=1 npx expo export --platform web --output-dir "$root/web-dist" --max-workers 2
