// Functional continuous-scroll acceptance, separate from the cross-version timing matrix.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {iosEvaluate} from './ios-evaluate.mjs';
const root=process.env.BC_ROOT,home=process.env.BC_BENCH_HOME,cli=process.env.BC_PASEO_BIN;
const udid=process.env.BC_SIM_UDID,port=Number(process.env.METRO_PORT);
if(!root||!home?.includes('bench')||!cli||!udid||!port)throw Error('explicit private environment required');
const output=`${root}/raw/full-scroll.json`;
if(existsSync(output))throw Error('refusing to overwrite full-scroll result');
const sh=(file,args,options={})=>execFileSync(file,args,{encoding:'utf8',timeout:180000,maxBuffer:32*1024*1024,...options}).trim();
const evaluate=expression=>iosEvaluate(expression,port);
const json=async expression=>JSON.parse(await evaluate(`JSON.stringify(${expression})`));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const result={kind:'functional continuous native scroll, not a comparative timing sample',steps:[],phases:{},failures:[]};
let id;
try{
 sh(`${root}/run-env.sh`,['--smoke','candidate'],{env:{...process.env,BC_OPEN_ONLY:'1',BC_KEEP_SEED:'1',BC_RUN_PREFIX:'full-scroll-'}});
 const [seed]=JSON.parse(readFileSync(`${root}/raw/seeds-full-scroll-incident-candidate-1.json`));
 id=seed.agentId;result.seed=seed;
 const initial=await json('globalThis.__historyBench.describe()');
 const longRows=initial.history.filter(row=>row.blockIndex!==undefined);
 const maxIndex=Math.max(...longRows.map(row=>row.blockIndex));
 const lastBlock=longRows.find(row=>row.blockIndex===maxIndex);
 const prefix=lastBlock.id.slice(0,lastBlock.id.lastIndexOf('/')+1);
 const seen=new Set(initial.mounted.filter(row=>row.id.startsWith(prefix)).map(row=>row.blockIndex));
 await evaluate('globalThis.__historyBench.reset();true');
 for(let n=0;n<200;n++){
  const before=await json('globalThis.__historyBench.describe()');
  sh('/opt/homebrew/bin/axe',['drag','--udid',udid,'--start-x','200','--start-y','220','--end-x','200','--end-y','640','--duration','0.3']);
  await sleep(300);
  const after=await json('globalThis.__historyBench.describe()');
  const indexes=after.mounted.filter(row=>row.id.startsWith(prefix)).map(row=>row.blockIndex);
  indexes.forEach(index=>seen.add(index));
  result.steps.push({direction:'older',before:before.metrics,after:after.metrics,mountedBlockIndexes:indexes,progressKey:after.progressKey});
  if(after.progressKey!==initial.progressKey)break;
 }
 result.phases.older=await json('globalThis.__historyBench.snapshot()');
 result.expectedLongReplyBlockIndexes=Array.from({length:maxIndex+1},(_,index)=>index);
 result.seenLongReplyBlockIndexes=[...seen].sort((a,b)=>a-b);
 if(result.expectedLongReplyBlockIndexes.some(index=>!seen.has(index)))result.failures.push('some long-reply blocks never entered the mounted set');
 if(result.phases.older.viewport.progressKey===initial.progressKey)result.failures.push('continuous drag did not reveal older history');
 await evaluate('globalThis.__historyBench.reset();true');
 for(let n=0;n<200;n++){
  const before=await json('globalThis.__historyBench.describe()');
  sh('/opt/homebrew/bin/axe',['drag','--udid',udid,'--start-x','200','--start-y','640','--end-x','200','--end-y','220','--duration','0.3']);
  await sleep(300);
  const after=await json('globalThis.__historyBench.describe()');
  result.steps.push({direction:'newer',before:before.metrics,after:after.metrics,progressKey:after.progressKey});
  if(after.metrics.offsetY<=2)break;
 }
 result.phases.return=await json('globalThis.__historyBench.snapshot()');
 if(result.phases.return.viewport.metrics.offsetY>2)result.failures.push('continuous return did not reach tail');
 for(const [name,phase] of Object.entries(result.phases))if(phase.maxTimerGapMs>=1000)result.failures.push(`${name}: JS stall ${phase.maxTimerGapMs.toFixed(0)}ms`);
 sh('xcrun',['simctl','pbcopy',udid],{input:'BC-FULL-SCROLL-COPY-SENTINEL'});
 sh('/opt/homebrew/bin/axe',['tap','--udid',udid,'--label','Copy reply','--tap-style','physical']);
 await sleep(350);
 const copied=sh('xcrun',['simctl','pbpaste',udid]);
 const expected=readFileSync(`${root}/candidate/test/fixtures/streams/history-long-load.jsonl`,'utf8').trim().split('\n').slice(1).map(line=>JSON.parse(line).item)
  .filter(item=>item.type==='assistant_message').sort((a,b)=>b.text.length-a.text.length)[0].text;
 result.copyGate={sentinelBeforeCopy:true,copiedChars:copied.length,expectedChars:expected.length,exactMatch:copied===expected};
 if(copied!==expected)result.failures.push('copy after continuous scroll did not match full source');
 sh('xcrun',['simctl','io',udid,'screenshot',`${root}/raw/full-scroll-tail.png`]);
 result.completed=true;
}catch(error){result.error=String(error.stack??error);result.failures.push(String(error));}
finally{
 writeFileSync(output,JSON.stringify(result,null,2));
 if(id)sh(cli,['--home',home,'archive',id]);
}
console.log(JSON.stringify({completed:result.completed,steps:result.steps.length,seen:result.seenLongReplyBlockIndexes?.length,failures:result.failures}));
if(result.failures.length)process.exitCode=1;
