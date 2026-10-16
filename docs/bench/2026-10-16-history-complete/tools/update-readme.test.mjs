import test from'node:test';import assert from'node:assert/strict';import{mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import{updateLongHistory}from'./update-readme.mjs';
test('complete follow-up publishes 36 numeric cells, names whole-session return, and preserves other sections',()=>{
 const repo=mkdtempSync(join(tmpdir(),'bc-complete-readme-'));try{
  const dir=join(repo,'docs/bench/2026-10-16-history-complete/raw');mkdirSync(dir,{recursive:true});mkdirSync(join(repo,'docs/perf/readme'),{recursive:true});
  const groups=[];for(const platform of ['web','ios'])for(const scenario of ['incident','multi-turn'])for(const mode of ['native','baseline','candidate'])for(const phase of ['open','older','sessionRemount'])groups.push({platform,scenario,mode,phase,n:mode==='candidate'?10:5,metrics:{rows:{median:100}}});
  const path=join(dir,'summary.json');writeFileSync(path,JSON.stringify({collected:80,failures:[],groups,executionRegimes:{legacyLoadGate:60,concurrentResourceGate:20}}));
  writeFileSync(join(repo,'README.md'),'Keep intro\n### Long-history loading\nold N/A\n### Where the time goes\nKeep features\n');writeFileSync(join(repo,'README-zh.md'),'保留开头\n### 长会话加载\n旧 N/A\n### 时间省在哪里\n保留功能\n');
  updateLongHistory(repo);const en=readFileSync(join(repo,'README.md'),'utf8'),zh=readFileSync(join(repo,'README-zh.md'),'utf8');
  assert.equal(en.split('\n').filter(x=>/^\| (810|832).*100\.0 \| 100\.0 \| 100\.0 \|$/.test(x)).length,12);assert.ok(!en.includes('N/A'));assert.ok(en.includes('Whole-session return row work'));assert.ok(en.includes('not a controlled speedup'));assert.ok(zh.includes('并发条件变更'));assert.ok(zh.includes('整体会话返回行渲染'));assert.ok(en.endsWith('Keep features\n'));
  updateLongHistory(repo);assert.equal(readFileSync(join(repo,'README.md'),'utf8'),en);
  groups.pop();writeFileSync(path,JSON.stringify({collected:80,failures:[],groups}));assert.throws(()=>updateLongHistory(repo),/complete valid/);
 }finally{rmSync(repo,{recursive:true,force:true});}
});
