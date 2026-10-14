#!/bin/zsh
# All fixtures. With BC_MODES unset this is the original ABBA alternation of
# native and fork. Set BC_MODES to a comma-separated list (for example
# native,fork,upstream) to rotate that list per fixture and rep, the same way
# web-ab.mjs rotates three modes.
#
#   ios-all.sh <reps> [fixture:speed ...]
#   BC_REP_START   first rep number (default 1)
set -u
here=${0:A:h}
reps=$1; shift
start=${BC_REP_START:-1}
specs=(codeblock-streaming:1 diff-large:1 history-100:max markdown-long:1 mixed-turn:1 reads-20:1
  reasoning-long-prose:1 reasoning-long-sections:1 shell-log-large:1 table-streaming:1 tool-expanded-streaming:4)
[ $# -gt 0 ] && specs=($@)
echo "uptime: $(uptime)"
end=$(( start + reps - 1 ))
for rep in $(seq "$start" "$end"); do
  i=0
  for spec in $specs; do
    i=$(( i + 1 ))
    f=${spec%%:*}
    s=${spec##*:}
    if [ -z "${BC_MODES:-}" ]; then
      if [ $(( (rep + i) % 2 )) -eq 1 ]; then order=(native fork); else order=(fork native); fi
    else
      modes=(${(s:,:)BC_MODES})
      n=${#modes}
      order=()
      if [ "$n" -eq 2 ]; then
        if [ $(( (rep + i - 1) % 2 )) -eq 1 ]; then order=($modes); else order=($modes[2] $modes[1]); fi
      else
        for (( k = 0; k < n; k++ )); do
          idx=$(( (rep + i - 1 + k) % n ))
          order+=($modes[$(( idx + 1 ))])
        done
      fi
    fi
    echo "schedule rep=$rep fixture=$f speed=$s order=${(j:,:)order}"
    for m in $order; do
      "$here/ios-ab.sh" "$m" "$f" "$s" "$rep" || exit 1
    done
  done
done
