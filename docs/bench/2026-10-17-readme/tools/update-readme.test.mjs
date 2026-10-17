import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {updateReadme} from './update-readme.mjs';
import {historyCharts} from './history-charts.mjs';
import {fixtures} from './report.mjs';

const SHA='b9dfae6e31453b962d90f7d3c7ca972c0e523cb3';
function campaign(){
  const root=mkdtempSync(join(tmpdir(),'readme-current-'));
  const write=(path,value)=>{mkdirSync(join(root,path,'..'),{recursive:true});writeFileSync(join(root,path),typeof value==='string'?value:JSON.stringify(value));};
  const groups=[],aa=[];
  for(const platform of ['web','ios'])for(const [fixture]of fixtures){
    for(const mode of ['native','upstream','fork','aa','parent']){
      const value=mode==='fork'?80:100;
      groups.push({platform,fixture,mode,n:5,metrics:Object.fromEntries(['rows','task','heap','cls'].map(metric=>[metric,{median:metric==='cls'?0.000001:value}]))});
    }
    aa.push({platform,fixture,pairs:Array.from({length:5},(_,rep)=>({rep})),over10:2,maxAbsolutePercent:15});
  }
  const historyGroups=[];
  for(const platform of ['web','ios'])for(const scenario of ['incident','multi-turn'])for(const mode of ['candidate','baseline','native'])for(const phase of ['open','older','sessionRemount'])historyGroups.push({platform,scenario,mode,phase,n:mode==='candidate'?10:5,metrics:{rows:{median:123.4}}});
  const replay={collected:550,failures:[],groups,aa};
  write('docs/bench/2026-10-17-readme/parallel-v2/raw/summary.json',replay);
  write('docs/bench/2026-10-17-readme/parallel-v2/history/raw/summary.json',{collected:80,failures:[],groups:historyGroups});
  write('docs/bench/2026-10-17-readme/parallel-v2/raw/source-audit.json',[{name:'candidate',sha:SHA,mismatches:[]},{name:'parent',mismatches:[]},{name:'upstream',mismatches:[]}]);
  write('docs/images/screenshots.json',{sourceSha:SHA,capturedAt:'2026-10-17',assets:Array(52).fill({})});
  write('README.md','intro\n- **Measured performance.** old\n## Performance\nold performance\n### Where the time goes\nPreserve explanation.\n## Memory comparison\nold memory\n## Features\nScreenshots refreshed on old.\nPreserve features.\n');
  write('README-zh.md','前言\n- **性能实测。** 旧数据\n## 性能对比\n旧数据\n### 时间省在哪里\n保留说明。\n## 内存对比\n旧数据\n## 功能\n截图于 旧日期\n保留功能。\n');
  return {root,write,replay};
}
test('same-round publication is bilingual, preserves unrelated sections and is idempotent',()=>{
  const {root}=campaign();try{
    updateReadme(root);const english=readFileSync(join(root,'README.md'),'utf8'),chinese=readFileSync(join(root,'README-zh.md'),'utf8');
    assert.match(english,/630 fresh samples/);assert.match(chinese,/630 次同轮采样/);
    assert.match(english,/\| Code block streaming \| 100\.0 \| 100\.0 \| \*\*80\.0\*\*/);
    assert.match(english,/\| Code block streaming \| 100\.0 \| 80\.0 \| -20\.00% \| 2\/5 \| 15\.00% \|/);
    assert.match(chinese,/\| 810 条 \/ 1 轮 — 冷打开行渲染 \| 123\.4 \| 123\.4 \| 123\.4 \|/);
    assert.ok(english.includes('Preserve explanation.'));assert.ok(english.endsWith('Preserve features.\n'));
    assert.match(chinese,/截图于 2026-10-17 基于 `b9dfae6`/);
    updateReadme(root);assert.equal(readFileSync(join(root,'README.md'),'utf8'),english);
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('incomplete or failed evidence cannot replace either README',()=>{
  for(const mutate of [s=>s.collected--,s=>s.failures.push('bad source'),s=>s.aa[0].pairs.pop()]){
    const {root,write,replay}=campaign();try{
      const before=readFileSync(join(root,'README.md'),'utf8');mutate(replay);write('docs/bench/2026-10-17-readme/parallel-v2/raw/summary.json',replay);
      assert.throws(()=>updateReadme(root),/complete audited/);assert.equal(readFileSync(join(root,'README.md'),'utf8'),before);
    }finally{rmSync(root,{recursive:true,force:true});}
  }
});
test('a display-error group stays N/A in all three-mode comparisons',()=>{
  const {root,write,replay}=campaign();try{
    replay.groups.find(g=>g.platform==='web'&&g.fixture==='diff-large'&&g.mode==='upstream').diagnosticOnly=true;
    replay.groups.find(g=>g.platform==='ios'&&g.fixture==='diff-large'&&g.mode==='fork').diagnosticOnly=true;
    replay.aa.find(g=>g.platform==='ios'&&g.fixture==='diff-large').pairs[0].diagnosticOnly=true;
    const historyPath='docs/bench/2026-10-17-readme/parallel-v2/history/raw/summary.json',history=JSON.parse(readFileSync(join(root,historyPath)));
    history.failures=['retained IPC timeout'];history.structuralFailures=[];
    for(const group of history.groups.filter(g=>g.platform==='ios'&&g.scenario==='incident'&&g.mode==='candidate')){group.diagnosticOnly=true;group.metrics.rows=null;group.n=9;group.attempts=10;}
    write(historyPath,history);
    write('docs/bench/2026-10-17-readme/parallel-v2/raw/summary.json',replay);updateReadme(root);
    assert.match(readFileSync(join(root,'README.md'),'utf8'),/\| Large diff \| 100\.0 \| N\/A \| \*\*80\.0\*\*/);
    assert.match(readFileSync(join(root,'README.md'),'utf8'),/\| Large diff \| 100\.0 \| N\/A \| N\/A \| N\/A \| N\/A \|/);
    assert.match(readFileSync(join(root,'README.md'),'utf8'),/\| 810 entries \/ 1 turn — Cold-open row work \| 123\.4 \| 123\.4 \| N\/A \|/);
    mkdirSync(join(root,'docs/perf/readme'),{recursive:true});historyCharts(root);
    assert.match(readFileSync(join(root,'docs/perf/readme/history-complete-open.en.svg'),'utf8'),/>N\/A</);
  }finally{rmSync(root,{recursive:true,force:true});}
});
