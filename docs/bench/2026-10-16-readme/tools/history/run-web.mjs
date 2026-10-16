import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {installWebHistoryMeter} from './web-meter.mjs';
const root=process.env.BC_ROOT,home=process.env.BC_BENCH_HOME,cli=process.env.BC_PASEO_BIN;
if(root!=='/tmp/bc-readme-20261016/history'||home!=='/Users/rrd/.paseo-bench-p0p1')throw Error('isolated Studio history environment required');
const sh=(file,args,extra={})=>execFileSync(file,args,{encoding:'utf8',timeout:180000,maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe'],...extra}).trim();
const paseo=(...args)=>sh(cli,['--home',home,...args]);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const server=readFileSync(`${home}/server-id`,'utf8').trim();
const load=()=>Number(sh('/usr/sbin/sysctl',['-n','vm.loadavg']).replace(/[{}]/g,'').trim().split(/\s+/)[0]);
const {chromium}=createRequire('/tmp/bc-v5/tools/package.json')('playwright-core');
const context=await chromium.launchPersistentContext(`${root}/web-profile`,{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,locale:'zh-CN',viewport:{width:1280,height:900},permissions:['clipboard-read','clipboard-write']});
const page=context.pages()[0]??await context.newPage();
await page.routeWebSocket(/:(6767|6868|6869|6872|6873)\//,ws=>ws.close());
await page.addInitScript(installWebHistoryMeter);
const view=()=>page.evaluate(()=>globalThis.__webHistory.describe());
const snapshot=()=>page.evaluate(()=>globalThis.__webHistory.snapshot());
const reset=()=>page.evaluate(()=>globalThis.__webHistory.reset());
const scroll=page.locator('[data-testid="agent-chat-scroll"]:visible');
async function wheel(delta){await scroll.hover();await page.mouse.wheel(0,delta);await sleep(400);}
async function mode(name){
  for(const id of ['better-paseo','beautiful-chat']){
    const [row]=JSON.parse(paseo('plugin','ls',id,'--json')),enabled=name===(id==='better-paseo'?'candidate':'baseline');
    if(row.enabled!==enabled)paseo('plugin',enabled?'enable':'disable',id);
  }
  if(name==='candidate'){sh('/bin/ln',['-sfn',`${root}/candidate`,'/tmp/bc-m0-o1/active']);paseo('plugin','reload','better-paseo');}
  return JSON.parse(paseo('plugin','ls','--json')).filter(row=>['better-paseo','beautiful-chat'].includes(row.id));
}
async function run(scenario,name,rep,prefix=''){
  const label=`${prefix}${scenario}-${name}-${rep}`,out=`${root}/raw/web/${label}.json`;
  if(existsSync(out))throw Error('refusing overwrite');
  sh(process.execPath,[`${root}/tools/seed.mjs`,scenario],{env:{...process.env,BC_SEED_LABEL:`web-${label}`}});
  const [seed]=JSON.parse(readFileSync(`${root}/raw/seeds-web-${label}.json`));
  const errors=[],displayErrors=[],error=e=>errors.push(String(e)),consoleError=e=>{if(e.type()==='error')displayErrors.push(e.text());};
  page.on('pageerror',error);page.on('console',consoleError);
  const result={label,platform:'web',scenario,mode:name,rep,seed,phases:{},errors,displayErrors};
  try{
    result.identity=await mode(name);
    while(load()>4){console.log('load gate',load());await sleep(5000);}
    result.loadStart=load();result.startedAt=new Date().toISOString();
    await page.goto(`http://127.0.0.1:8092/h/${server}/agent/${seed.agentId}`);
    await scroll.waitFor({state:'visible'});await sleep(6000);
    result.phases.open=await snapshot();
    result.seen=await page.evaluate(()=>({fork:!!globalThis.__bcPerf?.snapshot?.().imageRpc,upstream:!!document.getElementById('beautiful-chat-frosted')}));
    if(result.seen.fork!==(name==='candidate')||result.seen.upstream!==(name==='baseline'))throw Error('client plugin marker mismatch');
    if(!result.phases.open.wrapped||!result.phases.open.readyMs||result.phases.open.probeError)throw Error('cold-open probe missing');
    if(result.phases.open.viewport.agentId&&result.phases.open.viewport.agentId!==seed.agentId)throw Error('wrong active history viewport');
    if(!result.phases.open.rpc.some(call=>call.agentId===seed.agentId&&call.request.direction==='tail'&&call.returned===808))throw Error('cold-open expanded tail was not captured');
    const host=result.phases.open.host;
    if(name==='native'?host.rows.plugin>0||host.rows.native<=0:host.rows.plugin<=0)throw Error('renderer mismatch');
    if(String(rep)==='1'||String(rep)==='1-1')await page.screenshot({path:`${root}/raw/web/${label}-open.png`});
    if(name==='candidate'){
      const expected=readFileSync(`${root}/candidate/test/fixtures/streams/history-long-load.jsonl`,'utf8').trim().split('\n').slice(1).map(line=>JSON.parse(line).item).filter(item=>item?.type==='assistant_message').sort((a,b)=>b.text.length-a.text.length)[0].text;
      await page.evaluate(()=>navigator.clipboard.writeText('BC-SYNTHETIC-COPY-SENTINEL'));
      const copy=page.getByRole('button',{name:'Copy reply',exact:true});
      result.visibleCopyButtons=await copy.count();await copy.click();await sleep(350);
      const copied=await page.evaluate(()=>navigator.clipboard.readText());
      result.copyGate={exactMatch:copied===expected,copiedChars:copied.length,expectedChars:expected.length,sentinelBeforeCopy:true};
      if(!result.copyGate.exactMatch||result.visibleCopyButtons!==1)throw Error('copy gate failed');
    }
    await reset();const before=await view();await wheel(-420);await sleep(1000);
    result.phases.tailDrag={before,...await snapshot()};
    if(name==='candidate'&&before.metrics.scrollTop-result.phases.tailDrag.viewport.metrics.scrollTop<20)throw Error('tail wheel did not move timeline');
    // Fixed source boundary preparation is untimed; the final wheel drives history reveal.
    await scroll.evaluate(el=>{el.scrollTop=700;});await sleep(1500);
    const olderBefore=await view();
    result.olderPreparation={after:olderBefore,progressChanged:olderBefore.progressKey!==result.phases.open.viewport.progressKey};
    if(name==='candidate'&&result.olderPreparation.progressChanged)throw Error('history revealed during untimed preparation');
    await reset();const actions=[];
    for(let n=0;n<12;n++){await wheel(-800);actions.push(-800);if((await view()).progressKey!==olderBefore.progressKey)break;}
    await sleep(1000);result.phases.older={before:olderBefore,actions,...await snapshot()};
    result.phases.older.revealedOlder=result.phases.older.viewport.progressKey!==olderBefore.progressKey;
    await scroll.evaluate(el=>{el.scrollTop=el.scrollHeight;});await sleep(1500);
    const tail=await view(),target=tail.history.findLast(row=>row.blockIndex!==undefined&&tail.virtualizedIds.includes(row.id)&&tail.mountedIds.includes(row.id));
    if(target){
      const away=[];
      for(let n=0;n<70;n++){await wheel(-1800);const current=await view();away.push(current.metrics);if(!current.mountedIds.includes(target.id))break;}
      result.remountPreparation={target,unmounted:!(await view()).mountedIds.includes(target.id),actions:away};
      await reset();const actions=[];
      for(let n=0;n<70;n++){await wheel(1800);actions.push(1800);if((await view()).mountedIds.includes(target.id))break;}
      await sleep(1000);result.phases.remount={target,actions,...await snapshot()};
      result.phases.remount.remounted=result.phases.remount.viewport.mountedIds.includes(target.id);
    }else result.remountPreparation={notApplicable:'No mounted long-reply block in the virtualized segment; recent rows remain mounted',tail};
    if(name==='candidate'&&(!result.phases.older.revealedOlder||(target&&(!result.remountPreparation.unmounted||!result.phases.remount?.remounted))))throw Error('older/remount gate failed');
    result.loadEnd=load();result.completed=errors.length===0;result.comparisonEligible=result.completed&&displayErrors.length===0;
    if(!result.completed||(displayErrors.length&&name!=='baseline'))throw Error('page/display errors');
    console.log(`${label} ready=${result.phases.open.readyMs.toFixed(0)} row=${host.allRows.sum.toFixed(1)} older=${result.phases.older.revealedOlder} remount=${!!result.phases.remount} displayErrors=${displayErrors.length}`);
  }catch(error){result.error=String(error.stack??error);throw error;}
  finally{writeFileSync(out,JSON.stringify(result,null,2));page.off('pageerror',error);page.off('console',consoleError);paseo('archive',seed.agentId);}
}
mkdirSync(`${root}/raw/web`,{recursive:true});
try{
  // Persist only the private host connection before any timed cold navigation.
  await page.goto('http://127.0.0.1:8092');await sleep(3000);
  const direct=page.getByText('直接连接').first();
  if(await direct.isVisible().catch(()=>false)){
    await direct.click();const inputs=page.locator('input');
    await inputs.nth(0).fill('127.0.0.1');await inputs.nth(1).fill('6871');
    await page.getByText('连接',{exact:true}).last().click();await sleep(4000);
  }
  await page.goto('about:blank');
  if(process.argv.includes('--smoke'))await run('incident','candidate',1,process.env.BC_WEB_HISTORY_PREFIX??'smoke-');
  else for(const scenario of ['incident','multi-turn'])for(let rep=1;rep<=5;rep++){
    const names=rep%2?['candidate','candidate','baseline','native']:['native','baseline','candidate','candidate'];
    let n=0;for(const name of names)await run(scenario,name,name==='candidate'?`${rep}-${++n}`:rep);
  }
}finally{await context.close();}
