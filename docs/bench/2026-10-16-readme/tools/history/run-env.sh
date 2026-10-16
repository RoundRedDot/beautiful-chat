#!/bin/zsh
source /tmp/bc-readme-20261016/tools/environment-only.sh
export BC_ROOT=/tmp/bc-readme-20261016/history
if [ "${1:-}" = --full-scroll ]; then
  exec node "$BC_ROOT/tools/full-scroll.mjs"
fi
exec node "$BC_ROOT/tools/run-native.mjs" "$@"
