import test from 'node:test';
import assert from 'node:assert/strict';
import {median,classify,summarize,fixtures} from './report.mjs';
test('comparison thresholds apply the small-replay floor only when explicitly requested',()=>{
  assert.equal(median([3,1,9,5,7]),5);assert.equal(median([1,3]),2);
  assert.equal(classify(100,95),'even');assert.equal(classify(100,80),'better');assert.equal(classify(100,120),'worse');
  assert.equal(classify(.35,.42,.5),'even');assert.equal(classify(.35,.42),'worse');
  assert.equal(classify(0,0),'even');assert.equal(classify(0,.01),'worse');
});
test('a complete matrix passes, while a substituted source revision is rejected',()=>{
  const records=['web','ios'].flatMap(platform=>fixtures.flatMap(([fixture])=>['native','upstream','fork'].flatMap(mode=>Array.from({length:5},(_,i)=>({
    platform,fixture,mode,rep:i+1,completed:true,loadStart:1,loadEnd:1,errors:[],displayErrors:[],fixtureHash:'a'.repeat(64),
    sourceSha:mode==='native'?null:mode==='fork'?'48a6646bebc42b34baf7db6268c759079faefb5d':'42b61d8301b5400a67821bbbfcf99fa8b681dc37',seen:{host:true,fork:mode==='fork'},
    probe:{allRows:{sum:100},perCommit:{n:1},rows:{plugin:mode==='native'?0:1,native:mode==='native'?1:0},layoutShift:0},cdp:{delta:{TaskDuration:1},jsHeapUsedMB:100,nodes:1000}
  })))));
  assert.equal(records.length,330);assert.deepEqual(summarize(records).failures,[]);
  records[0].sourceSha='wrong';assert.ok(summarize(records).failures.some(line=>line.includes('identity mismatch')));
});
test('one display error makes the whole fixture-mode group diagnostic and missing samples remain failures',()=>{
  const records=Array.from({length:5},(_,i)=>({platform:'ios',fixture:'mixed-turn',mode:'upstream',rep:i+1,completed:true,loadStart:1,loadEnd:1,errors:[],displayErrors:i===2?['duplicate key']:[],probe:{allRows:{sum:100+i},perCommit:{n:1}}}));
  const result=summarize(records);assert.equal(result.groups[0].diagnosticOnly,true);assert.equal(result.groups[0].n,5);assert.ok(result.failures.length>0);assert.equal(result.groups[0].metrics.rows.median,102);
});
