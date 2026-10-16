// Regenerate the bilingual public comparison from the audited, same-round samples.
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {fixtures,median,classify} from './report.mjs';
const repo=resolve(process.argv[2]??'.'),bench=`${repo}/docs/bench/2026-10-16-readme`,raw=`${bench}/raw`;
const summary=JSON.parse(readFileSync(`${raw}/summary.json`));
if(summary.failures.length||summary.collected!==330)throw Error('complete audited replay matrix required');
const get=(platform,fixture,mode,metric)=>{
  const row=summary.groups.find(row=>row.platform===platform&&row.fixture===fixture&&row.mode===mode);
  if(!row||row.n!==5)throw Error('missing comparison group');return row.diagnosticOnly?null:row.metrics[metric].median;
};
const num=(value,digits=1)=>value===null?'N/A':value.toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});
const delta=(base,current,lang,floor=0)=>{
  if(base===null||current===null)return 'N/A';const result=classify(base,current,floor);
  if(result==='even')return lang==='zh'?'持平':'even';
  if(base===0)return `<img src="docs/perf/readme/arrow-down.svg" width="11" height="13" alt="worse">&ensp;${lang==='zh'?'从 0 增加':'up from 0'}`;
  return `<img src="docs/perf/readme/arrow-${result==='better'?'up':'down'}.svg" width="11" height="13" alt="${result}">&ensp;${Math.round(Math.abs((current-base)/base)*100)}%`;
};
function table(platform,metric,lang,{difference=false,digits=1}={}){
  const zh=lang==='zh',lines=[zh?'| 场景 | 不开插件 | Beautiful Chat | Better Paseo | 对比不开插件 | 对比 Beautiful Chat |':'| Scenario | No plugin | Beautiful Chat | Better Paseo | vs no plugin | vs Beautiful Chat |','| --- | ---: | ---: | ---: | :--- | :--- |'];
  for(const [fixture,en,cn]of fixtures){
    const [native,upstream,fork]=['native','upstream','fork'].map(mode=>get(platform,fixture,mode,metric));
    const signed=base=>base===null||fork===null?'N/A':`${fork-base>=0?'+':''}${num(fork-base)}`;
    lines.push(`| ${zh?cn:en} | ${num(native,digits)} | ${num(upstream,digits)} | **${num(fork,digits)}** | ${difference?signed(native):delta(native,fork,lang)} | ${difference?signed(upstream):delta(upstream,fork,lang)} |`);
  }return lines.join('\n');
}
function counts(platform,metric,base,floor=0){const tally={better:0,even:0,worse:0,unavailable:0};for(const [fixture]of fixtures){const a=get(platform,fixture,base,metric),b=get(platform,fixture,'fork',metric);if(a===null||b===null)tally.unavailable++;else tally[classify(a,b,floor)]++;}return tally;}
const taskNative=counts('web','task','native',.5),taskUpstream=counts('web','task','upstream',.5);
const rowNative=counts('web','rows','native'),iosNative=counts('ios','rows','native'),iosUpstream=counts('ios','rows','upstream');
const describe=(count,zh)=>zh?`${count.better} 项更低、${count.even} 项持平、${count.worse} 项更高${count.unavailable?`、${count.unavailable} 项不可比较`:''}`:`${count.better} lower, ${count.even} even and ${count.worse} higher${count.unavailable?`, ${count.unavailable} unavailable`:''}`;
const readJson=file=>{const bytes=readFileSync(file);return JSON.parse(file.endsWith('.gz')?gunzipSync(bytes):bytes);};
const historyDir=`${bench}/history/raw`;
const history={ios:readdirSync(historyDir).filter(file=>/^(incident|multi-turn)-(candidate|native|baseline)-.*\.json(?:\.gz)?$/.test(file)).map(file=>readJson(`${historyDir}/${file}`)),
  web:readdirSync(`${historyDir}/web`).filter(file=>/^(incident|multi-turn)-.*\.json(?:\.gz)?$/.test(file)).map(file=>readJson(`${historyDir}/web/${file}`))};
const historyAudit=readJson(`${historyDir}/audit.json`);
if(historyAudit.failures.length)throw Error('native history audit failed');
const webHistoryAudit=readJson(`${historyDir}/web-summary.json`);
if(webHistoryAudit.failures.length||webHistoryAudit.collected!==40)throw Error('Web history audit failed');
const continuous=readJson(`${historyDir}/full-scroll.json${readdirSync(historyDir).includes('full-scroll.json')?'':'.gz'}`);
if(!continuous.completed||continuous.failures.length||!continuous.copyGate?.exactMatch)throw Error('continuous native scroll/copy gate failed');
for(const platform of ['web','ios'])for(const scenario of ['incident','multi-turn'])for(const mode of ['candidate','baseline','native']){
  const rows=history[platform].filter(row=>row.scenario===scenario&&row.mode===mode);
  if(rows.length!==(mode==='candidate'?10:5)||rows.some(row=>!row.completed||row.error))throw Error(`history group incomplete: ${platform}/${scenario}/${mode}`);
}
const baselineErrorLines=readJson(`${historyDir}/metro-errors.json`).lines.length;
const baselineIosInvalid=baselineErrorLines>0;
const historyExcluded=(platform,mode,rows)=>(platform==='ios'&&mode==='baseline'&&baselineIosInvalid)||rows.some(row=>row.displayErrors?.length);
const hget=(platform,scenario,mode,phase,metric)=>{
  const rows=history[platform].filter(row=>row.scenario===scenario&&row.mode===mode);
  if(historyExcluded(platform,mode,rows))return null;
  if(rows.some(row=>!row.phases[phase]))return null;
  return median(rows.map(row=>metric(row.phases[phase])));
};
function historyTables(lang){
  const zh=lang==='zh',lines=[];
  for(const platform of ['web','ios']){
    lines.push(`#### ${platform==='web'?'Web':'iOS'}`, '',zh?'| 场景 / 阶段 | 不开插件 | Beautiful Chat | Better Paseo |':'| Scenario / phase | No plugin | Beautiful Chat | Better Paseo |','| --- | ---: | ---: | ---: |');
    for(const scenario of ['incident','multi-turn'])for(const [phase,en,cn]of [['open','Cold-open row work','冷打开行渲染'],['older','First older reveal row work','首次上翻行渲染'],['remount','Long-reply block remount row work','长回复块重新挂载行渲染']]){
      const cells=['native','baseline','candidate'].map(mode=>{
        const rows=history[platform].filter(row=>row.scenario===scenario&&row.mode===mode);
        if(historyExcluded(platform,mode,rows))return zh?'因显示错误排除':'Excluded: display errors';
        const value=hget(platform,scenario,mode,phase,value=>value.host.allRows.sum);
        return value===null?(zh?'不适用':'Not applicable'):num(value);
      });
      lines.push(`| ${scenario==='incident'?(zh?'810 条 / 1 轮':'810 entries / 1 turn'):(zh?'832 条 / 12 轮':'832 entries / 12 turns')} — ${zh?cn:en} | ${cells.join(' | ')} |`);
    }
    lines.push('',zh?'单位为毫秒。“因显示错误排除”表示数据仅供诊断；“不适用”表示没有发生对应的独立块卸载和重新挂载，不表示零成本。':'Values are milliseconds. “Excluded: display errors” means diagnostic data only. “Not applicable” means no corresponding independent block unload/remount occurred; it does not mean zero work.','');
  }return lines.join('\n');
}
for(const lang of ['en','zh']){
  const zh=lang==='zh',escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;'),font='Arial, PingFang SC, sans-serif';
  const groups=['web','ios'].flatMap(platform=>['incident','multi-turn'].map(scenario=>({platform,scenario,values:['native','baseline','candidate'].map(mode=>hget(platform,scenario,mode,'open',value=>value.host.allRows.sum))})));
  const maximum=Math.max(100,...groups.flatMap(row=>row.values.filter(value=>value!==null)))*1.15;
  const svg=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 410" role="img"><title>${zh?'长历史冷打开行渲染总量':'Cold-open long-history row-render work'}</title><rect width="900" height="410" rx="10" fill="white" stroke="#d8e1e5"/>`,
    `<text x="24" y="30" font-family="${font}" font-size="16">${zh?'长历史冷打开：行渲染总量（毫秒，越低越好）':'Cold-open long history: total row-render work (ms, lower is better)'}</text>`,
    `<text x="24" y="52" font-family="${font}" font-size="12" fill="#61727a">2026-10-16 · ${zh?'Web + iOS 18.6 开发版模拟器；iOS Beautiful Chat 因显示错误排除':'Web + iOS 18.6 development simulator; iOS Beautiful Chat excluded: display errors'}</text>`];
  const names=zh?['不开插件','Beautiful Chat','Better Paseo']:['No plugin','Beautiful Chat','Better Paseo'],colors=['#9fadb3','#d99a2b','#1e6b57'];
  groups.forEach((row,index)=>{
    const y=88+index*78,label=`${row.platform==='ios'?'iOS':'Web'} ${row.scenario==='incident'?'810 / 1':'832 / 12'}`;
    svg.push(`<text x="24" y="${y+24}" font-family="${font}" font-size="13">${label}</text>`);
    row.values.forEach((value,slot)=>{const yy=y+slot*18,w=value===null?0:value/maximum*510;
      svg.push(`<text x="155" y="${yy+11}" font-family="${font}" font-size="11">${escape(names[slot])}</text>`);
      if(value!==null)svg.push(`<rect x="260" y="${yy}" width="${w.toFixed(1)}" height="12" fill="${colors[slot]}"/>`);
      svg.push(`<text x="${(265+w).toFixed(1)}" y="${yy+11}" font-family="${font}" font-size="11">${value===null?(zh?'错误排除':'Excluded'):value.toFixed(1)}</text>`);
    });
  });svg.push('</svg>');writeFileSync(`${repo}/docs/perf/readme/history-load.${lang}.svg`,svg.join('\n')+'\n');
}
const longText={en:`### Long-history loading

This separate, newly seeded comparison loads existing history; it is not another streaming replay. The incident-shaped fixture has **810 entries, one actual provider turn and a 59,427-character reply**. A second fixture adds real turn boundaries: **832 entries / 12 turns**. Each platform has five candidate A/A pairs and five runs per control and scenario. These are development-simulator and browser measurements, not iPhone 15 Pro Release acceptance.

![Cold-open long-history row-render work](docs/perf/readme/history-load.en.svg)

${historyTables('en')}

${baselineIosInvalid?`Native Beautiful Chat emitted ${baselineErrorLines} React duplicate-key errors, making all 10 native baseline samples diagnostic. Only the iOS group is excluded; the error-free Web group is included in the tables and charts.`:"No baseline display errors were recorded."} Web retains the long reply in its recent mounted segment, so this fixture has no Web block-remount measurement. Loading older content and remounting expose different row sets across renderers, so totals are workload-specific. The detailed report also records JS-ready proxies, timer/rAF gaps, requested/returned page sizes, A/A spread and functional copy/scroll gates. A ready proxy is not a proven first-usable viewport or native commit time.

[Full comparison and limitations](docs/bench/2026-10-16-readme/README.md).
`,zh:`### 长会话加载

这组测试每次重新准备已有历史，测加载而不是流式吞吐。故障形状夹具包含 **810 条记录、1 个实际 provider turn、59,427 字符的长回复**；另有真正增加轮次边界的 **832 条 / 12 轮**场景。每个平台、每个场景做 5 对当前版本 A/A，以及各对照模式 5 次。结果来自浏览器及开发版模拟器，不代表 iPhone 15 Pro 真机 Release 验收。

![长历史冷打开行渲染总量](docs/perf/readme/history-load.zh.svg)

${historyTables('zh')}

${baselineIosInvalid?`iOS Beautiful Chat 出现 ${baselineErrorLines} 条 React 重复 key 错误，其 10 次长历史样本仅作诊断。仅排除 iOS 组；没有显示错误的 Web 组正常列入表格和图表。`:"本轮未记录基线显示错误。"} Web 将这条长回复保留在最近的挂载分段中，所以该夹具没有 Web 块重新挂载测量。各模式在上翻和重新挂载时暴露的行集合不同，累计时间必须结合工作量看。详细报告另列 JS 就绪代理、timer/rAF 间隙、请求与实际返回的页大小、A/A 波动，以及复制和滚动功能检查。就绪代理不等于已证明的首个可用视口或 native commit 时间。

[完整对比与限制](docs/bench/2026-10-16-readme/README.md)。
`};
const environment=readJson(`${raw}/environment.json`),webAsset=environment.webAssets[0].sha256.slice(0,16);
for(const lang of ['en','zh']){
  const zh=lang==='zh',file=`${repo}/${zh?'README-zh.md':'README.md'}`;let text=readFileSync(file,'utf8');
  const perf=zh?`## 性能对比

对比 **不开插件**（Paseo 0.11.2）、**Beautiful Chat** \`42b61d8\` 和 **Better Paseo** \`48a6646\`。2026-10-16 在 Mac Studio（Apple M5 Max、18 核、64 GB、macOS 27.0.1）重测：Web 和 iOS 各 11 个场景 × 3 种模式 × 5 次，共 330 次，均轮换顺序、串行执行，每格取中位数。只比较本轮数据；显示错误组标为 N/A。原始数据、范围和有效性检查见[本轮报告](docs/bench/2026-10-16-readme/README.md)。

![Web 主线程时间](docs/perf/readme/web-cpu.zh.svg)

图是整段回放的主线程 Task 时间。对比不开插件：${describe(taskNative,true)}；对比 Beautiful Chat：${describe(taskUpstream,true)}。相差不到 10%，或 Web 整段 Task 两边均低于 0.5 秒，记为持平。

下表为整段回放的行渲染总量（allRows.sum，毫秒），边界是同一宿主 React.Profiler；单次提交 p95 不代表总工作量。对比不开插件：${describe(rowNative,true)}。

${table('web','rows',lang)}

### 流式布局偏移

累计布局偏移（CLS，越低越好），来自同一批 Web 回放；不套用 Task 的 0.5 秒规则。保留 6 位小数，避免把微小基数显示为零；基数很小时，百分比会放大微小的绝对差异。

${table('web','cls',lang,{digits:6})}

### iOS

![iOS 行渲染总量](docs/perf/readme/ios-commit.zh.svg)

iPhone 16 Pro / iOS 18.6 模拟器，Paseo 0.11.2 开发版 Hermes，每次运行前冷启动；只用一台测试模拟器，Web 与 iOS 测量不重叠。下表为行渲染总量（毫秒），相差不到 10% 记为持平。对比不开插件：${describe(iosNative,true)}；对比 Beautiful Chat：${describe(iosUpstream,true)}。这些数据不代表真机帧率或 Release 性能。

${table('ios','rows',lang)}

绿色 ⬆ 表示更低，红色 ⬇ 表示更高；百分比按舍入前的中位数计算。\`history-100\` 是夹具名，并不表示 100 个实际 provider turn，此处统一称“历史回放”。

**测量方法。** 固定宿主 \`759532509\`，同一行探针比较原生和插件。Web 为重新导出的生产 profiling 构建（主 JS SHA256 前缀 \`${webAsset}\`），Chrome 155.0.8059.40、1280×900；CDP 读取主线程时间，强制 GC 后读 JS 堆和 DOM 节点。iOS 为开发版模拟器，非 Release。使用私有 daemon 6871，每次核对模式；默认功能配置，当前插件仅开启测量计数。脚本、宿主补丁及源码校验均在[本轮报告](docs/bench/2026-10-16-readme/README.md)，图表由 \`node docs/perf/readme-charts.mjs\` 生成。

${longText.zh}
`:`## Performance

Three configurations: **no plugin** (Paseo 0.11.2), **Beautiful Chat** \`42b61d8\`, and **Better Paseo** \`48a6646\`. Rerun on 2026-10-16 on Mac Studio (Apple M5 Max, 18 cores, 64 GB, macOS 27.0.1): 11 scenarios × 3 modes × 5 runs on each of Web and iOS, **330 replay runs**. Modes rotate and measurements run serially; every cell is a median. Only this round is comparable. Groups with display errors are N/A. [Raw data, ranges and validation](docs/bench/2026-10-16-readme/README.md).

![Web main-thread time](docs/perf/readme/web-cpu.en.svg)

Whole-replay main-thread Task time: vs no plugin, ${describe(taskNative,false)}; vs Beautiful Chat, ${describe(taskUpstream,false)}. A difference under 10%, or both whole Web Task replays below 0.5 seconds, is even.

The table measures total row-render work (allRows.sum, milliseconds), using the same host React.Profiler boundary. Per-commit p95 is not total work. Vs no plugin: ${describe(rowNative,false)}.

${table('web','rows',lang)}

### Streaming layout shift

Cumulative layout shift (CLS, lower is better), from the same Web runs. The Task-time 0.5-second rule does not apply. Six decimals keep tiny baselines visible; percentages can magnify small absolute differences.

${table('web','cls',lang,{digits:6})}

### iOS

![iOS total row-render work](docs/perf/readme/ios-commit.en.svg)

iPhone 16 Pro / iOS 18.6 simulator, Paseo 0.11.2 development Hermes build, cold-launched per run. One benchmark simulator; Web and iOS measurements do not overlap. Total row-render work is in milliseconds; under 10% is even. Vs no plugin: ${describe(iosNative,false)}; vs Beautiful Chat: ${describe(iosUpstream,false)}. These are not hardware frame-rate or Release measurements.

${table('ios','rows',lang)}

Green ⬆ is lower; red ⬇ is higher. Percentages use medians before rounding. \`history-100\` is a fixture name, not 100 actual provider turns; it is labelled “History replay” here.

**Method.** Fixed host \`759532509\`, identical host row probes for native/plugin renderers. Web uses a newly exported production profiling build (main JS SHA256 prefix \`${webAsset}\`), Chrome 155.0.8059.40 at 1280×900; CDP reads main-thread time and forces GC before heap/DOM readings. iOS uses a development simulator build, not Release. Private daemon 6871, asserted mode per run, default feature settings with measurement counters enabled on the candidate. [Scripts, host patch and source verification](docs/bench/2026-10-16-readme/README.md). Generate charts with \`node docs/perf/readme-charts.mjs\`.

${longText.en}
`;
  const start=text.indexOf(zh?'## 性能对比':'## Performance'),end=text.indexOf(zh?'### 时间省在哪里':'### Where the time goes',start);
  if(start<0||end<0)throw Error('README performance markers missing');text=text.slice(0,start)+perf+'\n'+text.slice(end);
  const defaultsNote=zh?'各模式保留默认展开行为：Beautiful Chat 默认展开运行中的工具，Better Paseo 默认折叠。旧夹具名 `tool-expanded-streaming` 没有对应的展开操作，本轮称“工具日志增长（默认状态）”，不据此宣称展开工具体的性能。':'Modes retain their default disclosure behaviour: Beautiful Chat opens running tools, while Better Paseo keeps them collapsed. Despite its historical name, `tool-expanded-streaming` performs no expand action; “Growing tool log (defaults)” does not establish expanded-body performance.';
  const clsHeading=zh?'### 流式布局偏移':'### Streaming layout shift';text=text.replace(clsHeading,`${defaultsNote}\n\n${clsHeading}`);
  const whereHeading=zh?'### 时间省在哪里':'### Where the time goes';
  const whereStart=text.indexOf(whereHeading),whereEnd=text.indexOf('\n---',whereStart);
  if(whereStart<0||whereEnd<0)throw Error('README explanation markers missing');
  const explanation=zh?`### 时间省在哪里

- **跳过没有变化的行。** 按语义比较 theme 和 data，让没有变化的卡片跳过渲染。
- **增量解析回复。** 缓存已完成的 Markdown 块，只修补仍在增长的部分；长回复拆成块供原生宿主虚拟化，复制仍使用完整源码。
- **按需绘制工具正文。** 折叠的行不挂载正文；代码完成后再请求 daemon 高亮，大段代码和终端输出分批显示，并保留“显示全部”。
- **减少持续动画开销。** 网页运行圆点使用 CSS 动画，减少动态效果时静止；移除装饰性的阴影、磨砂和呼吸动画。
- **缩小重连交付。** 品牌图标和 Inter 字体按需下发，客户端源码保持 ASCII，供 Hermes 按单字节保存。

`:`### Where the time goes

- **Skip unchanged rows.** Semantic theme/data comparisons let unchanged cards skip rendering.
- **Parse replies incrementally.** Finished Markdown blocks are cached; only the growing tail is repaired. Long replies split into blocks that the native host can virtualize; Copy retains the full source.
- **Draw tool bodies on demand.** Collapsed rows do not mount their bodies. Completed code requests daemon highlighting; large code and terminal output render in batches with a Show all control.
- **Reduce continuous animation work.** The Web running dot uses CSS and stops for Reduced Motion; decorative shadows, blur and breathing loops are removed.
- **Send less on reconnect.** Brand marks and Inter are delivered on demand; the client source stays ASCII for Hermes one-byte strings.

`;
  text=text.slice(0,whereStart)+explanation+text.slice(whereEnd);
  const memory=(zh?`## 内存对比\n\nWeb 生产 profiling 构建，2026-10-16，与主线程图同一批样本，每格强制 GC 后 5 次取中位数。统计 JS 堆，不是应用或进程总内存；差值为 Better Paseo 减去对照，单位 MB，有正负号，不套用 10% 持平规则。\n\n![JS 堆与 DOM 节点](docs/perf/readme/web-memory.zh.svg)\n\n`:`## Memory comparison\n\nWeb production profiling build, 2026-10-16, same runs as the CPU chart, median of 5 readings after forced GC. This is JS heap, not total process/app memory. Differences are Better Paseo minus the control, in MB with signs; the 10% even rule does not apply.\n\n![JS heap and DOM nodes](docs/perf/readme/web-memory.en.svg)\n\n`)+table('web','heap',lang,{difference:true})+`\n\n${zh?'原始样本':'Raw samples'}: [Web](docs/bench/2026-10-16-readme/raw/web).\n\n---\n\n`;
  const memoryStart=text.indexOf(zh?'## 内存对比':'## Memory comparison'),memoryEnd=text.indexOf(zh?'## 功能':'## Features',memoryStart);
  if(memoryStart<0||memoryEnd<0)throw Error('README memory markers missing');text=text.slice(0,memoryStart)+memory+text.slice(memoryEnd);
  text=text.replace(zh?/- \*\*比不开插件还快。\*\*[^\n]*/:/- \*\*Faster than no plugin at all\.\*\*[^\n]*(?:\n  [^\n]*)*/,zh?`- **性能实测。** 本轮 Web 主线程对比不开插件：${describe(taskNative,true)}；完整数据见[性能对比](#性能对比)。`:`- **Measured performance.** This round's Web main-thread comparison vs no plugin: ${describe(taskNative,false)}. [Full comparison](#performance).`);
  text=text.replace(zh?/- \*\*内存占用接近不开插件。\*\*[^\n]*/:/- \*\*Memory close to no plugin\.\*\*[^\n]*(?:\n  [^\n]*){1,3}/,zh?'- **内存实测。** 同轮记录强制 GC 后的 JS 堆和相对不开插件的 MB 差值；见[内存对比](#内存对比)。':'- **Measured memory.** The same round records post-GC JS heap and signed MB differences against no plugin. [Memory comparison](#memory-comparison).');
  text=text.replace(zh?/- \*\*流式输出不跳动。\*\*[^\n]*/:/- \*\*Streaming that does not jump\.\*\*[^\n]*(?:\n  [^\n]*)*/,zh?'- **逐块呈现流式回复。** Markdown 缓存已完成的块，持续修补增长中的代码和表格；本轮布局偏移见[性能对比](#性能对比)。':'- **Block-by-block streaming replies.** Finished Markdown blocks are cached while growing code and tables are repaired. This round’s layout-shift readings are in the [performance comparison](#performance).');
  text=text.replace('active Paseo theme, and on the Web production build the whole timeline renders faster\nthan Paseo does on its own.','active Paseo theme. The performance section compares it with Paseo’s own timeline.');
  text=text.replace('配色跟随当前的 Paseo 主题；在 Web 生产构建上，整条时间线的渲染比 Paseo 自己画还快。','配色跟随当前的 Paseo 主题。下方实测对比它和 Paseo 原生时间线的开销。');
  writeFileSync(file,text);
}
// The separately audited follow-up supersedes only the public long-history section.
if(existsSync(`${repo}/docs/bench/2026-10-16-history-complete/raw/summary.json`)){
  const {updateLongHistory}=await import(pathToFileURL(`${repo}/docs/bench/2026-10-16-history-complete/tools/update-readme.mjs`).href);
  updateLongHistory(repo);
}
if(existsSync(`${repo}/docs/bench/2026-10-16-ios-five/parallel/campaign/raw/web-risk-summary.json`)){
  const {updateDeployedFix}=await import(pathToFileURL(`${repo}/docs/bench/2026-10-16-ios-five/update-readme.mjs`).href);
  updateDeployedFix(repo);
}
