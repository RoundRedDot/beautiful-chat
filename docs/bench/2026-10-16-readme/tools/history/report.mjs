import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const directory=process.argv[2];
if(!directory)throw Error('raw directory required');
const display=JSON.parse(readFileSync(`${directory}/metro-errors.json`));
const baselineDiagnosticOnly=display.lines.some(line=>line.includes('.$beautiful-chat/'));
const blockingDisplayErrors=display.lines.some(line=>!line.includes('.$beautiful-chat/'));
const rows=readdirSync(directory).filter(name=>/^(incident|multi-turn)-(candidate|before|baseline|native)-.+\.json$/.test(name))
  .map(name=>({...JSON.parse(readFileSync(`${directory}/${name}`)),file:name}));
if(!rows.length)throw Error('No uncompressed samples. Run tools/unpack.mjs into a fresh review directory first.');
const median=values=>{const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);return sorted.length?sorted.length%2?sorted[(sorted.length-1)/2]:(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2:null;};
const metrics={rowMs:phase=>phase.host.allRows.sum,timerGapMs:phase=>phase.maxTimerGapMs,rafGapMs:phase=>phase.maxRafGapMs,
  readyMs:phase=>phase.readyMs,commits:phase=>phase.host.perCommit.n};
const groups=[],aa=[];
for(const scenario of ['incident','multi-turn'])for(const phase of ['open','tailDrag','older','remount']){
  for(const mode of ['candidate','before','baseline','native']){
    const selected=rows.filter(row=>row.scenario===scenario&&row.mode===mode&&row.phases?.[phase]);
    if(!selected.length)continue;
    const stats=Object.fromEntries(Object.entries(metrics).map(([metric,read])=>{
      const values=selected.map(row=>read(row.phases[phase])).filter(value=>typeof value==='number'&&Number.isFinite(value));
      return [metric,{median:median(values),min:values.length?Math.min(...values):null,max:values.length?Math.max(...values):null,n:values.length}];
    }));
    const kinds=[...new Set(selected.flatMap(row=>Object.keys(row.phases[phase].host.kinds)))];
    const byKind=Object.fromEntries(kinds.map(kind=>{
      const values=selected.map(row=>row.phases[phase].host.kinds[kind]).filter(Boolean);
      return[kind,{rowMs:median(values.map(value=>value.sum)),commits:median(values.map(value=>value.n)),mounts:median(values.map(value=>value.mounts))}];
    }));
    groups.push({scenario,phase,mode,samples:selected.length,diagnosticOnly:blockingDisplayErrors||(baselineDiagnosticOnly&&mode==='baseline'),stats,byKind,
      ready: selected.filter(row=>row.phases[phase].viewport?.ready).length,
      olderReveals: selected.filter(row=>row.phases[phase].revealedOlder).length,
      remounts:selected.filter(row=>row.phases[phase].remounted).length});
  }
  const pairs=[];
  for(let rep=1;rep<=5;rep++){
    const first=rows.find(row=>row.label===`${scenario}-candidate-${rep}-1`)?.phases?.[phase];
    const second=rows.find(row=>row.label===`${scenario}-candidate-${rep}-2`)?.phases?.[phase];
    if(!first||!second)continue;
    pairs.push({rep,differences:Object.fromEntries(Object.entries(metrics).filter(([,read])=>typeof read(first)==='number'&&typeof read(second)==='number').map(([key,read])=>[key,read(second)-read(first)]))});
  }
  aa.push({scenario,phase,pairs,maxAbsoluteDifferences:Object.fromEntries(Object.keys(metrics).map(key=>[key,pairs.some(p=>Number.isFinite(p.differences[key]))?Math.max(...pairs.map(p=>Math.abs(p.differences[key]??0))):null]))});
}
const output={samples:rows.length,completed:rows.filter(row=>row.completed).length,errors:rows.filter(row=>row.error).map(row=>({file:row.file,error:row.error})),
  comparisonEligible:blockingDisplayErrors?0:rows.filter(row=>!(baselineDiagnosticOnly&&row.mode==='baseline')).length,displayErrorLines:display.lines.length,baselineDiagnosticOnly,blockingDisplayErrors,
  loadBoundaryMax:Math.max(...rows.flatMap(row=>[row.loadStart,row.loadEnd]).filter(Number.isFinite)),
  candidateCopyGates:rows.filter(row=>row.mode==='candidate').map(row=>({file:row.file,...row.copyGate})),
  groups,aa,
  pages:rows.flatMap(row=>Object.entries(row.phases??{}).flatMap(([phase,value])=>(value.rpc??[]).map(call=>({file:row.file,phase,...call}))))};
writeFileSync(`${directory}/summary.json`,JSON.stringify(output,null,2));
const lines=['scenario phase mode n readyMs rowMs timerGapMs rafGapMs commits'];
for(const group of groups)lines.push([group.scenario,group.phase,group.mode+(group.diagnosticOnly?'(diagnostic)':''),group.samples,...['readyMs','rowMs','timerGapMs','rafGapMs','commits'].map(key=>group.stats[key].median?.toFixed(2)??'-')].join(' '));
lines.push(`samples=${output.samples} complete=${output.completed} collectionErrors=${output.errors.length} comparisonEligible=${output.comparisonEligible} displayErrorLines=${output.displayErrorLines} loadMax=${output.loadBoundaryMax}`);
writeFileSync(`${directory}/report.txt`,lines.join('\n')+'\n');
console.log(lines.join('\n'));
