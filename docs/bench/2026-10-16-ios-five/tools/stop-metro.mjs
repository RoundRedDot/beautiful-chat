// Stop only this campaign's Expo process tree; do not touch another Metro session.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const marker=process.argv[2];
if(!marker?.startsWith('/tmp/bc-ios-five-20261016/')||!marker.endsWith('/metro.pid'))throw Error('owned PID marker required');
const sh=(file,args)=>execFileSync(file,args,{encoding:'utf8'}).trim();
const parent=Number(readFileSync(marker,'utf8'));
const children=sh('/bin/ps',['-axo','pid=,ppid=,command=']).split('\n').map(line=>{const [,pid,ppid,command]=line.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/)??[];return {pid:Number(pid),ppid:Number(ppid),command};});
const owned=new Set([parent]);let changed=true;
while(changed){changed=false;for(const row of children)if(owned.has(row.ppid)&&!owned.has(row.pid)){owned.add(row.pid);changed=true;}}
const rows=children.filter(row=>owned.has(row.pid));
if(!rows.some(row=>/expo start.*8085/.test(row.command)))throw Error('owned Expo command not present; inspect before stopping');
for(const row of rows.reverse())try{process.kill(row.pid,'SIGTERM');}catch(error){if(error.code!=='ESRCH')throw error;}
console.log(JSON.stringify({marker,stopped:rows}));
