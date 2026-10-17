// Run only on the isolated Mac Studio benchmark environment.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { iosEvaluate } from './ios-evaluate.mjs';
import {resources,admitted,gate,activity} from './resources.mjs';
import {observeSockets} from './socket-isolation.mjs';
import {displayOnlyFailure} from './report.mjs';
const env = process.env, root = env.BC_ROOT, home = env.BC_BENCH_HOME;
const platform = process.argv[2], smoke = process.argv.includes('--smoke');
if (!/^\/tmp\/bc-readme-20261017\/parallel-v2\/lane[1-4]$/.test(root??'') || home!==`/Users/rrd/.paseo-bench-readme-20261017-v2-lane${env.BC_LANE}` || !['web','ios'].includes(platform)) throw Error('explicit private Studio environment required');
const out = `${root}/${smoke ? `smoke-${env.BC_SMOKE_LABEL??'1'}` : 'raw'}/${platform}`;
mkdirSync(out, {recursive:true});
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
const sh = (file,args) => execFileSync(file,args,{encoding:'utf8',timeout:960000,maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe']}).trim();
const paseo = (...args)=>sh(env.BC_PASEO_BIN,['--home',home,...args]);
const server=readFileSync(`${home}/server-id`,'utf8').trim();
const hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const load=()=>Number(sh('/usr/sbin/sysctl',['-n','vm.loadavg']).replace(/[{}]/g,'').trim().split(/\s+/)[0]);
if(platform==='ios'){
  const app=sh('xcrun',['simctl','get_app_container',env.BC_SIM_UDID,'sh.paseo.debug','app']);
  const version=sh('/usr/libexec/PlistBuddy',['-c','Print :CFBundleShortVersionString',`${app}/Info.plist`]);
  const build=sh('/usr/libexec/PlistBuddy',['-c','Print :CFBundleVersion',`${app}/Info.plist`]);
  if(version!=='0.11.2'||build!=='11002999')throw Error(`unexpected native build ${version}/${build}`);
  writeFileSync(`${root}/raw/native-environment${smoke?'-smoke':''}.json`,JSON.stringify({capturedAt:new Date().toISOString(),udid:env.BC_SIM_UDID,version,build,app},null,2));
}
const fixtures=['codeblock-streaming','diff-large','history-100','markdown-long','mixed-turn','reads-20','reasoning-long-prose','reasoning-long-sections','shell-log-large','table-streaming','tool-expanded-streaming'];
let context,page,cdp,socketViolations=[];
if(platform==='web') {
  const {chromium}=createRequire('/tmp/bc-v5/tools/package.json')('playwright-core');
  context=await chromium.launchPersistentContext(`${root}/web-profile`,{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,locale:'zh-CN',viewport:{width:1280,height:900}});
  page=context.pages()[0]??await context.newPage();
  socketViolations=observeSockets(page,env.BC_BENCH_PORT);
  cdp=await context.newCDPSession(page);
  await cdp.send('Performance.enable',{timeDomain:'threadTicks'});
}
const evaluate=expression=>page?page.evaluate(expression):iosEvaluate(expression,env.METRO_PORT);
const json=async expression=>JSON.parse(await evaluate(`JSON.stringify(${expression})`));
const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(row=>[row.name,row.value]));
async function setMode(mode) {
  const rows=JSON.parse(paseo('plugin','ls','--json'));
  const current=rows.find(row=>row.id==='better-paseo'||row.name==='better-paseo');
  const upstream=rows.find(row=>row.id==='beautiful-chat'||row.name==='beautiful-chat');
  if(!current||!upstream)throw Error(`missing private plugin entries: ${rows.map(row=>row.id??row.name)}`);
  for(const row of [current,upstream]) {
    const id=row===current?'better-paseo':'beautiful-chat', enabled=(row===current?['fork','aa','parent'].includes(mode):mode==='upstream');
    if(row.enabled!==enabled)paseo('plugin',enabled?'enable':'disable',id);
  }
  if(['fork','aa','parent'].includes(mode)) {
    sh('/bin/ln',['-sfn',`${root}/${mode==='parent'?'parent':'candidate'}`,env.BC_ACTIVE_LINK]);
    paseo('plugin','reload','better-paseo');
  }
  const installed=JSON.parse(paseo('plugin','ls','--json'));
  const enabled=installed.filter(row=>row.enabled&&['better-paseo','beautiful-chat'].includes(row.id??row.name));
  if(mode==='native'?enabled.length!==0:enabled.length!==1||enabled[0].status!=='running')throw Error('plugin state mismatch');
  if(['fork','aa','parent'].includes(mode)&&realpathSync(enabled[0].path)!==realpathSync(`${root}/${mode==='parent'?'parent':'candidate'}`))throw Error('wrong candidate path');
  // The original Beautiful Chat entry is already registered against the verified 42b61d8 snapshot.
  return installed.filter(row=>['better-paseo','beautiful-chat'].includes(row.id??row.name));
}
async function open(id) {
  if(page) {
    const url=`http://127.0.0.1:${env.BC_WEB_PORT}/h/${server}/agent/${id}`;
    await page.goto(url);await sleep(3000);
    const direct=page.getByText('直接连接').first();
    if(await direct.isVisible().catch(()=>false)) {
      await direct.click();const inputs=page.locator('input');
      await inputs.nth(0).fill('127.0.0.1');await inputs.nth(1).fill(env.BC_BENCH_PORT);
      await page.getByText('连接',{exact:true}).last().click();await sleep(4000);
    }
    if(!page.url().includes(`/agent/${id}`)){await page.goto(url);await sleep(3000);}
  } else {
    try{sh('xcrun',['simctl','terminate',env.BC_SIM_UDID,'sh.paseo.debug']);}catch{}
    sh('xcrun',['simctl','launch',env.BC_SIM_UDID,'sh.paseo.debug','--initialUrl',`http://localhost:${env.METRO_PORT}`]);
    await sleep(8000);
    let ready=false;
    for(let n=0;n<60;n++){
      try{ready=await iosEvaluate("!!globalThis.__hostPerf && !!globalThis.__paseoHostRuntimeStore",env.METRO_PORT);}catch{}
      if(ready)break;await sleep(1000);
    }
    if(!ready)throw Error('native instrumented runtime did not initialize');
    sh(process.execPath,[`${root}/tools/ios-navigate.mjs`,env.METRO_PORT,server,id,'navigate']);
    await sleep(4000);
  }
}
async function run(fixture,mode,rep) {
  const label=`${platform}-${mode}-${fixture}-r${rep}`,file=`${out}/${label}.json`;
  if(existsSync(file)){
    const previous=JSON.parse(readFileSync(file,'utf8'));
    const expected=mode==='native'?null:mode==='parent'?'2fc6476acbdf75e8802668b0260cfd128513c990':mode==='upstream'?'42b61d8301b5400a67821bbbfcf99fa8b681dc37':'b9dfae6e31453b962d90f7d3c7ca972c0e523cb3';
    if(previous.platform!==platform||previous.fixture!==fixture||previous.mode!==mode||previous.rep!==rep||previous.lane!==Number(env.BC_LANE)||previous.sourceSha!==expected||previous.fixtureHash!==hash(`${root}/candidate/test/fixtures/streams/${fixture}.jsonl`)||(!previous.completed&&!displayOnlyFailure(previous))||(previous.error&&!displayOnlyFailure(previous)))throw Error(`existing sample cannot resume: ${file}`);
    console.log(`${label} retained original ${previous.comparisonEligible===false?'diagnostic':'completed'} sample without rerun`);return;
  }
  await gate({platform,stage:'setup',fixture,mode,rep});
  const identity=await setMode(mode);
  const id=paseo('run','-d','-q','--provider','bc-bench','--workspace',env.BC_WORKSPACE,'--title',label,'list').split('\n').pop();
  const errors=[],onError=e=>errors.push(String(e));page?.on('pageerror',onError);
  const displayErrors=[],onConsole=message=>{if(message.type()==='error')displayErrors.push(message.text());};page?.on('console',onConsole);
  const metroStart=page?0:readFileSync(`${root}/logs/metro.log`,'utf8').length;
  const result={platform,executionRegime:"concurrent-max4",lane:Number(env.BC_LANE),setupStartedAt:new Date().toISOString(),fixture,mode,rep,agentId:id,identity,sourceSha:mode==='parent'?'2fc6476acbdf75e8802668b0260cfd128513c990':['fork','aa'].includes(mode)?'b9dfae6e31453b962d90f7d3c7ca972c0e523cb3':mode==='upstream'?'42b61d8301b5400a67821bbbfcf99fa8b681dc37':null,fixtureHash:hash(`${root}/candidate/test/fixtures/streams/${fixture}.jsonl`),errors};
  try {
    paseo('wait',id,'--timeout','60');await open(id);
    result.seen=await json(`({host:typeof globalThis.__hostPerf?.reset==='function',fork:!!globalThis.__bcPerf?.snapshot?.().imageRpc,upstream:typeof document!=='undefined'&&!!document.getElementById('beautiful-chat-frosted')})`);
    if(!result.seen.host||result.seen.fork!==(['fork','aa','parent'].includes(mode))||(page&&result.seen.upstream!==(mode==='upstream')))throw Error(`client identity mismatch ${JSON.stringify(result.seen)}`);
    await evaluate('globalThis.__bcPerf?.enable();true');await sleep(1000);
    await evaluate('globalThis.__bcPerf?.reset();globalThis.__hostPerf.reset();true');
    if(!page)await sleep(1000);
    result.resourcesStart=await gate({platform,stage:'pre-timing',fixture,mode,rep});
    result.loadStart=load();
    const before=cdp?await metrics():null,start=Date.now();result.startedAt=new Date(start).toISOString();activity({platform,stage:"timing",fixture,mode,rep});
    paseo('send',id,`fixture:${fixture} speed:${fixture==='history-100'?'max':fixture==='tool-expanded-streaming'?'4':'1'}`);
    paseo('wait',id,'--timeout','900');await sleep(4000);
    const after=cdp?await metrics():null;
    result.probe=await json('globalThis.__hostPerf.snapshot()');
    result.endedAt=new Date().toISOString();result.elapsedMs=Date.now()-start;result.loadEnd=load();result.resourcesEnd=resources();
    result.displayErrors=page?displayErrors:readFileSync(`${root}/logs/metro.log`,'utf8').slice(metroStart).split('\n').filter(line=>/\bERROR\b|Encountered two children|Rendered (more|fewer) hooks|Maximum update depth/.test(line));
    result.comparisonEligible=result.displayErrors.length===0;
    if(mode==='native'?result.probe.rows.plugin>0||result.probe.rows.native<=0:result.probe.rows.plugin<=0)throw Error('row renderer boundary mismatch');
    if(cdp){
      await cdp.send('HeapProfiler.collectGarbage');await sleep(300);const settled=await metrics();
      result.cdp={delta:Object.fromEntries(['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration'].map(key=>[key,after[key]-before[key]])),jsHeapUsedMB:settled.JSHeapUsedSize/1048576,nodes:settled.Nodes};
    }
    if(rep===1){if(page)await page.screenshot({path:`${out}/${label}.png`});else sh('xcrun',['simctl','io',env.BC_SIM_UDID,'screenshot',`${out}/${label}.png`]);}
    result.socketViolations=[...socketViolations];if(socketViolations.length)throw Error('unexpected WebSocket endpoint');result.completed=errors.length===0;
    console.log(`${label} rows=${result.probe.allRows.sum.toFixed(1)} task=${result.cdp?.delta.TaskDuration.toFixed(3)??'-'} errors=${errors.length} load=${result.loadStart}/${result.loadEnd}`);
    if(!result.completed)throw Error('page errors');
  }catch(error){result.error=String(error.stack??error);throw error;}
  finally{result.finishedAt=new Date().toISOString();activity({platform,stage:'idle',fixture,mode,rep});writeFileSync(file,JSON.stringify(result,null,2));page?.off('pageerror',onError);page?.off('console',onConsole);paseo('archive',id);}
}
try {
  console.log('environment',platform,context?.browser()?.version(),new Date().toISOString());
  for(let rep=1;rep<=(smoke?1:5);rep++)for(const [index,fixture]of(smoke?['mixed-turn']:fixtures).entries()) {
    if(!smoke&&1+(index+rep-1)%4!==Number(env.BC_LANE))continue;
    const modes=['native','upstream','fork','aa','parent'];
    for(let n=0;n<5;n++)await run(fixture,modes[(rep+index+n)%5],rep);
  }
}finally{await context?.close();}
