#!/bin/zsh
set -eu
export PATH=/opt/homebrew/bin:$PATH
root=/tmp/bc-readme-20261017
trap 'echo $? > "$root/parallel-v2/post.status"' EXIT
for lane in 1 2 3 4; do
  while [[ ! -e "$root/parallel-v2/lane${lane}/campaign.status" ]]; do sleep 5; done
  [[ $(cat "$root/parallel-v2/lane${lane}/campaign.status") == 0 ]]
done
node "$root/tools/verify-source.mjs" "$root" > "$root/logs/source-audit-after.log"
node "$root/tools/aggregate.mjs" "$root" > "$root/parallel-v2/audit.log" 2>&1
node "$root/tools/cleanup-parallel.mjs" > "$root/parallel-v2/cleanup.log" 2>&1
