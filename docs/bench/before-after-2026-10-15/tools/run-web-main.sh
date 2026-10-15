#!/bin/zsh
set -euo pipefail
source ~/.nvm/nvm.sh >/dev/null
nvm use 24 >/dev/null
source /tmp/bc-ba/tools/env-ba.sh
reps=${1:-5}
rep_start=${2:-1}
date -Iseconds
date -u +%FT%TZ
uptime
node /tmp/bc-ba/tools/web-ba.mjs --reps "$reps" --rep-start "$rep_start" --modes before,before2,after --out /tmp/bc-ba/raw/web
date -Iseconds
date -u +%FT%TZ
uptime
