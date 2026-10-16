import {resources as nativeResources,sh} from './resources.mjs';
export {sh};
export function parseWebProcesses(output){
 return output.split('\n').flatMap(line=>{
  const match=line.match(/^\s*(\d+)\s+(\d+)\s+((?:\S*\/)?node .*\/web-runner\.mjs .+)$/);
  return match?[{pid:Number(match[1]),ppid:Number(match[2]),command:match[3]}]:[];
 });
}
export function resources(){
 const result=nativeResources();
 const web=parseWebProcesses(sh('/bin/ps',['-axo','pid=,ppid=,command=']));
 result.processes.push(...web.filter(row=>!result.processes.some(existing=>existing.pid===row.pid)));
 return result;
}
