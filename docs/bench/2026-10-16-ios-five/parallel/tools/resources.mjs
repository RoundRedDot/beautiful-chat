import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
const root='/tmp/bc-ios-five-parallel-20261016';
export const sh=(f,a,o={})=>execFileSync(f,a,{encoding:'utf8',timeout:180000,maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe'],...o}).trim();
export function resources(){
 const top=sh('/usr/bin/top',['-l','1','-n','0']);
 const idle=Number(top.match(/CPU usage:.*?([\d.]+)% idle/)?.[1]);
 const load=sh('/usr/sbin/sysctl',['-n','vm.loadavg']).replace(/[{}]/g,'').trim().split(/\s+/).map(Number);
 const memory=sh('/usr/bin/memory_pressure',['-Q']);
 const free=Number(memory.match(/free percentage:\s*(\d+)%/)?.[1]);
 const pressure=Number(sh('/usr/sbin/sysctl',['-n','kern.memorystatus_vm_pressure_level']));
 const tasks=[];
 const history='/tmp/bc-history-complete-20261016/activity.json';if(existsSync(history))tasks.push({lane:1,...JSON.parse(readFileSync(history))});
 for(const lane of [2,3,4]){const file=`${root}/lane${lane}/activity.json`;if(existsSync(file))tasks.push(JSON.parse(readFileSync(file)));}
 const processes=sh('/bin/ps',['-axo','pid=,ppid=,command=']).split('\n').filter(line=>/node .*\/(?:run-native|run-web|runner|full-scroll)\.mjs/.test(line)).map(line=>{const [,pid,ppid,command]=line.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/)??[];return{pid:Number(pid),ppid:Number(ppid),command};});
 return {at:new Date().toISOString(),cpuIdlePct:idle,load,pressureLevel:pressure,memoryFreePct:free,vm:sh('/usr/bin/vm_stat',[]),concurrentTasks:tasks,processes,admitted:Number.isFinite(idle)&&idle>=15&&free>=10&&pressure===1};
}
