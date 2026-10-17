import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,symlinkSync,unlinkSync} from 'node:fs';
const base='/tmp/bc-readme-20261017',root=`${base}/parallel-v2`;
const cli='/tmp/bc-perf-p0p1/paseo-cli/node_modules/.bin/paseo';
const sh=(file,args)=>execFileSync(file,args,{encoding:'utf8',timeout:180000}).trim();
const result={at:new Date().toISOString(),lanes:[]};
function stop(marker,needle){
  if(!existsSync(marker))return {marker,notStarted:true};
  const pid=Number(readFileSync(marker,'utf8'));
  const processes=sh('/bin/ps',['-axo','pid=,ppid=,command=']).split('\n').map(line=>{const [,id,parent,command]=line.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/)??[];return {pid:Number(id),ppid:Number(parent),command};});
  if(!processes.some(p=>p.pid===pid))return {marker,alreadyStopped:true};
  const owned=new Set([pid]);let changed=true;
  while(changed){changed=false;for(const process of processes)if(owned.has(process.ppid)&&!owned.has(process.pid)){owned.add(process.pid);changed=true;}}
  const tree=processes.filter(p=>owned.has(p.pid));
  if(!tree.some(p=>p.command.includes(needle)))throw Error(`owned process identity changed: ${marker}`);
  for(const process of tree.reverse())try{globalThis.process.kill(process.pid,'SIGTERM');}catch(error){if(error.code!=='ESRCH')throw error;}
  return {marker,stopped:tree};
}
for(let lane=1;lane<=4;lane++){
  const directory=`${root}/lane${lane}`,env=JSON.parse(readFileSync(`${directory}/raw/environment.json`));
  if(readFileSync(`${directory}/campaign.status`,'utf8').trim()!=='0')throw Error('cleanup requires all completed lanes');
  const paseo=(...args)=>sh(cli,['--home',env.BC_BENCH_HOME,...args]);
  const entries=JSON.parse(paseo('plugin','ls','--json'));
  if(entries.find(p=>p.id==='beautiful-chat')?.enabled)paseo('plugin','disable','beautiful-chat');
  unlinkSync(env.BC_ACTIVE_LINK);symlinkSync(`${directory}/candidate`,env.BC_ACTIVE_LINK);
  if(!entries.find(p=>p.id==='better-paseo')?.enabled)paseo('plugin','enable','better-paseo');
  else paseo('plugin','reload','better-paseo');
  const restored=JSON.parse(paseo('plugin','ls','--json'));
  const daemon=paseo('daemon','stop');
  const web=stop(`${directory}/web.pid`,`${directory}/tools/serve-web.mjs`);
  const metro=stop(`${directory}/metro.pid`,`--port ${env.METRO_PORT}`);
  sh('xcrun',['simctl','shutdown',env.BC_SIM_UDID]);
  result.lanes.push({lane,restored,daemon,web,metro,simulator:env.BC_SIM_UDID});
}
await new Promise(resolve=>setTimeout(resolve,2500));
const ports=[6891,6892,6893,6894,8311,8312,8313,8314,8211,8212,8213,8214];
let listeners='';try{listeners=sh('/usr/sbin/lsof',['-nP',...ports.map(port=>`-iTCP:${port}`),'-sTCP:LISTEN']);}catch(error){if(error.status!==1)throw error;}
result.ownedPorts={ports,listeners};
result.simulators=JSON.parse(sh('xcrun',['simctl','list','devices','--json']));
result.protectedAvds=sh('/bin/ps',['-axo','pid=,command=']).split('\n').filter(line=>line.includes('qemu-system')&&line.includes('-avd'));
writeFileSync(`${root}/raw/cleanup.json`,JSON.stringify(result,null,2));
if(listeners)throw Error('owned listeners remain after cleanup');
console.log(JSON.stringify({lanes:result.lanes.length,ownedListeners:0}));
