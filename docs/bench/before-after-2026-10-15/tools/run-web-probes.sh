#!/bin/zsh
set -euo pipefail
source ~/.nvm/nvm.sh >/dev/null
nvm use 24 >/dev/null
source /tmp/bc-ba/tools/env-ba.sh
reps=${1:-3}
rep_start=${2:-1}
date -Iseconds
date -u +%FT%TZ
node /tmp/bc-ba/tools/web-probes-ba.mjs --reps "$reps" --rep-start "$rep_start" --out /tmp/bc-ba/raw/probes
date -Iseconds
date -u +%FT%TZ
