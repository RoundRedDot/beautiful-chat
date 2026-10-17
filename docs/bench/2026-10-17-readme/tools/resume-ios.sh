#!/bin/zsh
set -eu
source /tmp/bc-readme-20261017/parallel-v2/lane${1}/environment.sh
trap 'echo $? > "$BC_LANE_ROOT/campaign.status"' EXIT
# All four dedicated simulators have completed first-launch onboarding.
# Earlier failed calibration records remain under their original smoke2 prefix.
export BC_ROOT="$BC_LANE_ROOT/history"
BC_RUN_PREFIX=smoke3- node "$BC_ROOT/tools/run-native.mjs" --smoke > "$BC_ROOT/logs/ios-smoke3.log" 2>&1
touch "$BC_LANE_ROOT/ios-smoke3.done"
for lane in 1 2 3 4; do
  while [[ ! -e /tmp/bc-readme-20261017/parallel-v2/lane${lane}/ios-smoke3.done ]]; do sleep 2; done
done
export BC_ROOT="$BC_LANE_ROOT"
node "$BC_ROOT/tools/replay-parallel.mjs" ios > "$BC_ROOT/logs/ios.log" 2>&1
export BC_ROOT="$BC_LANE_ROOT/history"
node "$BC_ROOT/tools/run-native.mjs" > "$BC_ROOT/logs/ios.log" 2>&1
touch "$BC_LANE_ROOT/ios.done"
