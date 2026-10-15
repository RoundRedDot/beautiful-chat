#!/bin/zsh
# rec.sh <label> <fixture> <speed> <plugin on|off>
source ~/.nvm/nvm.sh >/dev/null; nvm use 24 >/dev/null
label=$1 fixture=$2 speed=$3 plugin=$4
U=$(cat /tmp/bc-ss/udid); H=$HOME/.paseo-bench-ss; P=(/tmp/bc-perf-p0p1/paseo-cli/node_modules/.bin/paseo --home $H)
SID=$(cat $H/server-id)
if [ $plugin = on ]; then $P plugin enable better-paseo >/dev/null; else $P plugin disable better-paseo >/dev/null; fi
sleep 3
xcrun simctl terminate $U sh.paseo.debug 2>/dev/null; sleep 1
xcrun simctl launch $U sh.paseo.debug --initialUrl http://localhost:8096 >/dev/null
for i in $(seq 1 40); do sleep 2; curl -sf http://127.0.0.1:8098/seen | grep -qE '"msAgo":[0-9]{1,4}[,}]' && break; done
sleep 6
aid=$($P run -d -q --provider bc-bench --cwd /tmp/bc-ss/project --title "rec-$label" list 2>/dev/null | tail -1)
$P wait $aid --timeout 60 >/dev/null 2>&1
for n in 1 2; do curl -sf -X POST http://127.0.0.1:8098/queue -d "{\"cmd\":\"open\",\"url\":\"paseo:///h/$SID/agent/$aid\"}" >/dev/null; sleep 5; done
rm -f /tmp/bc-ss/video/$label.mp4
xcrun simctl io $U recordVideo --codec=h264 --force /tmp/bc-ss/video/$label.mp4 >/dev/null 2>&1 &
rec=$!
sleep 2
$P send $aid "fixture:$fixture speed:$speed" >/dev/null
$P wait $aid --timeout 300 >/dev/null 2>&1
sleep 3
kill -INT $rec; wait $rec 2>/dev/null
xcrun simctl io $U screenshot /tmp/bc-ss/video/$label-end.png >/dev/null 2>&1
$P archive $aid >/dev/null 2>&1
ls -la /tmp/bc-ss/video/$label.mp4 | awk '{print $5, $9}'
