#!/bin/zsh
set -euo pipefail
source ~/.nvm/nvm.sh >/dev/null
nvm use 24 >/dev/null
source /tmp/bc-ba/tools/env-ba.sh
if lsof -nP -iTCP:8092 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "port 8092 is already in use" >&2
  exit 1
fi
nohup node /tmp/bc-ba/tools/serve-web.mjs /tmp/bc-perf-p0p1/web-dist 8092 >/tmp/bc-ba/logs/web-server.log 2>&1 </dev/null &
echo $! >/tmp/bc-ba/logs/web-server.pid
