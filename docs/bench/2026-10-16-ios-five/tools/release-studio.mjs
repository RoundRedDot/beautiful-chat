import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,readlinkSync} from 'node:fs';
const root='/tmp/bc-ios-five-20261016',home='/Users/rrd/.paseo-bench-p0p1',sim='4497FFF9-93D1-4713-B55B-A9988BC2209E';
const sh=(bin,args)=>execFileSync(bin,args,{encoding:'utf8'}).trim();
const cli=(...args)=>sh('/tmp/bc-perf-p0p1/paseo-cli/node_modules/.bin/paseo',['--home',home,...args]);
const pid=Number(readFileSync(`${root}/calibration.pid`,'utf8'));
let command='';try{command=sh('/bin/ps',['-p',String(pid),'-o','command=']);}catch{}
if(command.includes(`${root}/tools/env.sh`))throw Error('collection still running');
const before=JSON.parse(readFileSync(`${root}/raw/plugins-before.json`,'utf8'));
sh('/bin/ln',['-sfn','/tmp/bc-m0-o1/candidate','/tmp/bc-m0-o1/active']);
let current=JSON.parse(cli('plugin','ls','--json'));
for(const original of before){
 const row=current.find(r=>r.id===original.id);if(!row)throw Error('missing plugin '+original.id);
 if(row.enabled!==original.enabled)cli('plugin',original.enabled?'enable':'disable',original.id);
}
cli('plugin','reload','better-paseo');
current=JSON.parse(cli('plugin','ls','--json'));
if(before.some(b=>current.find(r=>r.id===b.id)?.enabled!==b.enabled)||readlinkSync('/tmp/bc-m0-o1/active')!=='/tmp/bc-m0-o1/candidate')throw Error('restore readback failed');
writeFileSync(`${root}/raw/plugins-restored.json`,JSON.stringify(current,null,2));
let metro=JSON.stringify({alreadyStopped:true});
let metroCommand='';try{metroCommand=sh('/bin/ps',['-p',readFileSync(`${root}/metro.pid`,'utf8').trim(),'-o','command=']);}catch{}
if(metroCommand.includes('expo')||metroCommand.includes('npm'))metro=sh(process.execPath,[`${root}/tools/stop-metro.mjs`,`${root}/metro.pid`]);
try{sh('xcrun',['simctl','terminate',sim,'sh.paseo.debug']);}catch{}
const state=Object.values(JSON.parse(sh('xcrun',['simctl','list','devices','--json'])).devices).flat().find(d=>d.udid===sim)?.state;
if(state==='Booted')sh('xcrun',['simctl','shutdown',sim]);
const expected=Number(readFileSync(`${root}/logs/daemon-start.log`,'utf8').match(/PID (\d+)/)?.[1]);
const listener=sh('/usr/sbin/lsof',['-tiTCP:6871','-sTCP:LISTEN']);
const owner=sh('/bin/ps',['-p',listener,'-o','ppid=,command=']);
if(!owner.match(new RegExp(`^${expected}\\s+Paseo Daemon`)))throw Error('private daemon owner changed: '+owner);
const daemonStop=cli('daemon','stop');
const devices=JSON.parse(sh('xcrun',['simctl','list','devices','--json']));
const selected=Object.values(devices.devices).flat().filter(d=>[sim,'046DC4D3-2BAF-47DE-A2F5-B9A15D00B210'].includes(d.udid)).map(({name,udid,state})=>({name,udid,state}));
const avds=sh('/bin/ps',['-axo','command=']).split('\n').filter(c=>/qemu-system/.test(c)&&/-avd Pixel_9_API_37(?:_b)? /.test(c));
let listeners='';try{listeners=sh('/usr/sbin/lsof',['-nP','-iTCP:6871','-iTCP:8085','-iTCP:8092','-sTCP:LISTEN']);}catch{}
const result={at:new Date().toISOString(),activeLink:readlinkSync('/tmp/bc-m0-o1/active'),pluginsRestored:true,daemonStop,metro:JSON.parse(metro),simulators:selected,protectedAvds:avds,ownedPorts:{ports:[6871,8085,8092],listeners}};
writeFileSync(`${root}/raw/cleanup.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
if(listeners||selected.find(d=>d.udid===sim)?.state!=='Shutdown'||selected.find(d=>d.udid!==sim)?.state!=='Booted'||avds.length!==2)throw Error('cleanup readback failed');
