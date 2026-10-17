import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,renameSync} from 'node:fs';

export const admitted=s=>Number.isFinite(s.cpuIdlePct)&&s.cpuIdlePct>=15&&Number.isFinite(s.memoryFreePct)&&s.memoryFreePct>=10&&s.pressureLevel===1;
const sh=(file,args)=>execFileSync(file,args,{encoding:'utf8',timeout:30000}).trim();
export function resources(){
  const top=sh('/usr/bin/top',['-l','1','-n','0']),memory=sh('/usr/bin/memory_pressure',['-Q']);
  const sample={at:new Date().toISOString(),cpuIdlePct:Number(top.match(/CPU usage:.*?([\d.]+)% idle/)?.[1]),memoryFreePct:Number(memory.match(/free percentage:\s*(\d+)%/)?.[1]),pressureLevel:Number(sh('/usr/sbin/sysctl',['-n','kern.memorystatus_vm_pressure_level'])),load:sh('/usr/sbin/sysctl',['-n','vm.loadavg']).replace(/[{}]/g,'').trim().split(/\s+/).map(Number),activities:[1,2,3,4].flatMap(lane=>{const file=`/tmp/bc-readme-20261017/parallel-v2/lane${lane}/activity.json`;return existsSync(file)?[JSON.parse(readFileSync(file))]:[];})};
  return {...sample,admitted:admitted(sample)};
}
export function activity(value){
  const root=process.env.BC_LANE_ROOT;
  if(!/^\/tmp\/bc-readme-20261017\/parallel-v2\/lane[1-4]$/.test(root??''))throw Error('owned lane activity required');
  const file=`${root}/activity.${process.pid}.tmp`;
  writeFileSync(file,JSON.stringify({at:new Date().toISOString(),lane:Number(process.env.BC_LANE),pid:process.pid,...value}));
  renameSync(file,`${root}/activity.json`);
}
export async function gate(value){
  activity({...value,stage:'resource-gate'});
  for(;;){const sample=resources();if(sample.admitted)return sample;console.log('resource gate',JSON.stringify(sample));await new Promise(resolve=>setTimeout(resolve,5000));}
}
