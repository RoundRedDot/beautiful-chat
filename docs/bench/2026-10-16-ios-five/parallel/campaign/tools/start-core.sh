#!/bin/zsh
set -eu
export PATH=/opt/homebrew/bin:$PATH
root=/tmp/bc-ios-five-parallel-20261016
for lane in 2 3 4; do
  [[ $(cat "$root/lane${lane}/smoke.status") == 0 ]]
done
node - "$root" <<'JS'
const fs=require('node:fs'),root=process.argv[2];
for(const l of [2,3,4])for(const file of ['functional.json',`lane${l}-native-diff-large-r0.json`,`lane${l}-parent-diff-large-r0.json`])if(!JSON.parse(fs.readFileSync(`${root}/lane${l}/raw/smoke/${file}`)).completed)throw Error('smoke barrier failed');
JS
for lane in 2 3 4; do
  [[ ! -e "$root/lane${lane}/core.pid" ]]
done
date -u > "$root/raw/formal-start.txt"
for lane in 2 3 4; do
  nohup node "$root/tools/runner.mjs" "$lane" core > "$root/lane${lane}/logs/core.log" 2>&1 < /dev/null &
  echo $! > "$root/lane${lane}/core.pid"
done
