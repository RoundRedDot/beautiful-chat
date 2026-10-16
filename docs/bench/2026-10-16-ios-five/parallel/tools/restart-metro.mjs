import {readFileSync,writeFileSync} from 'node:fs';import {execFileSync,spawn} from 'node:child_process';
const lane=Number(process.argv[2]);if(![2,3,4].includes(lane))throw Error('own lane required');
const root=`/tmp/bc-ios-five-parallel-20261016/lane${lane}`,port=8180+lane;
const rows=execFileSync('/bin/ps',['-axo','pid=,ppid=,command='],{encoding:'utf8'}).split('\n').flatMap(l=>{const m=l.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/);return m?[{pid:Number(m[1]),ppid:Number(m[2]),command:m[3]}]:[];});
const parent=Number(readFileSync(`${root}/metro.pid`,'utf8')),owned=new Set([parent]);let changed=true;while(changed){changed=false;for(const r of rows)if(owned.has(r.ppid)&&!owned.has(r.pid)){owned.add(r.pid);changed=true;}}
const selected=rows.filter(r=>owned.has(r.pid));if(!selected.some(r=>r.command.includes('expo start')&&r.command.includes(`--port ${port}`)))throw Error('Metro ownership guard failed');
writeFileSync(`${root}/raw/metro-restart-${Date.now()}.json`,JSON.stringify({at:new Date().toISOString(),reason:'cap each own Metro at two workers; setup only',parent,stopped:selected},null,2));
for(const r of selected.reverse())try{process.kill(r.pid,'SIGTERM');}catch(e){if(e.code!=='ESRCH')throw e;}
