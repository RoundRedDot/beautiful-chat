import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
const dir=process.argv[2];if(!dir)throw Error('Web history sample directory required');
const samples=readdirSync(dir).filter(file=>/^(incident|multi-turn)-(candidate|native|baseline)-.*\.json(?:\.gz)?$/.test(file)).map(file=>{const bytes=readFileSync(`${dir}/${file}`);return JSON.parse(file.endsWith('.gz')?gunzipSync(bytes):bytes);});
const median=values=>{const s=[...values].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;};
const failures=[],groups=[],aa=[];
const metrics={openReadyMs:row=>row.phases.open.readyMs,openRowsMs:row=>row.phases.open.host.allRows.sum,openTimerGapMs:row=>row.phases.open.maxTimerGapMs,openRafGapMs:row=>row.phases.open.maxRafGapMs,
  olderRowsMs:row=>row.phases.older.host.allRows.sum,olderTimerGapMs:row=>row.phases.older.maxTimerGapMs,remountRowsMs:row=>row.phases.remount?.host.allRows.sum??null};
for(const scenario of ['incident','multi-turn']){
  for(const mode of ['candidate','baseline','native']){
    const rows=samples.filter(row=>row.scenario===scenario&&row.mode===mode),expected=mode==='candidate'?10:5;
    if(rows.length!==expected)failures.push(`${scenario}/${mode}: expected ${expected}, got ${rows.length}`);
    for(const row of rows){
      if(!row.completed||row.error||row.errors?.length)failures.push(`${row.label}: incomplete/error`);
      if(!(row.loadStart<=4)||row.seed.entries!==(scenario==='incident'?810:832)||row.seed.footers!==(scenario==='incident'?1:12)||row.seed.longReplyChars!==59427)failures.push(`${row.label}: load/seed shape failed`);
      if(!row.phases.open.rpc.some(call=>call.agentId===row.seed.agentId&&call.request.direction==='tail'&&call.returned===808))failures.push(`${row.label}: expanded tail missing`);
      const remount=row.remountPreparation;
      const retainedOnly=remount?.notApplicable&&remount.tail&&!remount.tail.history.some(item=>item.blockIndex!==undefined&&remount.tail.virtualizedIds.includes(item.id)&&remount.tail.mountedIds.includes(item.id));
      if(mode==='candidate'&&(!row.copyGate?.exactMatch||row.visibleCopyButtons!==1||row.olderPreparation.progressChanged||!row.phases.older.revealedOlder||(!retainedOnly&&(!remount.unmounted||!row.phases.remount?.remounted))))failures.push(`${row.label}: candidate functional gate failed`);
      if(mode!=='baseline'&&row.displayErrors.length)failures.push(`${row.label}: display errors`);
    }
    groups.push({scenario,mode,n:rows.length,diagnosticOnly:rows.some(row=>row.displayErrors.length),loadEndOverGate:rows.filter(row=>row.loadEnd>4).map(row=>row.label),metrics:Object.fromEntries(Object.entries(metrics).map(([name,get])=>{const values=rows.map(get);return [name,values.some(value=>value===null)?null:{median:median(values),min:Math.min(...values),max:Math.max(...values)}];}))});
  }
  const pairs=[];
  for(let rep=1;rep<=5;rep++){
    const first=samples.find(row=>row.scenario===scenario&&row.mode==='candidate'&&row.rep===`${rep}-1`),second=samples.find(row=>row.scenario===scenario&&row.mode==='candidate'&&row.rep===`${rep}-2`);
    if(!first||!second){failures.push(`${scenario}: A/A pair ${rep} missing`);continue;}
    pairs.push({rep,deltas:Object.fromEntries(Object.entries(metrics).map(([name,get])=>{const a=get(first),b=get(second);return [name,a===null||b===null?null:Math.abs(a-b)];}))});
  }
  aa.push({scenario,pairs,maxAbsoluteDelta:Object.fromEntries(Object.keys(metrics).map(name=>{const values=pairs.map(pair=>pair.deltas[name]);return [name,values.some(value=>value===null)?null:Math.max(...values)];}))});
}
const summary={expected:40,collected:samples.length,failures,groups,aa};
writeFileSync(`${dir}/../web-summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));if(failures.length)process.exitCode=1;
