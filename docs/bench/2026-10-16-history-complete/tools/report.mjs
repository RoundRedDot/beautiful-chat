import {readFileSync,readdirSync,writeFileSync,existsSync,realpathSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';import{fileURLToPath}from'node:url';
import { admitted } from './parallel-resources.mjs';
export const fixtureHash='401cba25910431543cb9be5a68110674825e0204701ace37678d809f8c9725e7';
export const sourceShas={candidate:'c4c9f3f57c43a72b2b8fccc91030eb19df6e500d',baseline:'42b61d8301b5400a67821bbbfcf99fa8b681dc37',native:null};
const median=a=>{const s=[...a].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;};
const stats=a=>a.length&&!a.some(x=>x===null||x===undefined)?{median:median(a),min:Math.min(...a),max:Math.max(...a)}:null;
export function summarize(rows,displayErrors=[]){
  const failures=[],groups=[],aa=[];
  if(rows.length!==80)failures.push(`expected 80 total samples, found ${rows.length}`);
  if(displayErrors.length)failures.push(`native display errors: ${displayErrors.length}`);
  for(const platform of ['web','ios'])for(const scenario of ['incident','multi-turn'])for(const mode of ['candidate','baseline','native']){
    const selected=rows.filter(r=>r.platform===platform&&r.scenario===scenario&&r.mode===mode),expected=mode==='candidate'?10:5;
    const validReps=Array.from({length:5},(_,i)=>mode==='candidate'?[`${i+1}-1`,`${i+1}-2`]:[String(i+1)]).flat();
    if(selected.length!==expected||new Set(selected.map(r=>String(r.rep))).size!==expected||selected.some(r=>!validReps.includes(String(r.rep))))failures.push(`${platform}/${scenario}/${mode}: wrong run identities/count`);
    for(const r of selected){
      if(!r.completed||r.error||r.errors?.length||r.displayErrors?.length)failures.push(`${r.label}: collection/display failure`);
      if(r.sourceSha!==sourceShas[mode]||r.seed.fixtureSha256!==fixtureHash)failures.push(`${r.label}: source/fixture mismatch`);
      const loadValid=r.executionRegime==='concurrent-max4'?admitted(r.resourcesStart??{})&&r.loadStart===r.resourcesStart.load?.[0]:r.loadStart<=4;
      if(!loadValid||r.seed.entries!==(scenario==='incident'?810:832)||r.seed.footers!==(scenario==='incident'?1:12)||r.seed.longReplyChars!==59427)failures.push(`${r.label}: load/canonical shape`);
      const kinds={user_message:scenario==='incident'?12:23,assistant_message:scenario==='incident'?140:151,reasoning:260,tool_call:398};
      if(Object.entries(kinds).some(([k,n])=>r.seed.kinds?.[k]!==n)||r.seed.pages?.[0]?.returned!==808||r.seed.pages?.at(-1)?.returned!==(scenario==='incident'?2:24)||r.seed.pages?.at(-1)?.hasOlder!==false)failures.push(`${r.label}: seed kinds/pagination mismatch`);
      if(r.agentLifecycle?.archived!==false||r.agentLifecycle.archivedAt!==null)failures.push(`${r.label}: agent archival state changed`);
      if(!r.sessionPreparation?.unmounted||!r.phases.sessionRemount?.remounted)failures.push(`${r.label}: whole-session unmount/return not proven`);
      if(!r.phases.older?.revealedOlder)failures.push(`${r.label}: older reveal missing`);
      if(mode==='candidate'&&(!r.copyGate?.exactMatch||!r.returnCopyGate?.exactMatch))failures.push(`${r.label}: exact-copy gate`);
      for(const phase of ['open','older','sessionRemount']){
        const p=r.phases[phase];if(!p||!Number.isFinite(p.host?.allRows?.sum)||p.host.allRows.sum<=0||!p.viewport?.history?.length){failures.push(`${r.label}: ${phase} missing/empty`);continue;}
        const ids=p.viewport.history.map(x=>x.id);if(new Set(ids).size!==ids.length)failures.push(`${r.label}: ${phase} duplicate row IDs`);
        if(!Number.isFinite(p.maxTimerGapMs)||!Number.isFinite(p.maxRafGapMs))failures.push(`${r.label}: ${phase} invalid gap probe`);
        if((phase==='open'||phase==='sessionRemount')&&!(p.readyMs>0))failures.push(`${r.label}: ${phase} ready proxy missing`);
      }
    }
    for(const phase of ['open','older','sessionRemount']){
      const phases=selected.map(r=>r.phases[phase]).filter(Boolean),metrics={rows:p=>p.host?.allRows?.sum,ready:p=>p.readyMs??null,timer:p=>p.maxTimerGapMs,raf:p=>p.maxRafGapMs};
      groups.push({platform,scenario,mode,phase,n:phases.length,executionRegimes:{legacySerialGate:selected.filter(r=>r.executionRegime!=='concurrent-max4').length,concurrentResourceGate:selected.filter(r=>r.executionRegime==='concurrent-max4').length},loadEndOverGate:selected.filter(r=>r.executionRegime==='concurrent-max4'?!admitted(r.resourcesEnd??{}):r.loadEnd>4).map(r=>r.label),metrics:Object.fromEntries(Object.entries(metrics).map(([k,get])=>[k,stats(phases.map(get))]))});
    }
    if(mode==='candidate')for(const phase of ['open','older','sessionRemount']){
      const pairs=[];for(let rep=1;rep<=5;rep++){
        const a=selected.find(r=>r.rep===`${rep}-1`)?.phases[phase],b=selected.find(r=>r.rep===`${rep}-2`)?.phases[phase];
        if(a&&b)pairs.push({rep,rowDifference:b.host.allRows.sum-a.host.allRows.sum,timerDifference:b.maxTimerGapMs-a.maxTimerGapMs});
      }
      aa.push({platform,scenario,phase,pairs,maxAbsoluteRowDifference:pairs.length?Math.max(...pairs.map(r=>Math.abs(r.rowDifference))):null});
    }
  }
  return {expected:80,collected:rows.length,failures,groups,aa,displayErrors,executionRegimes:{legacyLoadGate:rows.filter(r=>r.executionRegime!=='concurrent-max4').length,concurrentResourceGate:rows.filter(r=>r.executionRegime==='concurrent-max4').length}};
}
if(process.argv[1]&&realpathSync(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=process.argv[2];if(!root)throw Error('benchmark root required');
  const read=p=>{const b=readFileSync(p);return JSON.parse(p.endsWith('.gz')?gunzipSync(b):b);};
  const rows=['web','ios'].flatMap(platform=>readdirSync(`${root}/raw/${platform}`).filter(x=>/^(incident|multi-turn)-(candidate|baseline|native)-.*\.json(?:\.gz)?$/.test(x)).map(file=>({...read(`${root}/raw/${platform}/${file}`),platform})));
  const errors=read(`${root}/raw/metro-errors.json`).lines,summary=summarize(rows,errors);
  if(existsSync(`${root}/raw/concurrency-preparation.json`))summary.concurrencyPreparation=read(`${root}/raw/concurrency-preparation.json`);
  writeFileSync(`${root}/raw/summary.json`,JSON.stringify(summary,null,2));
  const lines=['# Complete long-history results','','All values are median (minimum–maximum), in milliseconds. Whole-session return is not independent-block remount. No invalid group is silently filled or excluded.','','| Platform | Scenario | Mode | Phase | n | Row work | JS-ready proxy | Timer gap |','| --- | --- | --- | --- | ---: | ---: | ---: | ---: |'];
  if(summary.executionRegimes.concurrentResourceGate)lines.splice(2,0,`Execution changed by explicit user request: ${summary.executionRegimes.legacyLoadGate} samples used the original load gate and ${summary.executionRegimes.concurrentResourceGate} used concurrent-max4 resource admission. Earlier iOS samples may also overlap lane preparation; see raw/concurrency-preparation.json. Mixed totals are descriptive, not a uniform serial or fixed-concurrency controlled comparison.`, '');
  for(const g of summary.groups){const cell=k=>{const v=g.metrics[k];return v?`${v.median.toFixed(1)} (${v.min.toFixed(1)}–${v.max.toFixed(1)})`:'—';};lines.push(`| ${g.platform} | ${g.scenario} | ${g.mode} | ${g.phase} | ${g.n} | ${cell('rows')} | ${cell('ready')} | ${cell('timer')} |`);}
  lines.push('',`Collected ${summary.collected}/80; failures ${summary.failures.length}.`,'',...summary.failures.map(x=>'- '+x),'');writeFileSync(`${root}/RESULTS.md`,lines.join('\n').trimEnd()+'\n');console.log(JSON.stringify({collected:summary.collected,failures:summary.failures}));if(summary.failures.length)process.exitCode=1;
}
