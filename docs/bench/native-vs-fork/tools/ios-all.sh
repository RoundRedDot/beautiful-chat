#!/bin/zsh
# All fixtures, both modes, modes alternating per fixture (ABBA across reps).
#   ios-all.sh <reps> [fixture:speed ...]
here=${0:A:h}
reps=$1; shift
specs=(codeblock-streaming:1 diff-large:1 history-100:max markdown-long:1 mixed-turn:1 reads-20:1
  reasoning-long-prose:1 reasoning-long-sections:1 shell-log-large:1 table-streaming:1 tool-expanded-streaming:4)
[ $# -gt 0 ] && specs=($@)
for rep in $(seq 1 $reps); do
  i=0
  for spec in $specs; do
    i=$((i+1))
    f=${spec%%:*}; s=${spec##*:}
    if [ $(( (rep + i) % 2 )) -eq 1 ]; then order=(native fork); else order=(fork native); fi
    for m in $order; do $here/ios-ab.sh $m $f $s $rep; done
  done
done
