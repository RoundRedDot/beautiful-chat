import {readFileSync,readdirSync,writeFileSync,existsSync} from 'node:fs';
export const fixtures=['diff-large','reads-20','reasoning-long-prose','reasoning-long-sections','tool-expanded-streaming'];
export const modes=['native','parent','fixed-a','fixed-b'];
const shas={parent:'7f01b2d95c87cb6879adf701571de3778a167060',fixed:'722238de2fcc1ade46d542a7a540868932d9dc89'};
export function median(a){const s=[...a].sort((a,b)=>a-b);return s.length%2?s[(s.length-1)/2]:(s[s.length/2-1]+s[s.length/2])/2;}
export function stats(a){return{n:a.length,median:median(a),min:Math.min(...a),max:Math.max(...a)};}
export function summarize(rows,list=fixtures,selectedModes=modes){
 const failures=[],groups=[],comparisons=[];
 for(const fixture of list){
  const input=rows.filter(r=>r.fixture===fixture);
  if(new Set(input.map(r=>r.fixtureHash)).size!==1)failures.push(`${fixture}: fixture hash mismatch`);
  for(const mode of selectedModes){
   const samples=input.filter(r=>r.mode===mode);
   if(samples.length!==5||new Set(samples.map(r=>r.rep)).size!==5)failures.push(`${fixture}/${mode}: expected five unique reps`);
   for(const r of samples){
    const label=`${fixture}/${mode}/${r.rep}`;
    if(!r.completed||r.error||r.displayErrors?.length||r.comparisonEligible!==true)failures.push(`${label}: incomplete/display/error`);
    if(r.executionRegime!=='concurrent-max4'||![2,3,4].includes(r.lane)||r.lane!==2+(list.indexOf(fixture)+r.rep-1)%3)failures.push(`${label}: regime/lane allocation`);
    if(r.sourceSha!==(mode==='native'?null:mode==='parent'?shas.parent:shas.fixed))failures.push(`${label}: source identity`);
    if(r.runtime?.serverId!==r.environment?.server||![`127.0.0.1:${6880+r.lane}`,`localhost:${6880+r.lane}`].includes(r.runtime?.endpoint)||r.environment?.port!==8180+r.lane)failures.push(`${label}: endpoint isolation`);
    if(!r.resourceStart?.admitted||!(r.probe?.allRows?.sum>0))failures.push(`${label}: admission/work gate`);
   }
   const valid=samples.filter(r=>r.probe?.allRows?.sum>0);
   if(valid.length)groups.push({fixture,mode,rows:stats(valid.map(r=>r.probe.allRows.sum)),commits:stats(valid.map(r=>r.probe.perCommit.n)),lanes:[2,3,4].flatMap(l=>{const v=valid.filter(r=>r.lane===l);return v.length?[{lane:l,rows:stats(v.map(r=>r.probe.allRows.sum))}]:[];}),endGateExcursions:samples.filter(r=>r.resourceEnd&&!r.resourceEnd.admitted).map(r=>({rep:r.rep,lane:r.lane,resources:r.resourceEnd}))});
  }
  const n=groups.find(g=>g.fixture===fixture&&g.mode==='native'),parent=groups.find(g=>g.fixture===fixture&&g.mode==='parent');
  const fixed=input.filter(r=>r.mode.startsWith('fixed')&&r.probe?.allRows?.sum>0),aa=[];
  for(let rep=1;rep<=5;rep++){const a=fixed.find(r=>r.mode==='fixed-a'&&r.rep===rep),b=fixed.find(r=>r.mode==='fixed-b'&&r.rep===rep);if(a&&b){if(a.lane!==b.lane)failures.push(`${fixture}/${rep}: A/A lane mismatch`);aa.push({rep,lane:a.lane,a:a.probe.allRows.sum,b:b.probe.allRows.sum,absoluteMs:Math.abs(a.probe.allRows.sum-b.probe.allRows.sum),relative:Math.abs(a.probe.allRows.sum-b.probe.allRows.sum)/a.probe.allRows.sum});}}
  if(parent&&fixed.length){const values=stats(fixed.map(r=>r.probe.allRows.sum)),deltaNative=n?(values.median-n.rows.median)/n.rows.median:null;comparisons.push({fixture,parent:parent.rows,native:n?.rows??null,fixed:values,deltaParent:(values.median-parent.rows.median)/parent.rows.median,deltaNative,nativeVerdict:deltaNative===null?'not-compared':Math.abs(deltaNative)<0.1?'even':deltaNative<0?'lower':'higher',aa,unstablePairs:aa.filter(p=>p.relative>0.1),maxAaMs:aa.length?Math.max(...aa.map(p=>p.absoluteMs)):null});}
 }
 return{executionRegime:'concurrent-max4',expected:list.length*selectedModes.length*5,collected:rows.length,failures,groups,comparisons};
}
if(process.argv[1]?.endsWith('/audit.mjs')){
 const campaign=process.argv[2],phase=process.argv[3]??'core';if(!campaign)throw Error('campaign required');
 const rows=[2,3,4].flatMap(l=>{const p=`${campaign}/lane${l}/raw/${phase}`;return existsSync(p)?readdirSync(p).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(readFileSync(`${p}/${f}`))):[];});
 const risk=['mixed-turn','history-100','shell-log-large','table-streaming','codeblock-streaming','markdown-long'];
 const web=['diff-large','reads-20','reasoning-long-prose','reasoning-long-sections','tool-expanded-streaming','mixed-turn'];
 const r=summarize(rows,phase==='risk'?risk:phase==='web-risk'?web:fixtures,phase==='risk'||phase==='web-risk'?['parent','fixed-a']:modes);writeFileSync(`${campaign}/raw/${phase}-summary.json`,JSON.stringify(r,null,2));console.log(JSON.stringify(r.comparisons,null,2));console.log('collected',r.collected,'expected',r.expected,'failures',r.failures);if(r.failures.length)process.exitCode=1;
}
