import{readFileSync,writeFileSync,existsSync,readdirSync}from'node:fs';
const root=process.argv[2];if(!root)throw Error('campaign root required');
const lines=['# iOS 五项修复并发验证','','执行制度：`concurrent-max4`，表示最多四路，不表示始终四路同时执行。本批是共享硬件的并发观测，与旧串行数据分开。直接父版本 `7f01b2d95c87cb6879adf701571de3778a167060`；已部署修复 `722238de2fcc1ade46d542a7a540868932d9dc89`。','','指标为同一宿主 Profiler 的 `allRows.sum`，单位 ms；判定使用未舍入中位数，相差 <10% 记持平，iOS 不使用 Web 的小于 0.5 秒条款。表中显示值舍入到三位，完整精度、每个样本和每 lane 分布保留在 `raw/*-summary.json`。范围为全部观测的最小值至最大值，不是置信区间。'];
for(const phase of ['core','risk','web-risk']){
 const file=`${root}/raw/${phase}-summary.json`;if(!existsSync(file)){lines.push('',`## ${phase}`,'','待完成。');continue;}
 const summary=JSON.parse(readFileSync(file));lines.push('',`## ${phase}`,'',`采集 ${summary.collected}/${summary.expected}；审计失败 ${summary.failures.length}。`,'','| 夹具 | Native 中位数（范围） | Parent 中位数（范围） | Fixed 中位数（范围） | 相对 parent | 相对 native | A/A 最大差 ms | A/A 超过10%的对数 |','| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
 const cell=s=>s?`${s.median.toFixed(3)} (${s.min.toFixed(3)}–${s.max.toFixed(3)})`:'未对照';
 const verdict={even:'持平',lower:'较低',higher:'仍较高'};
 for(const r of summary.comparisons)lines.push(`| ${r.fixture} | ${cell(r.native)} | ${cell(r.parent)} | ${cell(r.fixed)} | ${(r.deltaParent*100).toFixed(2)}% | ${r.deltaNative===null?'未对照':`${(r.deltaNative*100).toFixed(2)}%（${verdict[r.nativeVerdict]}）`} | ${r.maxAaMs===null?'未配对':r.maxAaMs.toFixed(3)} | ${r.unstablePairs.length} |`);
 if(summary.failures.length)lines.push('','审计失败：',...summary.failures.map(f=>`- ${f}`));
}
const rows=[2,3,4].flatMap(l=>['core','risk','web-risk'].flatMap(phase=>{const dir=`${root}/lane${l}/raw/${phase}`;return existsSync(dir)?readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(readFileSync(`${dir}/${f}`))):[];}));
if(rows.length){const starts=rows.filter(r=>r.resourceStart).map(r=>r.resourceStart),ends=rows.filter(r=>r.resourceEnd).map(r=>r.resourceEnd);lines.push('','## 资源与边界','',`正式记录保留 ${rows.length} 条；开始时 CPU idle 范围 ${Math.min(...starts.map(r=>r.cpuIdlePct)).toFixed(2)}–${Math.max(...starts.map(r=>r.cpuIdlePct)).toFixed(2)}%；1 分钟 load 范围 ${Math.min(...starts.map(r=>r.load[0])).toFixed(2)}–${Math.max(...starts.map(r=>r.load[0])).toFixed(2)}；结束时资源越界 ${ends.filter(r=>!r.admitted).length} 条。每条原始记录保留内存压力、进程、activity 与起止时间。`);}
lines.push('','group1 在 07:11 UTC 前完成，其所有者在 07:12:05 UTC 清理结束；旧 activity 可残留 idle，实际进程记录用于判断重叠。后续只有本任务三组运行时仍保留 `concurrent-max4` 制度标签。','','同 lane A/A 超过 10% 作为竞争或噪声标记，完整配对与分 lane 数据见原始汇总；不能据此声称串行性能或 iPhone 15 Pro Release 已验收。`tool-expanded-streaming` 使用默认展开状态，未执行展开动作；流中展开与最新内容复制 smoke 单列为功能验证。`history-100` 是夹具名，不代表 100 个真实 provider turn。');
writeFileSync(`${root}/RESULTS.md`,lines.join('\n')+'\n');
