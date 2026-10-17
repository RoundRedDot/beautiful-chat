import test from 'node:test';
import assert from 'node:assert/strict';
import {median,classify,summarize,fixtures,displayOnlyFailure} from './report.mjs';
test('an original measured display failure remains diagnostic; unrelated collection errors cannot resume',()=>{
  const row={comparisonEligible:false,displayErrors:['HostFunction'],errors:[],error:'Error: display errors HostFunction',probe:{allRows:{sum:100}},startedAt:'2026-10-17T00:00:00Z',endedAt:'2026-10-17T00:00:01Z'};
  assert.equal(displayOnlyFailure(row),true);
  assert.equal(displayOnlyFailure({...row,error:'Error: transport disconnected'}),false);
  assert.equal(displayOnlyFailure({...row,errors:['page failure']}),false);
  assert.equal(displayOnlyFailure({...row,probe:null}),false);
});
test('comparison thresholds apply the small-replay floor only when explicitly requested',()=>{
  assert.equal(median([3,1,9,5,7]),5);assert.equal(median([1,3]),2);
  assert.equal(classify(100,95),'even');assert.equal(classify(100,80),'better');assert.equal(classify(100,120),'worse');
  assert.equal(classify(.35,.42,.5),'even');assert.equal(classify(.35,.42),'worse');
  assert.equal(classify(0,0),'even');assert.equal(classify(0,.01),'worse');
});
test('a complete matrix passes, while a substituted source revision is rejected',()=>{
  const records=['web','ios'].flatMap(platform=>fixtures.flatMap(([fixture])=>['native','upstream','fork','aa','parent'].flatMap(mode=>Array.from({length:5},(_,i)=>({
    platform,fixture,mode,rep:i+1,completed:true,loadStart:1,loadEnd:1,errors:[],displayErrors:[],fixtureHash:'a'.repeat(64),
    sourceSha:mode==='native'?null:mode==='parent'?'2fc6476acbdf75e8802668b0260cfd128513c990':['fork','aa'].includes(mode)?'b9dfae6e31453b962d90f7d3c7ca972c0e523cb3':'42b61d8301b5400a67821bbbfcf99fa8b681dc37',seen:{host:true,fork:['fork','aa','parent'].includes(mode)},
    probe:{allRows:{sum:100},perCommit:{n:1},rows:{plugin:mode==='native'?0:1,native:mode==='native'?1:0},layoutShift:0},cdp:{delta:{TaskDuration:1},jsHeapUsedMB:100,nodes:1000}
  })))));
  assert.equal(records.length,550);assert.deepEqual(summarize(records).failures,[]);
  assert.ok(summarize(records).aa.every(group=>group.pairs.length===5&&group.over10===0));
  Object.assign(records[0],{completed:false,comparisonEligible:false,displayErrors:['HostFunction'],error:'Error: display errors HostFunction',startedAt:'2026-10-17T00:00:00Z',endedAt:'2026-10-17T00:00:01Z'});
  assert.deepEqual(summarize(records).failures,[]);
  assert.equal(summarize(records).groups[0].diagnosticOnly,true);
  records[0].sourceSha='wrong';assert.ok(summarize(records).failures.some(line=>line.includes('identity mismatch')));
});
test('one display error makes the whole fixture-mode group diagnostic and missing samples remain failures',()=>{
  const records=Array.from({length:5},(_,i)=>({platform:'ios',fixture:'mixed-turn',mode:'upstream',rep:i+1,completed:true,loadStart:1,loadEnd:1,errors:[],displayErrors:i===2?['duplicate key']:[],probe:{allRows:{sum:100+i},perCommit:{n:1}}}));
  const result=summarize(records);assert.equal(result.groups[0].diagnosticOnly,true);assert.equal(result.groups[0].n,5);assert.ok(result.failures.length>0);assert.equal(result.groups[0].metrics.rows.median,102);
});
