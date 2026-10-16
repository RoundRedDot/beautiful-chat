import{execFileSync}from'node:child_process';import{readFileSync,writeFileSync,existsSync,realpathSync}from'node:fs';
const root='/tmp/bc-ios-five-parallel-20261016',sh=(f,a)=>execFileSync(f,a,{encoding:'utf8'}).trim();
if(readFileSync(`${root}/web-resume.status`,'utf8').trim()!=='0')throw Error('formal Web audit not complete');
const before=Object.values(JSON.parse(readFileSync(`${root}/raw/devices-before.json`)).devices).flat();
const ps=()=>sh('/bin/ps',['-axo','pid=,ppid=,command=']).split('\n').flatMap(l=>{const m=l.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/);return m?[{pid:Number(m[1]),ppid:Number(m[2]),command:m[3]}]:[];});
const result={at:new Date().toISOString(),executionRegime:'concurrent-max4',lanes:[]};
for(const lane of [2,3,4]){
 const dir=`${root}/lane${lane}`,benchHome=`/Users/rrd/.paseo-bench-ios-five-lane${lane}`;
 for(const phase of ['core','risk','web-risk'])if(readFileSync(`${dir}/${phase}.status`,'utf8').trim()!=='0')throw Error(`${lane}: unfinished ${phase}`);
 const r={lane,stopped:[]};
 for(const [marker,match]of [['metro.pid',new RegExp(`expo start.*--port ${8180+lane}`)],['web.pid',new RegExp(`serve-web.mjs ${dir}/web-dist ${8280+lane}`)]]){
  const parent=Number(readFileSync(`${dir}/${marker}`,'utf8')),rows=ps(),owned=new Set([parent]);let changed=true;while(changed){changed=false;for(const row of rows)if(owned.has(row.ppid)&&!owned.has(row.pid)){owned.add(row.pid);changed=true;}}
  const selected=rows.filter(row=>owned.has(row.pid));if(selected.length&&!selected.some(row=>match.test(row.command)))throw Error('process ownership mismatch '+marker);
  for(const row of selected.reverse())try{process.kill(row.pid,'SIGTERM');}catch(e){if(e.code!=='ESRCH')throw e;}r.stopped.push(...selected);
 }
 const chrome=ps().filter(row=>row.command.includes(`--user-data-dir=${dir}/web-profile`));for(const row of chrome){try{process.kill(row.pid,'SIGTERM');}catch(e){if(e.code!=='ESRCH')throw e;}}r.stopped.push(...chrome);
 const udid=readFileSync(`${dir}/sim.udid`,'utf8').trim(),devices=Object.values(JSON.parse(sh('xcrun',['simctl','list','devices','--json'])).devices).flat(),device=devices.find(d=>d.udid===udid);
 if(before.some(d=>d.udid===udid)||device?.name!==`bc-five-parallel-${lane}`)throw Error('not a newly owned simulator');
 if(device.state==='Booted'){try{sh('xcrun',['simctl','terminate',udid,'sh.paseo.debug']);}catch{}sh('xcrun',['simctl','shutdown',udid]);}
 const listener=sh('/usr/sbin/lsof',[`-tiTCP:${6880+lane}`,'-sTCP:LISTEN']),expected=Number(readFileSync(`${dir}/logs/daemon-start.log`,'utf8').match(/PID (\d+)/)?.[1]);
 const owner=ps().find(row=>row.pid===Number(listener));if(owner?.ppid!==expected||!owner.command.startsWith('Paseo Daemon'))throw Error('daemon ownership mismatch');
 const cli='/tmp/bc-perf-p0p1/paseo-cli/node_modules/.bin/paseo',paseo=(...args)=>sh(cli,['--home',benchHome,...args]);
 r.activeBefore=realpathSync(`${dir}/active`);if(!['parent','fixed'].some(v=>r.activeBefore===realpathSync(`${dir}/${v}`)))throw Error('active pointer escaped lane');
 sh('/bin/ln',['-sfn',`${dir}/fixed`,`${dir}/active`]);paseo('plugin','reload','better-paseo');
 r.plugins=JSON.parse(paseo('plugin','ls','--json')).map(({id,enabled,status,path})=>({id,enabled,status,path}));
 if(r.plugins.length!==2||r.plugins.some(p=>!['better-paseo','bc-bench'].includes(p.id)||!p.enabled||p.status!=='running'))throw Error('fresh private plugin restore mismatch');
 r.activeAfter=realpathSync(`${dir}/active`);if(r.activeAfter!==realpathSync(`${dir}/fixed`))throw Error('fixed pointer restore mismatch');
 r.daemon=owner;r.daemonStop=paseo('daemon','stop');r.udid=udid;result.lanes.push(r);
}
await new Promise(r=>setTimeout(r,1500));
const devices=Object.values(JSON.parse(sh('xcrun',['simctl','list','devices','--json'])).devices).flat();
result.simulators=devices.filter(d=>d.name.startsWith('bc-five-parallel-')||['4497FFF9-93D1-4713-B55B-A9988BC2209E','046DC4D3-2BAF-47DE-A2F5-B9A15D00B210'].includes(d.udid)).map(({udid,name,state})=>({udid,name,state}));
result.protectedAvds=ps().filter(r=>r.command.includes('qemu-system')&&/-avd Pixel_9_API_37(?:_b)? /.test(r.command));
result.group1Activity=existsSync('/tmp/bc-history-complete-20261016/activity.json')?JSON.parse(readFileSync('/tmp/bc-history-complete-20261016/activity.json')):null;
const ports=[6882,6883,6884,8182,8183,8184,8282,8283,8284];let listeners='';try{listeners=sh('/usr/sbin/lsof',['-nP',...ports.map(p=>`-iTCP:${p}`),'-sTCP:LISTEN']);}catch{}
result.ownedPorts={ports,listeners};writeFileSync(`${root}/raw/cleanup.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
if(listeners||result.simulators.some(d=>d.name.startsWith('bc-five-parallel-')&&d.state!=='Shutdown'))throw Error('cleanup readback failed');
