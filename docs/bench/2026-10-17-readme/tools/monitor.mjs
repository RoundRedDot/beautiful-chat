import {readFileSync,readdirSync,existsSync} from 'node:fs';
const root='/tmp/bc-readme-20261017/parallel-v2';
const count=(dir,pattern)=>existsSync(dir)?readdirSync(dir).filter(f=>pattern.test(f)).length:0;
const status=file=>existsSync(file)?readFileSync(file,'utf8').trim():null;
for(;;){
  const lanes=[1,2,3,4].map(lane=>{
    const path=`${root}/lane${lane}`;
    return {lane,status:status(`${path}/campaign.status`),web:count(`${path}/raw/web`,/\.json$/),ios:count(`${path}/raw/ios`,/\.json$/),historyWeb:count(`${path}/history/raw/web`,/^(incident|multi-turn)-.*\.json$/),historyIos:count(`${path}/history/raw/ios`,/^(incident|multi-turn)-.*\.json$/),webDone:existsSync(`${path}/web.done`),iosDone:existsSync(`${path}/ios.done`),activity:existsSync(`${path}/activity.json`)?JSON.parse(readFileSync(`${path}/activity.json`)):null};
  });
  const completed=lanes.reduce((n,l)=>n+l.web+l.ios+l.historyWeb+l.historyIos,0);
  console.log(JSON.stringify({at:new Date().toISOString(),completed,expected:630,lanes}));
  if(lanes.some(l=>l.status!==null&&l.status!=='0'))process.exit(1);
  if(lanes.every(l=>l.status==='0'))break;
  await new Promise(resolve=>setTimeout(resolve,40000));
}
