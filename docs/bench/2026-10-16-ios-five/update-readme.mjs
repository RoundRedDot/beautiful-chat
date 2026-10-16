import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function updateDeployedFix(repo) {
  const base = `${repo}/docs/bench/2026-10-16-ios-five/parallel/campaign/raw`;
  const read = name => JSON.parse(readFileSync(`${base}/${name}.json`));
  const core = read('core-summary'), risk = read('risk-summary'), web = read('web-risk-summary');
  const source = read('final-source-verification'), cleanup = read('cleanup');
  if ([core, risk, web].some((s, i) => s.collected !== [100, 60, 60][i] || s.failures.length) || source.failures.length || cleanup.ownedPorts.listeners) throw Error('complete audited 220-run evidence and cleanup required');
  if (core.comparisons.length !== 5 || core.comparisons.some(c => c.native.n !== 5 || c.parent.n !== 5 || c.fixed.n !== 10 || ![c.native.median, c.parent.median, c.fixed.median].every(Number.isFinite))) throw Error('five complete finite core comparisons required');
  const names = {
    'diff-large': ['Large diff', '大 diff'], 'reads-20': ['20 reads', '读 20 个文件'],
    'reasoning-long-prose': ['Reasoning prose', '思考散文'], 'reasoning-long-sections': ['Reasoning sections', '思考分节'],
    'tool-expanded-streaming': ['Growing log (defaults)', '工具日志（默认）'],
    'mixed-turn': ['Mixed turn', '混合一轮'], 'history-100': ['History replay', '历史回放（夹具名）'],
    'shell-log-large': ['Large shell log', '大段终端'], 'table-streaming': ['Table streaming', '表格流式'],
    'codeblock-streaming': ['Code block streaming', '代码块流式'], 'markdown-long': ['Long reply', '长回复'],
  };
  const percent = value => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
  for (const lang of ['en', 'zh']) {
    const zh = lang === 'zh', font = 'Arial, PingFang SC, sans-serif';
    const title = zh ? '已部署修复：iOS 行渲染总耗时' : 'Deployed fix: total iOS row-render work';
    const max = Math.max(...core.comparisons.flatMap(c => [c.native.median, c.parent.median, c.fixed.median])) * 1.15;
    const svg = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 980 560" role="img"><title>${title}</title><rect width="980" height="560" rx="10" fill="white" stroke="#d8e1e5"/>`, `<text x="24" y="30" font-family="${font}" font-size="17">${title} (ms)</text>`, `<text x="24" y="52" font-family="${font}" font-size="12" fill="#61727a">7f01b2d → 722238d · iOS 18.6 development simulator · concurrent-max4</text>`];
    core.comparisons.forEach((c, i) => {
      const y = 82 + i * 84, unresolved = c.deltaNative >= 0.1;
      svg.push(`<text x="24" y="${y + 25}" font-family="${font}" font-size="13">${names[c.fixture][zh ? 1 : 0]}</text>`);
      [c.native.median, c.parent.median, c.fixed.median].forEach((value, j) => {
        const yy = y + j * 18, w = value / max * 470;
        svg.push(`<text x="193" y="${yy + 11}" font-family="${font}" font-size="11">${(zh ? ['原生', '修复前', '已部署修复'] : ['Native', 'Parent', 'Fixed'])[j]}</text><rect x="275" y="${yy}" width="${w.toFixed(1)}" height="12" fill="${j === 0 ? '#9fadb3' : j === 1 ? '#d99a2b' : unresolved ? '#b75545' : '#1e6b57'}"/><text x="${(280 + w).toFixed(1)}" y="${yy + 11}" font-family="${font}" font-size="11">${value.toFixed(1)}</text>`);
      });
      svg.push(`<text x="790" y="${y + 25}" font-family="${font}" font-size="12" fill="${unresolved ? '#a33e32' : '#384b53'}">${zh ? '对原生' : 'vs native'} ${percent(c.deltaNative)}</text><text x="790" y="${y + 44}" font-family="${font}" font-size="11" fill="#61727a">A/A &gt;10%: ${c.unstablePairs.length}/5</text>`);
    });
    svg.push(`<text x="24" y="526" font-family="${font}" font-size="12" fill="#a33e32">${zh ? '两项仍高于原生；8/25 对 A/A 波动超过 10%，不代表稳定提升或真机验收' : 'Two native gaps remain; 8/25 A/A pairs exceed 10%. No stable-speedup or device-acceptance claim.'}</text>`, `<text x="24" y="546" font-family="${font}" font-size="11" fill="#61727a">${zh ? '原生/修复前各 n=5，修复合并 n=10；行渲染总量不是帧率、首屏时间或整机 CPU' : 'Native/parent n=5, fixed pooled n=10. Row work is not frame rate, first-visible time or whole-app CPU.'}</text>`, '</svg>');
    writeFileSync(`${repo}/docs/perf/readme/ios-fixed.${lang}.svg`, svg.join('\n') + '\n');
    const lines = [zh ? '### 已部署 iOS 修复的独立验收' : '### Independent validation of the deployed iOS fix', '', zh ? '已部署 `722238d`，直接比较父版本 `7f01b2d`。独立批次共 **220 次**：核心 100、其余 iOS 回归 60、Web 回归 60；采集审计零失败、零排除。Mac Studio / iPhone 16 Pro / iOS 18.6 开发版模拟器，最多四组并行且实际重叠变化；与下方 `48a6646` 历史全矩阵及 `c4c9f3f` 长历史数字分开。' : 'Deployed `722238d`, compared directly with parent `7f01b2d`. This independent batch has **220 runs**: 100 core, 60 remaining iOS regressions and 60 Web regressions, with zero collection/audit failures or exclusions. Mac Studio, iPhone 16 Pro / iOS 18.6 development simulator, up to four groups with varying actual overlap. Keep it separate from the historical `48a6646` full matrix and `c4c9f3f` history runs below.', '', `![${title}](docs/perf/readme/ios-fixed.${lang}.svg)`, '', zh ? '| 场景 | 原生 ms | 修复前 ms | 已部署修复 ms | 对原生 | A/A 超过10% |' : '| Scenario | Native ms | Parent ms | Fixed ms | vs native | A/A over 10% |', '| --- | ---: | ---: | ---: | ---: | ---: |'];
    for (const c of core.comparisons) lines.push(`| ${names[c.fixture][zh ? 1 : 0]} | ${c.native.median.toFixed(1)} | ${c.parent.median.toFixed(1)} | ${c.fixed.median.toFixed(1)} | ${percent(c.deltaNative)} | ${c.unstablePairs.length}/5 |`);
    lines.push('', zh ? '**五项全部持平尚未达成。** 大 diff 和默认工具日志仍比原生高 15.45%、18.04%；其余三项本轮观测中位数与原生相差不足 10%。25 对 A/A 有 8 对波动超过 10%（最大 31.31%），不能将中位数下降表述为稳定提升已证实。其余 iOS/Web 回归未观测超过 10% 的新增中位数回退。' : '**All-five parity has not been achieved.** Large diff and the default growing log remain 15.45% and 18.04% above native; the other three observed medians are within 10%. Eight of 25 A/A pairs exceed 10% (maximum 31.31%), so lower medians do not prove stable improvements. The remaining iOS/Web checks observed no new median regression above 10%.');
    for (const [summary, label] of [[risk, zh ? '其余 iOS 回归（60 次）' : 'Remaining iOS regressions (60 runs)'], [web, zh ? 'Web 回归（60 次）' : 'Web regressions (60 runs)']]) {
      if (summary.comparisons.length !== 6 || summary.comparisons.some(c => c.parent.n !== 5 || c.fixed.n !== 5)) throw Error('six complete risk comparisons required');
      lines.push('', `#### ${label}`, '', zh ? '两版各 5 次，表中为行渲染总量的中位数。该段只比较 parent 与 fixed，不与旧批次的原生或 Beautiful Chat 数字拼接。' : 'Five runs per revision, showing median total row-render work. This phase compares parent and fixed only; do not splice in native or Beautiful Chat values from older rounds.', '', zh ? '| 场景 | 修复前 ms | 已部署修复 ms | 相对修复前 |' : '| Scenario | Parent ms | Fixed ms | vs parent |', '| --- | ---: | ---: | ---: |');
      for (const c of summary.comparisons) lines.push(`| ${names[c.fixture][zh ? 1 : 0]} | ${c.parent.median.toFixed(1)} | ${c.fixed.median.toFixed(1)} | ${percent(c.deltaParent)} |`);
    }
    lines.push('', zh ? '指标为宿主 Profiler `allRows.sum`，不是整机 CPU 或首屏时间；核心对照原生、修复前各 5 次，修复版合并 10 次；上述风险回归两版各 5 次。Web 的原始进程过滤漏掉绝对路径 Node runner，实际重叠已按区间另行重建；空进程列表不代表零并发。**这不是 iPhone 15 Pro 真机 Release 验收。**' : 'The metric is host Profiler `allRows.sum`, not whole-app CPU or first-visible time. Core native/parent have five runs each and fixed pools ten; risk phases have five per revision. The Web process filter missed absolute-path Node runners; actual overlap was reconstructed separately from intervals. Empty process lists do not mean no concurrency. **This is not iPhone 15 Pro Release acceptance.**', '', `[${zh ? '完整结果、范围、根因与原始证据' : 'Full results, ranges, diagnosis and evidence'}](docs/bench/2026-10-16-ios-five/parallel/README.md)`, '', zh ? '### 历史三模式全矩阵（48a6646）' : '### Historical three-mode full matrix (48a6646)', '');
    const file = `${repo}/${zh ? 'README-zh.md' : 'README.md'}`;
    let text = readFileSync(file, 'utf8');
    text = text.replace(/<!-- deployed-fix:start -->[\s\S]*?<!-- deployed-fix:end -->\n*/g, '');
    const heading = zh ? '## 性能对比' : '## Performance';
    const start = text.indexOf(heading), anchor = start + heading.length;
    if (start < 0) throw Error('README performance insertion point missing');
    lines[0] = zh ? '### 最新已部署版本：220 次独立验证' : '### Latest deployed revision: 220 independent runs';
    text = text.slice(0, anchor) + '\n\n<!-- deployed-fix:start -->\n' + lines.join('\n') + '\n<!-- deployed-fix:end -->\n\n' + text.slice(anchor).replace(/^\s*\n/, '');
    text = text.replace(zh ? /^- \*\*性能实测。\*\*.*$/m : /^- \*\*Measured performance\.\*\*.*$/m, zh ? '- **性能实测。** 已部署版本完成 220 次独立验证；未闭合差距、采样波动及历史数据版本见[性能对比](#性能对比)。' : '- **Measured performance.** The deployed revision has 220 independent validation runs; remaining gaps, sample variability and historical revisions are disclosed in [Performance](#performance).');
    text = text.replace(/<!-- historical-memory:start -->[\s\S]*?<!-- historical-memory:end -->\n*/g, '');
    const memory = zh ? '## 内存对比\n\n' : '## Memory comparison\n\n';
    const note = zh ? '**历史内存基线：`48a6646`。** 最新 `722238d` 的 Web 风险回归未重新测量 JS 堆，不把下表当作该部署版本的内存验收。' : '**Historical memory baseline: `48a6646`.** The latest `722238d` Web regression phase did not remeasure JS heap; this table is not memory acceptance for that deployed revision.';
    text = text.replace(memory, `${memory}<!-- historical-memory:start -->\n${note}\n<!-- historical-memory:end -->\n\n`);
    writeFileSync(file, text);
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) updateDeployedFix(resolve(process.argv[2] ?? '.'));
