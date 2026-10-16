import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,readlinkSync,writeFileSync,existsSync,mkdirSync,realpathSync} from 'node:fs';
import {sh,resources} from './resources.mjs';
import {iosEvaluate} from './ios-evaluate.mjs';
import {installSmoke} from './smoke-ui.mjs';
const campaign='/tmp/bc-ios-five-parallel-20261016',lane=Number(process.argv[2]),phase=process.argv[3]??'core';
if(![2,3,4].includes(lane)||!['smoke','core','risk'].includes(phase))throw Error('explicit new lane/phase required');
const root=`${campaign}/lane${lane}`,home=`/Users/rrd/.paseo-bench-ios-five-lane${lane}`,port=8180+lane,daemonPort=6880+lane;
const cli='/tmp/bc-perf-p0p1/paseo-cli/node_modules/.bin/paseo',server=readFileSync(`${home}/server-id`,'utf8').trim();
const udid=readFileSync(`${root}/sim.udid`,'utf8').trim(),workspace=JSON.parse(readFileSync(`${root}/raw/workspace.json`)).workspaceId;
const out=`${root}/raw/${phase}`;mkdirSync(out,{recursive:true});
const paseo=(...args)=>sh(cli,['--home',home,...args]);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const evaluate=e=>iosEvaluate(e,port),json=async e=>JSON.parse(await evaluate(`JSON.stringify(${e})`));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fixtures=['diff-large','reads-20','reasoning-long-prose','reasoning-long-sections','tool-expanded-streaming'];
const riskFixtures=['mixed-turn','history-100','shell-log-large','table-streaming','codeblock-streaming','markdown-long'];
const shas={parent:'7f01b2d95c87cb6879adf701571de3778a167060',fixed:'722238de2fcc1ade46d542a7a540868932d9dc89'};
const activity=value=>writeFileSync(`${root}/activity.json`,JSON.stringify({lane,pid:process.pid,phase,at:new Date().toISOString(),...value}));
const identities={};
for(const variant of ['parent','fixed']){
 const bytes=readFileSync(`${campaign}/raw/${variant}-source.json`),manifest=JSON.parse(bytes);
 for(const entry of manifest.files){const file=`${root}/${variant}/${entry.path}`;const data=entry.mode==='120000'?Buffer.from(readlinkSync(file)):readFileSync(file);const actual=createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');if(actual!==entry.hash)throw Error('source mismatch '+file);}
 if(manifest.sourceSha!==shas[variant])throw Error('wrong source SHA');
 identities[variant]={sourceSha:manifest.sourceSha,tree:manifest.tree,files:manifest.files.length,manifestSha256:hash(bytes)};
}
const app=sh('xcrun',['simctl','get_app_container',udid,'sh.paseo.debug','app']);
const version=sh('/usr/libexec/PlistBuddy',['-c','Print :CFBundleShortVersionString',`${app}/Info.plist`]),build=sh('/usr/libexec/PlistBuddy',['-c','Print :CFBundleVersion',`${app}/Info.plist`]);
if(version!=='0.11.2'||build!=='11002999'||sh('git',['-C',`${root}/host`,'rev-parse','HEAD'])!=='75953250959979b8f088bbca8dbd6ee61d0151b1')throw Error('host/build mismatch');
const harnessHashes=Object.fromEntries(['runner.mjs','resources.mjs','ios-evaluate.mjs','ios-navigate.mjs','initialized-router.mjs','smoke-ui.mjs'].map(f=>[f,hash(readFileSync(`${campaign}/tools/${f}`))]));
const environment={metroWorkers:2,cacheDirectories:[`${root}/tmp`,`${root}/expo-home`,`${root}/host/.expo`],harnessHashes,executionRegime:'concurrent-max4',lane,root,home,port,daemonPort,server,udid,workspace,version,build,hostSha:'75953250959979b8f088bbca8dbd6ee61d0151b1',hostPatchSha256:hash(sh('git',['-C',`${root}/host`,'diff'])),hostProbeSha256:hash(readFileSync(`${root}/host/packages/app/src/debug/host-perf.ts`)),hardware:{hostname:sh('/bin/hostname',[]),cpu:sh('/usr/sbin/sysctl',['-n','machdep.cpu.brand_string']),memory:sh('/usr/sbin/sysctl',['-n','hw.memsize']),os:sh('/usr/bin/sw_vers',[]),node:process.version},sources:identities};
writeFileSync(`${root}/raw/environment-${phase}.json`,JSON.stringify(environment,null,2));
async function gate(){const waits=[],start=Date.now();for(;;){const r=resources();if(r.admitted)return{admission:r,waits};waits.push(r);console.log('resource gate',r.cpuIdlePct,r.pressureLevel,r.memoryFreePct);if(Date.now()-start>120000){writeFileSync(`${root}/raw/gate-failure-${Date.now()}.json`,JSON.stringify(waits,null,2));throw Error('resource gate timeout; reduce concurrency recommended');}await sleep(5000);}}
async function mode(name){
 const rows=JSON.parse(paseo('plugin','ls','--json'));if(rows.some(r=>!['better-paseo','bc-bench'].includes(r.id)))throw Error('unexpected plugin in fresh lane');
 const current=rows.find(r=>r.id==='better-paseo'),provider=rows.find(r=>r.id==='bc-bench');
 if(!current||!provider?.enabled||provider.status!=='running'||realpathSync(provider.path)!==realpathSync(`${root}/provider`))throw Error('provider isolation failed');
 if(name!=='native')sh('/bin/ln',['-sfn',`${root}/${name==='parent'?'parent':'fixed'}`,`${root}/active`]);
 if(current.enabled!==(name!=='native'))paseo('plugin',name==='native'?'disable':'enable','better-paseo');
 if(name!=='native')paseo('plugin','reload','better-paseo');
 const installed=JSON.parse(paseo('plugin','ls','--json')),plugin=installed.find(r=>r.id==='better-paseo');
 if(name==='native'?plugin.enabled:!plugin.enabled||plugin.status!=='running'||realpathSync(plugin.path)!==realpathSync(`${root}/${name==='parent'?'parent':'fixed'}`))throw Error('source mode isolation failed');
 return installed.map(({id,enabled,status,path})=>({id,enabled,status,path}));
}
async function open(id){
 try{sh('xcrun',['simctl','terminate',udid,'sh.paseo.debug']);}catch{}
 sh('xcrun',['simctl','launch',udid,'sh.paseo.debug','--initialUrl',`http://localhost:${port}`]);
 await sleep(8000);
 let ready=false;for(let i=0;i<120;i++){try{ready=await evaluate('!!globalThis.__hostPerf && !!globalThis.__paseoHostRuntimeStore');}catch{}if(ready)break;await sleep(1000);}if(!ready)throw Error('runtime not ready');
 sh(process.execPath,[`${campaign}/tools/ios-navigate.mjs`,String(port),server,id,'navigate']);await sleep(4000);
 const identity=await json(`(()=>{const r=globalThis.__paseoHostRuntimeStore,s=r.getSnapshot(${JSON.stringify(server)});return{hosts:r.getHosts().map(h=>({serverId:h.serverId,connections:h.connections.map(c=>({type:c.type,endpoint:c.endpoint}))})),serverId:s?.serverId,status:s?.connectionStatus,endpoint:s?.activeConnection?.endpoint,hostPerf:!!globalThis.__hostPerf,plugin:!!globalThis.__bcPerf}})()`);
 if(identity.serverId!==server||identity.status!=='online'||![`127.0.0.1:${daemonPort}`,`localhost:${daemonPort}`].includes(identity.endpoint)||identity.hosts.some(h=>h.connections.some(c=>c.endpoint&&![`127.0.0.1:${daemonPort}`,`localhost:${daemonPort}`].includes(c.endpoint))))throw Error('runtime endpoint mismatch '+JSON.stringify(identity));
 return identity;
}
async function smoke(){
 const file=`${out}/functional.json`;if(existsSync(file))throw Error('smoke exists');
 const r={environment,startedAt:new Date().toISOString()};let id;
 try{
  await gate();r.identity=await mode('fixed-a');id=paseo('run','-d','-q','--provider','bc-bench','--workspace',workspace,'--title',`lane${lane}-smoke`,'list').split('\n').pop();paseo('wait',id,'--timeout','60');r.runtime=await open(id);
  paseo('send',id,'fixture:reasoning-long-prose speed:1','--no-wait');await sleep(3500);await evaluate(`(${installSmoke.toString()})(${JSON.stringify(id)})`);
  r.before=await json('globalThis.__fiveSmoke.snapshot()');if(!r.before?.streaming||r.before.expanded||!r.before.raw.length)throw Error('stream/default disclosure mismatch');
  r.opening=await json('globalThis.__fiveSmoke.open()');await sleep(100);r.after=await json('globalThis.__fiveSmoke.snapshot()');if(!r.after.expanded||r.after.bodyChars<r.opening.before.length)throw Error('expanded reveal lost existing text');
  sh('xcrun',['simctl','pbcopy',udid],{input:'BC-FIVE-COPY-SENTINEL',stdio:['pipe','pipe','pipe']});r.copy=await json('globalThis.__fiveSmoke.copy()');await sleep(350);const copied=execFileSync('xcrun',['simctl','pbpaste',udid],{encoding:'utf8'});r.copy.exactClipboard=copied===r.copy.expected;r.copy.characters=copied.length;if(!r.copy.exactClipboard||!r.copy.sourceMatchesCurrent)throw Error('latest text copy mismatch');
  paseo('wait',id,'--timeout','120');r.final=await json('globalThis.__fiveSmoke.snapshot()');if(r.final.streaming||!r.final.expanded)throw Error('completion disclosure changed');r.completed=true;
 }catch(e){r.error=String(e.stack??e);throw e;}finally{r.endedAt=new Date().toISOString();writeFileSync(file,JSON.stringify(r,null,2));if(id){try{paseo('wait',id,'--timeout','120');paseo('archive',id);}catch(e){console.error('synthetic cleanup',String(e));}}}
 // One native boundary calibration and one parent boundary calibration, untimed for acceptance.
 await sample('diff-large','native',0);await sample('diff-large','parent',0);
}
async function sample(fixture,name,rep){
 const label=`lane${lane}-${name}-${fixture}-r${rep}`,file=`${out}/${label}.json`;if(existsSync(file)){const previous=JSON.parse(readFileSync(file));if(previous.completed){console.log('retained successful',label);return;}throw Error('retained failed output '+file);}
 const variant=name==='parent'?'parent':'fixed';let id;
 const r={executionRegime:'concurrent-max4',lane,phase,fixture,mode:name,rep,disclosure:'defaults',sourceSha:name==='native'?null:shas[variant],sourceIdentity:name==='native'?null:identities[variant],fixtureHash:hash(readFileSync(`${root}/fixed/test/fixtures/streams/${fixture}.jsonl`)),environment,setupStartedAt:new Date().toISOString()};
 activity({state:'setup',label});
 try{
  r.admission=await gate();r.identity=await mode(name);id=paseo('run','-d','-q','--provider','bc-bench','--workspace',workspace,'--title',label,'list').split('\n').pop();r.agentId=id;paseo('wait',id,'--timeout','60');const logStart=readFileSync(`${root}/logs/metro-capped.log`,'utf8').length;r.runtime=await open(id);
  if(r.runtime.plugin!==(name!=='native'))throw Error('plugin client identity mismatch');
  await evaluate('globalThis.__bcPerf?.enable();true');await sleep(1000);r.preTimingGate=await gate();await evaluate('globalThis.__bcPerf?.reset();globalThis.__hostPerf.reset();true');await sleep(1000);
  const startGate=await gate();r.resourceStart=startGate.admission;r.startGateWaits=startGate.waits;activity({state:'timing',label});r.startedAt=new Date().toISOString();
  paseo('send',id,`fixture:${fixture} speed:${fixture==='history-100'?'max':fixture==='tool-expanded-streaming'?'4':'1'}`);paseo('wait',id,'--timeout','900');await sleep(4000);
  r.probe=await json('globalThis.__hostPerf.snapshot()');r.endedAt=new Date().toISOString();r.resourceEnd=resources();r.pluginProbe=name==='native'?null:await json('globalThis.__bcPerf.snapshot()');
  r.displayErrors=readFileSync(`${root}/logs/metro-capped.log`,'utf8').slice(logStart).split('\n').filter(l=>/\bERROR\b|Encountered two children|Rendered (more|fewer) hooks|Maximum update depth/.test(l));
  if(r.displayErrors.length)throw Error('display errors');if(!(r.probe.allRows.sum>0)||(name==='native'?r.probe.rows.plugin>0||!(r.probe.rows.native>0):!(r.probe.rows.plugin>0)))throw Error('row boundary failed');
  r.completed=true;r.comparisonEligible=true;console.log(label,'rows',r.probe.allRows.sum,'idle',r.resourceStart.cpuIdlePct,r.resourceEnd.cpuIdlePct);
 }catch(e){r.error=String(e.stack??e);r.comparisonEligible=false;console.error(label,r.error);}finally{r.finishedAt=new Date().toISOString();writeFileSync(file,JSON.stringify(r,null,2));if(id){try{paseo('wait',id,'--timeout','120');paseo('archive',id);}catch(e){console.error('synthetic cleanup',String(e));}}activity({state:'idle',label});}
 if(!r.completed&&/resource.*(?:admission|gate)/.test(r.error))throw Error('resource instability; stop lane and report');
}
activity({state:'starting'});
try{
 if(phase==='smoke')await smoke();else{
  if(!JSON.parse(readFileSync(`${root}/raw/smoke/functional.json`)).completed)throw Error('functional smoke not passed');
  for(const l of [2,3,4]){const dir=`${campaign}/lane${l}/raw/smoke`;for(const f of ['functional.json',`lane${l}-native-diff-large-r0.json`,`lane${l}-parent-diff-large-r0.json`])if(!JSON.parse(readFileSync(`${dir}/${f}`)).completed)throw Error('all-lane smoke barrier not passed');}
  const list=phase==='risk'?riskFixtures:fixtures,modes=phase==='risk'?['parent','fixed-a']:['native','parent','fixed-a','fixed-b'];
  for(let rep=1;rep<=5;rep++)for(const [index,fixture]of list.entries())if(2+(index+rep-1)%3===lane)for(let n=0;n<modes.length;n++)await sample(fixture,modes[(rep+index+n)%modes.length],rep);
 }
 writeFileSync(`${root}/${phase}.status`,'0');
}catch(e){writeFileSync(`${root}/${phase}.status`,'1');throw e;}finally{activity({state:'finished'});}
