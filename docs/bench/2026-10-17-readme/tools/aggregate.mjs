import {readFileSync,readdirSync,writeFileSync,mkdirSync,copyFileSync,realpathSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {summarize,fixtures,median} from './report.mjs';
import {summarize as historySummary} from '../history/tools/report.mjs';
import {verifyProvenance} from './verify-provenance.mjs';

export function concurrency(rows){
  const intervals=rows.map(row=>({lane:row.lane,label:row.label??`${row.platform}/${row.fixture}/${row.mode}/${row.rep}`,start:Date.parse(row.startedAt),end:Date.parse(row.endedAt)}));
  if(intervals.some(i=>!Number.isFinite(i.start)||!Number.isFinite(i.end)||i.end<=i.start))throw Error('complete actual timing intervals required');
  const events=intervals.flatMap(i=>[[i.start,1],[i.end,-1]]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  let active=0,maximum=0;for(const [,delta]of events){active+=delta;maximum=Math.max(maximum,active);}
  return {maximumTimedGroups:maximum,intervals:intervals.map(i=>({...i,overlappingOtherLanes:intervals.filter(j=>j.lane!==i.lane&&j.start<i.end&&j.end>i.start).map(j=>j.label)}))};
}
export function aggregate(root){
  verifyProvenance(root);
  const formal=`${root}/parallel-v2`,replay=[],history=[];
  for(const path of ['raw/web','raw/ios','history/raw/web','history/raw/ios'])mkdirSync(`${formal}/${path}`,{recursive:true});
  for(let lane=1;lane<=4;lane++){
    const directory=`${formal}/lane${lane}`;
    if(readFileSync(`${directory}/campaign.status`,'utf8').trim()!=='0')throw Error(`lane ${lane} not complete`);
    for(const platform of ['web','ios']){
      for(const file of readdirSync(`${directory}/raw/${platform}`).filter(f=>f.endsWith('.json'))){
        const row=JSON.parse(readFileSync(`${directory}/raw/${platform}/${file}`));
        if(row.lane!==lane||row.executionRegime!=='concurrent-max4')throw Error('uniform parallel protocol required');
        if(lane!==1+(fixtures.findIndex(([name])=>name===row.fixture)+row.rep-1)%4)throw Error('replay lane balance mismatch');
        replay.push(row);copyFileSync(`${directory}/raw/${platform}/${file}`,`${formal}/raw/${platform}/${file}`);
      }
      for(const file of readdirSync(`${directory}/history/raw/${platform}`).filter(f=>/^(incident|multi-turn)-(candidate|baseline|native)-.*\.json$/.test(f))){
        const row={...JSON.parse(readFileSync(`${directory}/history/raw/${platform}/${file}`)),platform};
        if(row.lane!==lane||row.executionRegime!=='concurrent-max4'||lane!==1+(Number(String(row.rep).split('-')[0])-1)%4)throw Error('history lane balance mismatch');
        history.push(row);writeFileSync(`${formal}/history/raw/${platform}/${file}`,JSON.stringify(row,null,2));
      }
    }
  }
  const result=summarize(replay),hresult=historySummary(history);
  for(const group of hresult.aa){
    group.pairs=group.pairs.map(pair=>{
      const a=history.find(r=>r.platform===group.platform&&r.scenario===group.scenario&&r.mode==='candidate'&&r.rep===`${pair.rep}-1`)?.phases[group.phase]?.host?.allRows?.sum;
      const b=history.find(r=>r.platform===group.platform&&r.scenario===group.scenario&&r.mode==='candidate'&&r.rep===`${pair.rep}-2`)?.phases[group.phase]?.host?.allRows?.sum;
      return {...pair,percent:a>0&&b>0?100*(b/a-1):null};
    });
    group.over10=group.diagnosticOnly?null:group.pairs.filter(p=>p.percent!==null&&Math.abs(p.percent)>10).length;
    group.maxAbsolutePercent=group.diagnosticOnly?null:Math.max(0,...group.pairs.filter(p=>p.percent!==null).map(p=>Math.abs(p.percent)));
  }
  const overlap=concurrency([...replay,...history.map(row=>({...row,endedAt:row.endedAt??row.finishedAt}))]);
  const timedOverlap=concurrency([...replay,...history.flatMap(row=>['open','older','sessionRemount'].flatMap(phase=>row.phases[phase]?.startedAt&&row.phases[phase]?.endedAt?[{...row.phases[phase],lane:row.lane,label:`${row.platform}/${row.label}/${phase}`}]:[]))]);
  result.missingHistoryTimedPhases=history.flatMap(row=>['open','older','sessionRemount'].filter(phase=>!row.phases[phase]?.startedAt||!row.phases[phase]?.endedAt).map(phase=>({platform:row.platform,label:row.label,phase,error:row.error??null})));
  result.timedConcurrency=timedOverlap;
  if(overlap.maximumTimedGroups>4)result.failures.push('more than four timed groups');
  result.concurrency={...overlap,note:'Complete history sample windows include inter-phase preparation and failure waits; failed windows end at their recorded finishedAt. timedConcurrency uses only captured phase intervals; missingHistoryTimedPhases are never synthesized.'};result.executionRegime='concurrent-max4';
  result.lanes=[1,2,3,4].map(lane=>({lane,replay:replay.filter(r=>r.lane===lane).length,history:history.filter(r=>r.lane===lane).length}));
  result.groups=result.groups.map(group=>({...group,lanes:[1,2,3,4].map(lane=>{
    const rows=replay.filter(r=>r.lane===lane&&r.platform===group.platform&&r.fixture===group.fixture&&r.mode===group.mode);
    return {lane,n:rows.length,rowsMedian:rows.length?median(rows.map(r=>r.probe?.allRows?.sum)):null};
  })}));
  writeFileSync(`${formal}/raw/summary.json`,JSON.stringify(result,null,2));
  writeFileSync(`${formal}/history/raw/summary.json`,JSON.stringify(hresult,null,2));
  writeFileSync(`${formal}/history/raw/metro-errors.json`,JSON.stringify({lines:hresult.displayErrors},null,2));
  copyFileSync(`${root}/raw/source-audit.json`,`${formal}/raw/source-audit.json`);
  const lines=['# Same-round replay results','', 'Execution: concurrent-max4. All primary/control groups use five runs. Current-main A/A repeats remain separate; these are observed medians under varying actual overlap, not uniform fixed-concurrency throughput. Row work is milliseconds; Web Task time is seconds; heap is post-GC MB.','','| Platform | Scenario | Mode | n | Row work median (min–max) | Web Task median (min–max) | Heap median (min–max) | Diagnostic |','| --- | --- | --- | ---: | ---: | ---: | ---: | --- |'];
  for(const group of result.groups){const cell=key=>{const m=group.metrics[key];return m?.median===null||!m?'N/A':`${m.median.toFixed(2)} (${m.min.toFixed(2)}–${m.max.toFixed(2)})`;};lines.push(`| ${group.platform} | ${group.fixture} | ${group.mode} | ${group.n} | ${cell('rows')} | ${cell('task')} | ${cell('heap')} | ${group.diagnosticOnly?'yes':'no'} |`);}
  lines.push('','## A/A pairs','', 'Diagnostic pairs retain their recorded values for investigation and do not establish numeric acceptance.','', '| Platform | Scenario | Pairs | Diagnostic pairs | Over 10% | Maximum absolute difference |','| --- | --- | ---: | ---: | ---: | ---: |');
  for(const pair of result.aa)lines.push(`| ${pair.platform} | ${pair.fixture} | ${pair.pairs.length} | ${pair.pairs.filter(p=>p.diagnosticOnly).length} | ${pair.over10} | ${pair.maxAbsolutePercent.toFixed(2)}% |`);
  lines.push('',`Collected ${result.collected}/550 replay + ${hresult.collected}/80 history attempts. Replay structural failures: ${result.failures.length}; history structural failures: ${hresult.structuralFailures.length}; history quality-gate failures: ${hresult.failures.length}; maximum actual timed groups: ${overlap.maximumTimedGroups}.`,'',...result.failures.map(s=>'- '+s),...hresult.failures.map(s=>'- '+s),'');
  writeFileSync(`${formal}/RESULTS.md`,lines.join('\n'));
  const hlines=['# Long-history results','', 'All row-work values are median (min–max), in milliseconds. Serial diagnostic samples are excluded. Five repetitions rotate across four isolated lanes; current A/A pairs and their controls share each repetition’s lane. Whole-session return is not independent-block remount.','','| Platform | Scenario | Mode | Phase | n | Row work | JS-ready proxy | Timer gap |','| --- | --- | --- | --- | ---: | ---: | ---: | ---: |'];
  for(const group of hresult.groups){const cell=key=>{const m=group.metrics[key];return m?`${m.median.toFixed(1)} (${m.min.toFixed(1)}–${m.max.toFixed(1)})`:'N/A';};hlines.push(`| ${group.platform} | ${group.scenario} | ${group.mode} | ${group.phase} | ${group.n} | ${cell('rows')} | ${cell('ready')} | ${cell('timer')} |`);}
  hlines.push('','## Same-version A/A spread','', '| Platform | Scenario | Phase | Pairs | Over 10% | Max absolute row difference ms | Max absolute percent |','| --- | --- | --- | ---: | ---: | ---: | ---: |');
  for(const group of hresult.aa)hlines.push(`| ${group.platform} | ${group.scenario} | ${group.phase} | ${group.pairs.length} | ${group.diagnosticOnly?'N/A':group.over10} | ${group.diagnosticOnly?'N/A':group.maxAbsoluteRowDifference.toFixed(1)} | ${group.diagnosticOnly?'N/A':`${group.maxAbsolutePercent.toFixed(2)}%`} |`);
  hlines.push('','[Full A/A pairs, phase metrics and resource checks](raw/summary.json)','',`Collected ${hresult.collected}/80; structural audit failures ${hresult.structuralFailures.length}; quality-gate failures ${hresult.failures.length}. Failed platform/scenario/mode groups are N/A in every phase; no successful subset is pooled. Missing timed phases are recorded separately, never synthesized.`, '',...hresult.failures.map(line=>'- '+line),'');writeFileSync(`${formal}/history/RESULTS.md`,hlines.join('\n'));
  if(result.failures.length||hresult.structuralFailures.length)throw Error('campaign structural audit failed; evidence retained');
  return {replay:result.collected,history:hresult.collected,maxTimedGroups:overlap.maximumTimedGroups};
}
if(process.argv[1]&&realpathSync(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(aggregate(process.argv[2])));
