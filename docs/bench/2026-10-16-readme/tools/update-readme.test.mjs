import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

test('README generation keeps valid Web results despite native display errors and labels missing phases',()=>{
  const bench=resolve(dirname(fileURLToPath(import.meta.url)),'..'),repo=mkdtempSync(join(tmpdir(),'bc-readme-test-'));
  try{
    mkdirSync(join(repo,'docs/bench'),{recursive:true});mkdirSync(join(repo,'docs/perf/readme'),{recursive:true});
    symlinkSync(bench,join(repo,'docs/bench/2026-10-16-readme'),'dir');
    for(const [file,performance,explanation,memory,features]of [
      ['README.md','Performance','Where the time goes','Memory comparison','Features'],
      ['README-zh.md','性能对比','时间省在哪里','内存对比','功能'],
    ])writeFileSync(join(repo,file),`## ${performance}\nold\n### ${explanation}\nold\n---\n## ${memory}\nold\n## ${features}\nPreserve this section.\n`);
    const generate=()=>execFileSync(process.execPath,[join(bench,'tools/update-readme.mjs'),repo]);generate();
    const english=readFileSync(join(repo,'README.md'),'utf8'),chinese=readFileSync(join(repo,'README-zh.md'),'utf8');
    assert.ok(english.includes('| 810 entries / 1 turn — Cold-open row work | 87.8 | 2,030.5 | 43.9 |'));
    assert.ok(chinese.includes('| 832 条 / 12 轮 — 首次上翻行渲染 | 23.2 | 540.1 | 13.8 |'));
    assert.ok(english.includes('| 810 entries / 1 turn — Cold-open row work | 147.4 | Excluded: display errors | 116.9 |'));
    assert.ok(chinese.includes('| 810 条 / 1 轮 — 长回复块重新挂载行渲染 | 不适用 | 不适用 | 不适用 |'));
    const chart=readFileSync(join(repo,'docs/perf/readme/history-load.en.svg'),'utf8');
    assert.ok(chart.includes('2030.5'));assert.ok(chart.includes('2079.1'));assert.ok(chart.includes('Excluded'));
    assert.ok(english.endsWith('## Features\nPreserve this section.\n'));generate();
    assert.equal(readFileSync(join(repo,'README.md'),'utf8'),english);
  }finally{rmSync(repo,{recursive:true,force:true});}
});
