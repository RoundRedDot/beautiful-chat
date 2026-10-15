#!/bin/zsh
set -euo pipefail
source ~/.nvm/nvm.sh >/dev/null
nvm use 24 >/dev/null

for mode in after before before2; do
  (cd "/tmp/bc-ba/$mode" && npm ci --include=dev) >"/tmp/bc-ba/logs/npm-ci-$mode.log" 2>&1
done

(cd /tmp/bc-ba/after/tools/bench-provider && npm ci && npm run setup) >/tmp/bc-ba/logs/bench-provider.log 2>&1
