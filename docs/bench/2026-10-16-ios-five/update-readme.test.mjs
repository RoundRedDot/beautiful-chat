import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { updateDeployedFix } from './update-readme.mjs';

test('deployed report retains unresolved results and refuses incomplete evidence before publishing', () => {
  const repo = mkdtempSync(join(tmpdir(), 'bc-deployed-readme-'));
  try {
    const raw = join(repo, 'docs/bench/2026-10-16-ios-five/parallel/campaign/raw');
    mkdirSync(raw, { recursive: true });
    mkdirSync(join(repo, 'docs/perf/readme'), { recursive: true });
    for (const file of ['core-summary', 'risk-summary', 'web-risk-summary', 'final-source-verification', 'cleanup']) copyFileSync(fileURLToPath(new URL(`./parallel/campaign/raw/${file}.json`, import.meta.url)), join(raw, file + '.json'));
    writeFileSync(join(repo, 'README.md'), 'Intro\n## Performance\nHistorical scope\n### Web\nKeep history\n');
    writeFileSync(join(repo, 'README-zh.md'), '开头\n## 性能对比\n历史范围\n### Web\n保留历史\n');
    updateDeployedFix(repo);
    const first = readFileSync(join(repo, 'README.md'), 'utf8');
    assert.match(first, /All-five parity has not been achieved/);
    assert.match(first, /15\.45%/);
    assert.match(first, /18\.04%/);
    assert.match(first, /Eight of 25/);
    assert.ok(first.indexOf('220 independent runs') < first.indexOf('Historical scope'));
    assert.match(first, /Remaining iOS regressions \(60 runs\)/);
    assert.match(first, /Web regressions \(60 runs\)/);
    assert.match(first, /17\.5 \| 13\.7/);
    assert.ok(first.endsWith('Keep history\n'));
    assert.match(readFileSync(join(repo, 'docs/perf/readme/ios-fixed.en.svg'), 'utf8'), /Two native gaps remain/);
    updateDeployedFix(repo);
    assert.equal(readFileSync(join(repo, 'README.md'), 'utf8'), first);
    const web = JSON.parse(readFileSync(join(raw, 'web-risk-summary.json'), 'utf8'));
    web.collected = 59;
    writeFileSync(join(raw, 'web-risk-summary.json'), JSON.stringify(web));
    assert.throws(() => updateDeployedFix(repo), /complete audited/);
    assert.equal(readFileSync(join(repo, 'README.md'), 'utf8'), first);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});
