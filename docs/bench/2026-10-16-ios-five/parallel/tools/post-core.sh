#!/bin/zsh
set -eu
export PATH=/opt/homebrew/bin:$PATH
root=/tmp/bc-ios-five-parallel-20261016
trap 'echo $? > "$root/post.status"' EXIT
wait_phase() {
  local phase=$1
  while true; do
    local done=0
    for lane in 2 3 4; do
      if [[ -f "$root/lane${lane}/${phase}.status" ]]; then
        [[ $(cat "$root/lane${lane}/${phase}.status") == 0 ]]
        done=$((done+1))
      fi
    done
    [[ "$done" != 3 ]] || break
    sleep 5
  done
}
wait_phase core
node "$root/tools/audit.mjs" "$root" core > "$root/logs/core-audit.txt" 2>&1
for lane in 2 3 4; do
  nohup node "$root/tools/runner.mjs" "$lane" risk > "$root/lane${lane}/logs/risk.log" 2>&1 < /dev/null &
  echo $! > "$root/lane${lane}/risk.pid"
done
wait_phase risk
node "$root/tools/audit.mjs" "$root" risk > "$root/logs/risk-audit.txt" 2>&1
for lane in 2 3 4; do
  zsh "$root/tools/export-web.sh" "$lane" > "$root/lane${lane}/logs/web-export.log" 2>&1 &
  echo $! > "$root/lane${lane}/export.pid"
done
for lane in 2 3 4; do wait $(cat "$root/lane${lane}/export.pid"); done
for lane in 2 3 4; do
  if lsof -nP -iTCP:828${lane} -sTCP:LISTEN; then exit 1; fi
  nohup node "$root/tools/serve-web.mjs" "$root/lane${lane}/web-dist" 828${lane} > "$root/lane${lane}/logs/web-serve.log" 2>&1 < /dev/null &
  echo $! > "$root/lane${lane}/web.pid"
done
for lane in 2 3 4; do
  nohup node "$root/tools/web-runner.mjs" "$lane" --smoke > "$root/lane${lane}/logs/web-smoke.log" 2>&1 < /dev/null &
  echo $! > "$root/lane${lane}/web-smoke.pid"
done
wait_phase web-smoke
for lane in 2 3 4; do
  nohup node "$root/tools/web-runner.mjs" "$lane" > "$root/lane${lane}/logs/web-risk.log" 2>&1 < /dev/null &
  echo $! > "$root/lane${lane}/web-risk.pid"
done
wait_phase web-risk
node "$root/tools/audit.mjs" "$root" web-risk > "$root/logs/web-risk-audit.txt" 2>&1
