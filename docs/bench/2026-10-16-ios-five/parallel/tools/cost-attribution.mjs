import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {median} from './audit.mjs';
const root=process.argv[2];if(!root)throw Error('campaign root required');
const rows=[2,3,4].flatMap(l=>readdirSync(`${root}/lane${l}/raw/core`).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(readFileSync(`${root}/lane${l}/raw/core/${f}`))));
const groups=[];
for(const fixture of [...new Set(rows.map(r=>r.fixture))])for(const mode of ['native','parent','fixed-a','fixed-b']){
 const input=rows.filter(r=>r.fixture===fixture&&r.mode===mode),group={fixture,mode,kinds:{},rendererCalls:{}};
 for(const kind of [...new Set(input.flatMap(r=>Object.keys(r.probe.kinds)))])group.kinds[kind]={sumMedian:median(input.map(r=>r.probe.kinds[kind]?.sum??0)),commitsMedian:median(input.map(r=>r.probe.kinds[kind]?.commits??0))};
 for(const kind of [...new Set(input.flatMap(r=>Object.keys(r.pluginProbe?.renders?.byKind??{})))])group.rendererCalls[kind]=median(input.map(r=>r.pluginProbe.renders.byKind[kind]??0));
 groups.push(group);
}
writeFileSync(`${root}/raw/core-cost-attribution.json`,JSON.stringify({at:new Date().toISOString(),note:'Per-kind medians need not sum to total medians; observational decomposition, not a causal ablation.',groups},null,2));
