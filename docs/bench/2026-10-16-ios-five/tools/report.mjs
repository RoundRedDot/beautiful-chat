import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
export const coreFixtures=['diff-large','reads-20','reasoning-long-prose','reasoning-long-sections','tool-expanded-streaming'];
export const modes=['native','c4','fixed-a','fixed-b'];
export const median=values=>{if(!values.length)throw Error('empty group');const s=[...values].sort((a,b)=>a-b),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2;};
export function stats(values){return {n:values.length,median:median(values),min:Math.min(...values),max:Math.max(...values)};}
export function classify(native,current){return Math.abs((current-native)/native)<0.1?'even':current<native?'lower':'higher';}
export function summarize(runs,fixtures=coreFixtures){
 const failures=[],groups=[],comparisons=[];
 for(const fixture of fixtures){
  const selected=runs.filter(r=>r.fixture===fixture);
  if(new Set(selected.map(r=>r.fixtureHash)).size!==1)failures.push(`${fixture}: fixture identity mismatch`);
  for(const mode of modes){
   const group=selected.filter(r=>r.mode===mode);
   if(group.length!==5||new Set(group.map(r=>r.rep)).size!==5||group.some(r=>![1,2,3,4,5].includes(r.rep)))failures.push(`${fixture}/${mode}: expected five unique repetitions`);
   for(const r of group){
    const label=`${fixture}/${mode}/${r.rep}`;
    if(!r.completed||r.error||r.errors?.length||!(r.loadStart<=4))failures.push(`${label}: incomplete/error/load`);
    if(!/^[a-f0-9]{64}$/.test(r.fixtureHash??'')||!r.seen?.host||r.seen.fork!==(mode!=='native'))failures.push(`${label}: source/fixture/renderer identity`);
    if(mode==='c4'&&r.sourceSha!=='c4c9f3f57c43a72b2b8fccc91030eb19df6e500d')failures.push(`${label}: c4 identity`);
    if(mode.startsWith('fixed')&&(!/^[a-f0-9]{64}$/.test(r.sourceIdentity?.patchSha256??'')||r.sourceSha!==null))failures.push(`${label}: worktree identity`);
    if(!(r.probe?.allRows?.sum>0)||!(r.probe?.perCommit?.n>0)||(mode==='native'?!(r.probe.rows.native>0)||r.probe.rows.plugin>0:!(r.probe.rows.plugin>0)))failures.push(`${label}: invalid row work`);
   }
   if(group.length)groups.push({fixture,mode,diagnostic:group.some(r=>r.displayErrors?.length||r.comparisonEligible===false),rows:stats(group.map(r=>r.probe.allRows.sum)),commits:stats(group.map(r=>r.probe.perCommit.n)),loadEndOverGate:group.filter(r=>r.loadEnd>4).map(r=>r.rep)});
  }
  const patchHashes=new Set(selected.filter(r=>r.mode.startsWith('fixed')).map(r=>r.sourceIdentity?.patchSha256));
  if(patchHashes.size!==1)failures.push(`${fixture}: mixed fixed patches`);
  const native=groups.find(g=>g.fixture===fixture&&g.mode==='native');
  const fixed=selected.filter(r=>r.mode.startsWith('fixed'));
  const aa=[];
  for(let rep=1;rep<=5;rep++){
   const a=fixed.find(r=>r.mode==='fixed-a'&&r.rep===rep),b=fixed.find(r=>r.mode==='fixed-b'&&r.rep===rep);
   if(a&&b)aa.push({rep,a:a.probe.allRows.sum,b:b.probe.allRows.sum,absoluteMs:Math.abs(a.probe.allRows.sum-b.probe.allRows.sum),relative:Math.abs(a.probe.allRows.sum-b.probe.allRows.sum)/a.probe.allRows.sum});
  }
  if(native&&fixed.length){const current=stats(fixed.map(r=>r.probe.allRows.sum));const eligible=!groups.filter(g=>g.fixture===fixture).some(g=>g.diagnostic);comparisons.push({fixture,eligible,native:native.rows,fixed:current,delta:current.median/native.rows.median-1,verdict:eligible?classify(native.rows.median,current.median):'diagnostic',aa,maxAaMs:aa.length?Math.max(...aa.map(p=>p.absoluteMs)):null});}
 }
 return {expected:fixtures.length*modes.length*5,collected:runs.length,failures,groups,comparisons};
}
if(process.argv[1]?.endsWith('/report.mjs')){
 const root=process.argv[2];if(!root)throw Error('sample directory required');
 const runs=readdirSync(root).filter(f=>f.endsWith('.json')&&f!=='summary.json').map(f=>JSON.parse(readFileSync(`${root}/${f}`,'utf8')));
 const report=summarize(runs);writeFileSync(`${root}/summary.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));if(report.failures.length)process.exitCode=1;
}
