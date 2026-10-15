#!/bin/zsh
set -euo pipefail
source ~/.nvm/nvm.sh >/dev/null
nvm use 24 >/dev/null
source /tmp/bc-ba/tools/env-ba.sh
scenario=${1:?scenario is required}
reps=${2:-5}
rep_start=${3:-1}
date -Iseconds
date -u +%FT%TZ
uptime
node /tmp/bc-ba/tools/web-special-ba.mjs --scenario "$scenario" --reps "$reps" --rep-start "$rep_start" --modes before,before2,after --out /tmp/bc-ba/raw/web-special
date -Iseconds
date -u +%FT%TZ
uptime
