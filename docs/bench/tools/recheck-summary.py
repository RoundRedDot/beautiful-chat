import json,glob,sys,statistics as st,os
out=sys.argv[1]
rows={}
for f in glob.glob(out+'/prab-*.json'):
    r=json.load(open(f))
    d=json.load(open('/tmp/bc-perf/'+r['dumpFile'])) if r.get('dumpFile') else {}
    s=d.get('snapshot',{})
    cm=s.get('commitMs',{})
    busiest=max(cm.items(), key=lambda kv: kv[1].get('p95',0)) if cm else (None,{})
    rows.setdefault((r['fixture'],r['mode']),[]).append(dict(
        end=r['heapEnd'],ret=r['heapRetained'],start=r['heapStart'],grow=r['heapRetained']-r['heapStart'],
        dump=(d.get('heapBytes') or 0)/1048576, p95=busiest[1].get('p95'), kind=busiest[0],
        up50=cm.get('user_message',{}).get('p50'), up95=cm.get('user_message',{}).get('p95'), un=cm.get('user_message',{}).get('count'),
        drop=s.get('frames',{}).get('droppedRatio'), lt=s.get('longTasks',{}).get('count'), rep=r['rep']))
med=lambda xs:st.median([x for x in xs if x is not None]) if any(x is not None for x in xs) else None
fmt=lambda v:'-' if v is None else (f'{v:.1f}' if isinstance(v,float) else str(v))
print('| fixture | mode | n | end heap | retained | growth | dump heapBytes | busiest p95 | user p50/p95 (n) | dropped |')
print('|---|---|---|---|---|---|---|---|---|---|')
for (fx,mode) in sorted(rows):
    rs=rows[(fx,mode)]
    print(f"| {fx} | {mode} | {len(rs)} | {fmt(med([r['end'] for r in rs]))} | {fmt(med([r['ret'] for r in rs]))} | {fmt(med([r['grow'] for r in rs]))} | {fmt(med([r['dump'] for r in rs]))} | {fmt(med([r['p95'] for r in rs]))} ({rs[0]['kind']}) | {fmt(med([r['up50'] for r in rs]))}/{fmt(med([r['up95'] for r in rs]))} ({fmt(med([r['un'] for r in rs]))}) | {fmt(med([r['drop'] for r in rs]))} |")
