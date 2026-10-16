#!/bin/zsh
set -e
source /tmp/bc-history-complete-20261016/tools/environment.sh
trap 'echo $? > "$BC_ROOT/resume.status"' EXIT
BC_FIXTURE_SOURCE="$BC_ROOT/candidate/test/fixtures/streams/history-long-load.jsonl" node --test "$BC_ROOT/tools/"*.test.mjs > "$BC_ROOT/logs/tool-tests-concurrent.txt" 2>&1
BC_HISTORY_RESUME_CONCURRENT=1 node "$BC_ROOT/tools/run-native.mjs" > "$BC_ROOT/logs/ios-concurrent.log" 2>&1
node "$BC_ROOT/tools/capture-errors.mjs" "$BC_ROOT/raw" "$BC_ROOT/logs/metro-formal.log"
node "$BC_ROOT/tools/report.mjs" "$BC_ROOT" > "$BC_ROOT/logs/audit.txt"
node "$BC_ROOT/tools/verify-source.mjs" "$BC_ROOT" > "$BC_ROOT/logs/source-audit-final.txt"
