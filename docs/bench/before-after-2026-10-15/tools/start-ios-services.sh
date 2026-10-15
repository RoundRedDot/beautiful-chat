#!/bin/zsh
set -euo pipefail
source ~/.nvm/nvm.sh >/dev/null
nvm use 24 >/dev/null
source /tmp/bc-ba/tools/env-ba.sh
for port in 8085 8099 3160; do
  if lsof -nP -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1; then
    echo "port $port is already in use" >&2
    exit 1
  fi
done
nohup node /tmp/bc-ba/tools/control-server.mjs /tmp/bc-ba/raw/ios 8099 >/tmp/bc-ba/logs/control-server.log 2>&1 </dev/null &
echo $! >/tmp/bc-ba/logs/control-server.pid
cd /tmp/bc-ios/paseo/packages/app
nohup env CI=1 APP_VARIANT=development EXPO_PUBLIC_BC_HOST_PERF=1 EXPO_PUBLIC_LOCAL_DAEMON=localhost:6871 npx expo start --dev-client --port 8085 >/tmp/bc-ba/logs/metro.log 2>&1 </dev/null &
echo $! >/tmp/bc-ba/logs/metro.pid
/tmp/bc-ios/paseo/node_modules/.bin/serve-sim --detach -p 3160 --no-preview "$BC_SIM_UDID" >/tmp/bc-ba/logs/serve-sim.log 2>&1
