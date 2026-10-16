import test from'node:test';import assert from'node:assert/strict';import{summarize,fixtureHash,sourceShas}from'./report.mjs';
import{mkdtempSync,mkdirSync,writeFileSync,readFileSync,symlinkSync,rmSync}from'node:fs';import{join}from'node:path';import{tmpdir}from'node:os';import{fileURLToPath}from'node:url';import{spawnSync}from'node:child_process';
function matrix(){const rows=[];for(const platform of ['web','ios'])for(const scenario of ['incident','multi-turn'])for(const mode of ['candidate','baseline','native'])for(let rep=1;rep<=5;rep++)for(let pair=1;pair<=(mode==='candidate'?2:1);pair++){
  const phase=()=>({host:{allRows:{sum:100}},viewport:{history:[{id:'unique'}]},readyMs:200,maxTimerGapMs:20,maxRafGapMs:21,remounted:true,revealedOlder:true});
  rows.push({platform,scenario,mode,label:`${platform}/${scenario}/${mode}/${rep}-${pair}`,rep:mode==='candidate'?`${rep}-${pair}`:rep,sourceSha:sourceShas[mode],completed:true,agentLifecycle:{archived:false,archivedAt:null},loadStart:1,loadEnd:2,displayErrors:[],sessionPreparation:{unmounted:true},copyGate:{exactMatch:true},returnCopyGate:{exactMatch:true},phases:{open:phase(),older:phase(),sessionRemount:phase()},seed:{fixtureSha256:fixtureHash,entries:scenario==='incident'?810:832,footers:scenario==='incident'?1:12,longReplyChars:59427,kinds:{user_message:scenario==='incident'?12:23,assistant_message:scenario==='incident'?140:151,reasoning:260,tool_call:398},pages:[{returned:808,hasOlder:true},{returned:scenario==='incident'?2:24,hasOlder:false}]}});
}return rows;}
test('all 36 cells and five A/A pairs per phase require the complete valid matrix',()=>{
  const good=summarize(matrix());assert.deepEqual(good.failures,[]);assert.equal(good.collected,80);assert.equal(good.groups.length,36);assert.ok(good.aa.every(row=>row.pairs.length===5));
  const incomplete=matrix();incomplete.pop();assert.ok(summarize(incomplete).failures.length);
});
test('display errors, simulated unmount and stale fixture identities cannot become numeric acceptance',()=>{
  for(const mutate of [rows=>rows[0].sessionPreparation.unmounted=false,rows=>rows[0].seed.fixtureSha256='old',rows=>rows[0].phases.sessionRemount.viewport.history.push({id:'unique'}),rows=>rows[0].returnCopyGate.exactMatch=false]){const rows=matrix();mutate(rows);assert.ok(summarize(rows).failures.length);}
  assert.ok(summarize(matrix(),['duplicate key']).failures.length);
});
test('concurrent resource admission must be proven and is counted separately',()=>{
 const rows=matrix();rows[0].executionRegime='concurrent-max4';rows[0].loadStart=30;rows[0].resourcesStart={cpuIdlePct:90,memoryFreePct:40,pressureLevel:1,load:[30,60,30]};rows[0].resourcesEnd=rows[0].resourcesStart;
 const summary=summarize(rows);assert.deepEqual(summary.failures,[]);assert.equal(summary.groups[0].executionRegimes.concurrentResourceGate,1);
 rows[0].resourcesStart={...rows[0].resourcesStart,pressureLevel:2};assert.ok(summarize(rows).failures.length);
});
test('report CLI invoked through a symlink writes and audits the complete matrix',()=>{
 const root=mkdtempSync(join(tmpdir(),'bc-report-cli-'));try{
  for(const platform of ['web','ios'])mkdirSync(join(root,'raw',platform),{recursive:true});
  for(const row of matrix())writeFileSync(join(root,'raw',row.platform,`${row.scenario}-${row.mode}-${row.rep}.json`),JSON.stringify(row));
  writeFileSync(join(root,'raw/metro-errors.json'),JSON.stringify({lines:[]}));
  const entry=join(root,'report-link.mjs');symlinkSync(fileURLToPath(new URL('./report.mjs',import.meta.url)),entry);
  const result=spawnSync(process.execPath,[entry,root],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  const summary=JSON.parse(readFileSync(join(root,'raw/summary.json'),'utf8'));assert.equal(summary.collected,80);assert.deepEqual(summary.failures,[]);assert.match(result.stdout,/"collected":80/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
