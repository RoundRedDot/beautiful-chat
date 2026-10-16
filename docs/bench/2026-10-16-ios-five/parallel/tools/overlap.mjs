import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
const root=process.argv[2];if(!root)throw Error('campaign root required');
const rows=[2,3,4].flatMap(l=>['core','risk','web-risk'].flatMap(phase=>readdirSync(`${root}/lane${l}/raw/${phase}`).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(readFileSync(`${root}/lane${l}/raw/${phase}/${f}`)))));
const result={note:'Derived from retained sample intervals, not a replacement for raw process snapshots. Counts own timed replays only, excludes setup and group1. Web process enumeration missed absolute node paths; raw activity/PID fields remain available.',phases:[]};
for(const phase of ['core','risk','web-risk']){
 const input=rows.filter(r=>r.phase===phase),samples=input.map(r=>({lane:r.lane,fixture:r.fixture,mode:r.mode,rep:r.rep,startedAt:r.startedAt,endedAt:r.endedAt,overlappingSamples:input.filter(other=>Date.parse(other.startedAt)<Date.parse(r.endedAt)&&Date.parse(other.endedAt)>Date.parse(r.startedAt)).map(other=>({lane:other.lane,fixture:other.fixture,mode:other.mode,rep:other.rep}))}));
 const events=input.flatMap(r=>[{t:Date.parse(r.startedAt),delta:1},{t:Date.parse(r.endedAt),delta:-1}]).sort((a,b)=>a.t-b.t||a.delta-b.delta),secondsByTimedConcurrency={};let active=0,last=events[0].t;
 for(const event of events){secondsByTimedConcurrency[active]=(secondsByTimedConcurrency[active]??0)+(event.t-last)/1000;active+=event.delta;last=event.t;}
 result.phases.push({phase,samples:samples.length,secondsByTimedConcurrency,intervals:samples});
}
writeFileSync(`${root}/raw/derived-overlap.json`,JSON.stringify(result,null,2));
