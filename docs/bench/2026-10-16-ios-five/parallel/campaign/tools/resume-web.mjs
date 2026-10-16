import {readFileSync,writeFileSync,existsSync,openSync,closeSync,readdirSync} from 'node:fs';
import {spawn,execFileSync} from 'node:child_process';
const root='/tmp/bc-ios-five-parallel-20261016';
try{
 for(;;){
  const ready=[2,3,4].map(l=>{const f=`${root}/lane${l}/web-smoke.status`;if(!existsSync(f))return false;if(readFileSync(f,'utf8').trim()!=='0')throw Error(`lane${l}: smoke failed`);return true;});
  if(ready.every(Boolean))break;
  await new Promise(resolve=>setTimeout(resolve,2000));
 }
 for(const lane of [2,3,4]){
  for(const mode of ['parent','fixed-a'])if(!JSON.parse(readFileSync(`${root}/lane${lane}/raw/web-smoke/lane${lane}-${mode}-mixed-turn-r0.json`)).completed)throw Error('all-lane smoke barrier');
  const dir=`${root}/lane${lane}/raw/web-risk`;if(existsSync(dir)&&readdirSync(dir).length)throw Error('formal Web data already exists; do not reschedule successful work');
 }
 writeFileSync(`${root}/raw/web-formal-start.txt`,new Date().toISOString());
 await Promise.all([2,3,4].map(lane=>new Promise((resolve,reject)=>{
  const dir=`${root}/lane${lane}`,log=openSync(`${dir}/logs/web-risk2.log`,'wx');
  const child=spawn(process.execPath,[`${root}/tools/web-runner.mjs`,String(lane)],{stdio:['ignore',log,log]});closeSync(log);
  writeFileSync(`${dir}/web-risk.pid`,String(child.pid));
  child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error(`lane${lane}: Web worker exit ${code}`)));
 })));
 const audit=execFileSync(process.execPath,[`${root}/tools/audit.mjs`,root,'web-risk'],{encoding:'utf8'});writeFileSync(`${root}/logs/web-risk-audit.txt`,audit);
 writeFileSync(`${root}/web-resume.status`,'0');
}catch(e){writeFileSync(`${root}/web-resume.status`,'1');console.error(e);process.exitCode=1;}
