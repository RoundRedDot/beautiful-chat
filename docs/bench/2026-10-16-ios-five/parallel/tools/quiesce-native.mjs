import{readFileSync,writeFileSync}from'node:fs';import{execFileSync}from'node:child_process';
const lane=Number(process.argv[2]);if(![2,3,4].includes(lane))throw Error('own lane');const root=`/tmp/bc-ios-five-parallel-20261016/lane${lane}`;
if(readFileSync(`${root}/risk.status`,'utf8').trim()!=='0')throw Error('native risk incomplete');
const sh=(f,a)=>execFileSync(f,a,{encoding:'utf8'}).trim();
const udid=readFileSync(`${root}/sim.udid`,'utf8').trim(),device=Object.values(JSON.parse(sh('xcrun',['simctl','list','devices','--json'])).devices).flat().find(d=>d.udid===udid);
if(device?.name!==`bc-five-parallel-${lane}`)throw Error('sim ownership mismatch');
if(device.state==='Booted'){try{sh('xcrun',['simctl','terminate',udid,'sh.paseo.debug']);}catch{}sh('xcrun',['simctl','shutdown',udid]);}
const parent=Number(readFileSync(`${root}/metro.pid`,'utf8')),rows=sh('/bin/ps',['-axo','pid=,ppid=,command=']).split('\n').flatMap(l=>{const m=l.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/);return m?[{pid:Number(m[1]),ppid:Number(m[2]),command:m[3]}]:[];});
const owned=new Set([parent]);let changed=true;while(changed){changed=false;for(const r of rows)if(owned.has(r.ppid)&&!owned.has(r.pid)){owned.add(r.pid);changed=true;}}
const selected=rows.filter(r=>owned.has(r.pid));if(selected.length&&!selected.some(r=>r.command.includes('expo start')&&r.command.includes(`--port ${8180+lane}`)))throw Error('Metro ownership mismatch');
for(const r of selected.reverse())try{process.kill(r.pid,'SIGTERM');}catch(e){if(e.code!=='ESRCH')throw e;}
writeFileSync(`${root}/raw/native-quiesced.json`,JSON.stringify({at:new Date().toISOString(),lane,udid,reason:'native collection complete; avoid idle native client during Web tests',metro:selected},null,2));
