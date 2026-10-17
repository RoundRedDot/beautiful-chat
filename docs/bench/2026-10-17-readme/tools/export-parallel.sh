#!/bin/zsh
set -eu
source /tmp/bc-readme-20261017/parallel-v2/lane${1}/environment.sh
trap 'echo $? > "$BC_LANE_ROOT/export.status"' EXIT
cd "$BC_HOST/packages/app"
env CI=1 APP_VARIANT=development BC_REACT_PROFILING=1 EXPO_PUBLIC_LOCAL_DAEMON=127.0.0.1:${BC_BENCH_PORT} EXPO_PUBLIC_BC_HOST_PERF=1 TMPDIR="$BC_LANE_ROOT/tmp" EXPO_HOME="$BC_LANE_ROOT/expo-home" EXPO_NO_TELEMETRY=1 npx expo export --platform web --output-dir "$BC_LANE_ROOT/web-dist" --max-workers 2
