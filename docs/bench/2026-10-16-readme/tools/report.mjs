import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
export const fixtures=[
  ['codeblock-streaming','Code block streaming','代码块流式'],['diff-large','Large diff','大 diff'],
  ['history-100','History replay','历史回放'],['markdown-long','Long reply','长回复'],['mixed-turn','Mixed turn','混合一轮'],
  ['reads-20','20 file reads','读 20 个文件'],['reasoning-long-prose','Reasoning, prose','思考散文'],
  ['reasoning-long-sections','Reasoning, sections','思考分节'],['shell-log-large','Large shell log','大段终端'],
  ['table-streaming','Table streaming','表格流式'],['tool-expanded-streaming','Growing tool log (defaults)','工具日志增长（默认状态）']];
export function median(values){const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);if(!values.length)throw Error('empty group');return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;}
export function classify(base,current,floor=0){if(base===current)return 'even';const difference=(base-current)/base;return Math.abs(difference)<0.1||Math.max(base,current)<floor?'even':difference>0?'better':'worse';}
export function summarize(records){
  const groups=[],failures=[];
  for(const platform of ['web','ios'])for(const [fixture]of fixtures)for(const mode of ['native','upstream','fork']){
    const runs=records.filter(row=>row.platform===platform&&row.fixture===fixture&&row.mode===mode);
    if(runs.length!==5)failures.push(`${platform}/${fixture}/${mode}: expected 5, found ${runs.length}`);
    if(new Set(runs.map(row=>row.rep)).size!==5||runs.some(row=>![1,2,3,4,5].includes(row.rep)))failures.push(`${platform}/${fixture}/${mode}: repetition identity mismatch`);
    const expectedSource=mode==='fork'?'48a6646bebc42b34baf7db6268c759079faefb5d':mode==='upstream'?'42b61d8301b5400a67821bbbfcf99fa8b681dc37':null;
    for(const run of runs){
      const label=`${platform}/${fixture}/${mode}/r${run.rep}`;
      if(!run.completed||run.error||run.errors?.length)failures.push(`${label}: incomplete/error`);
      if(!(run.loadStart<=4))failures.push(`${label}: load gate failed`);
      if(run.sourceSha!==expectedSource||!run.seen?.host||run.seen.fork!==(mode==='fork')||!/^[a-f0-9]{64}$/.test(run.fixtureHash??''))failures.push(`${label}: source/fixture/renderer identity mismatch`);
      if(!Number.isFinite(run.probe?.allRows?.sum)||run.probe.allRows.sum<=0||!(run.probe.perCommit?.n>0))failures.push(`${label}: invalid measured work`);
      if(mode==='native'?run.probe?.rows?.plugin>0||!(run.probe?.rows?.native>0):!(run.probe?.rows?.plugin>0))failures.push(`${label}: row source mismatch`);
    }
    if(!runs.length)continue;
    const diagnosticOnly=runs.some(run=>run.displayErrors?.length||run.comparisonEligible===false);
    const values={rows:runs.map(row=>row.probe.allRows.sum),commits:runs.map(row=>row.probe.perCommit.n)};
    if(platform==='web')Object.assign(values,{task:runs.map(row=>row.cdp.delta.TaskDuration),heap:runs.map(row=>row.cdp.jsHeapUsedMB),nodes:runs.map(row=>row.cdp.nodes),cls:runs.map(row=>row.probe.layoutShift)});
    groups.push({platform,fixture,mode,n:runs.length,diagnosticOnly,displayErrors:runs.flatMap(row=>row.displayErrors??[]),
      loadEndOverGate:runs.filter(row=>row.loadEnd>4).map(row=>row.rep),metrics:Object.fromEntries(Object.entries(values).map(([key,list])=>[key,{median:median(list),min:Math.min(...list),max:Math.max(...list)}]))});
  }
  for(const [fixture]of fixtures){const hashes=new Set(records.filter(row=>row.fixture===fixture).map(row=>row.fixtureHash));if(hashes.size>1)failures.push(`${fixture}: inconsistent fixture hashes`);}
  return {expected:330,collected:records.length,failures,groups};
}
if(process.argv[1]?.endsWith('/report.mjs')){
  const root=process.argv[2];if(!root)throw Error('raw root required');
  const records=['web','ios'].flatMap(platform=>readdirSync(`${root}/${platform}`).filter(file=>/\.json(?:\.gz)?$/.test(file)).map(file=>{const bytes=readFileSync(`${root}/${platform}/${file}`);return JSON.parse(file.endsWith('.gz')?gunzipSync(bytes):bytes);}));
  const summary=summarize(records);writeFileSync(`${root}/summary.json`,JSON.stringify(summary,null,2));
  console.log(`Collected ${summary.collected}/330; failures ${summary.failures.length}; diagnostic groups ${summary.groups.filter(row=>row.diagnosticOnly).length}`);
  for(const platform of ['web','ios'])for(const [fixture]of fixtures){const group=summary.groups.filter(row=>row.platform===platform&&row.fixture===fixture);console.log(platform,fixture,...group.map(row=>`${row.mode}=${row.metrics.rows.median.toFixed(1)}${row.diagnosticOnly?'(diagnostic)':''}`));}
  if(summary.failures.length){console.error(summary.failures.join('\n'));process.exitCode=1;}
}
