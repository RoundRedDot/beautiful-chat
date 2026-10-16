import {readdirSync,readFileSync} from 'node:fs';
const [directory]=process.argv.slice(2);
const runs=readdirSync(directory).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(readFileSync(`${directory}/${f}`,'utf8')));
const median=values=>{const s=[...values].sort((a,b)=>a-b);return s.length%2?s[(s.length-1)/2]:(s[s.length/2-1]+s[s.length/2])/2;};
let failed=false;
for(const fixture of new Set(runs.map(r=>r.fixture))){
 const values=mode=>runs.filter(r=>r.fixture===fixture&&r.mode===mode);
 const native=values('native'),candidate=values('fork');
 if(!native.length||!candidate.length){console.log(fixture,'INCOMPLETE');failed=true;continue;}
 const group=[...native,...candidate];
 if(group.some(r=>!r.completed||r.error||r.displayErrors.length||r.loadStart>4)||new Set(group.map(r=>r.fixtureHash)).size!==1)throw Error('ineligible group '+fixture);
 const base=median(native.map(r=>r.probe.allRows.sum)),current=median(candidate.map(r=>r.probe.allRows.sum));
 const delta=current/base-1,verdict=delta<0.1?'PASS':'REGRESSION';
 console.log(JSON.stringify({fixture,native:base,candidate:current,delta,verdict,n:[native.length,candidate.length],rangeNative:[Math.min(...native.map(r=>r.probe.allRows.sum)),Math.max(...native.map(r=>r.probe.allRows.sum))],rangeCandidate:[Math.min(...candidate.map(r=>r.probe.allRows.sum)),Math.max(...candidate.map(r=>r.probe.allRows.sum))]}));
 if(verdict==='REGRESSION')failed=true;
}
if(!runs.length)throw Error('empty collection');
process.exitCode=failed?1:0;
