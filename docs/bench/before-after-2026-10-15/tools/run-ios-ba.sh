#!/bin/zsh
set -euo pipefail
source ~/.nvm/nvm.sh >/dev/null
nvm use 24 >/dev/null
source /tmp/bc-ba/tools/env-ba.sh
export BC_MODES=before,before2,after
export BC_BEFORE_DIR=/tmp/bc-ba/before
export BC_BEFORE2_DIR=/tmp/bc-ba/before2
export BC_AFTER_DIR=/tmp/bc-ba/after
export BC_PLUGIN_LINK=/tmp/bc-ba/bench-active
export BC_PASEO_BIN=/tmp/bc-perf-p0p1/paseo-cli/node_modules/.bin/paseo
export OUT=/tmp/bc-ba/raw/ios
export BC_IDENTITY_ATTEMPTS=3
reps=${1:-3}
date -Iseconds
date -u +%FT%TZ
uptime
zsh /tmp/bc-ba/tools/ios-ba-all.sh "$reps"
date -Iseconds
date -u +%FT%TZ
uptime
