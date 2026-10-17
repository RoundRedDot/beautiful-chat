// Publish only a complete, audited campaign. Historical evidence is never rewritten.
import {readFileSync,writeFileSync,realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fixtures,classify} from './report.mjs';

const SHA='b9dfae6e31453b962d90f7d3c7ca972c0e523cb3';
const bench='docs/bench/2026-10-17-readme/parallel-v2';
const num=(value,digits=1)=>value===null?'N/A':value.toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});

export function updateReadme(repo){
  const read=path=>JSON.parse(readFileSync(`${repo}/${path}`));
  const summary=read(`${bench}/raw/summary.json`),history=read(`${bench}/history/raw/summary.json`);
  const source=read(`${bench}/raw/source-audit.json`),shots=read('docs/images/screenshots.json');
  if(summary.collected!==550||summary.failures.length||summary.groups.length!==110||summary.aa.length!==22||summary.aa.some(g=>g.pairs.length!==5))throw Error('complete audited 550-run replay required');
  if(history.collected!==80||(history.structuralFailures??history.failures).length||history.groups.length!==36||history.failures.length&&!history.groups.some(g=>g.diagnosticOnly))throw Error('complete audited 80-run history required');
  if(source.length!==3||source.some(s=>s.mismatches.length)||source.find(s=>s.name==='candidate')?.sha!==SHA)throw Error('matching final source audit required');
  if(shots.sourceSha!==SHA||shots.assets.length!==52)throw Error('matching 52-asset capture manifest required');
  const get=(platform,fixture,mode,metric)=>{
    const group=summary.groups.find(g=>g.platform===platform&&g.fixture===fixture&&g.mode===mode);
    if(!group||group.n!==5||!Number.isFinite(group.metrics[metric]?.median))throw Error('missing measured replay cell');
    return group.diagnosticOnly?null:group.metrics[metric].median;
  };
  const signed=(base,current)=>base===null||current===null?'N/A':`${current-base>=0?'+':''}${num(current-base)}`;
  const delta=(base,current,zh,floor=0)=>{
    if(base===null||current===null)return 'N/A';
    const result=classify(base,current,floor);
    if(result==='even')return zh?'持平':'even';
    if(base===0)return zh?'从 0 增加':'up from 0';
    return `<img src="docs/perf/readme/arrow-${result==='better'?'up':'down'}.svg" width="11" height="13" alt="${result}">&ensp;${Math.round(Math.abs(current/base-1)*100)}%`;
  };
  const describe=(platform,metric,control,zh,floor=0)=>{
    const tally={better:0,even:0,worse:0,unavailable:0};
    for(const [fixture]of fixtures){const a=get(platform,fixture,control,metric),b=get(platform,fixture,'fork',metric);tally[a===null||b===null?'unavailable':classify(a,b,floor)]++;}
    return zh?`${tally.better} 项更低、${tally.even} 项持平、${tally.worse} 项更高${tally.unavailable?`、${tally.unavailable} 项不可比较`:''}`:`${tally.better} lower, ${tally.even} even, ${tally.worse} higher${tally.unavailable?`, ${tally.unavailable} unavailable`:''}`;
  };
  const table=(platform,metric,zh,{digits=1,memory=false}={})=>{
    const lines=[zh?'| 场景 | 不开插件 | Beautiful Chat | Better Paseo | 对比不开插件 | 对比 Beautiful Chat |':'| Scenario | No plugin | Beautiful Chat | Better Paseo | vs no plugin | vs Beautiful Chat |','| --- | ---: | ---: | ---: | :--- | :--- |'];
    for(const [fixture,en,cn]of fixtures){const [a,b,c]=['native','upstream','fork'].map(mode=>get(platform,fixture,mode,metric));lines.push(`| ${zh?cn:en} | ${num(a,digits)} | ${num(b,digits)} | **${num(c,digits)}** | ${memory?signed(a,c):delta(a,c,zh)} | ${memory?signed(b,c):delta(b,c,zh)} |`);}
    return lines.join('\n');
  };
  const regression=(zh)=>{
    const lines=[zh?'### 前一版对照与 A/A 波动':'### Parent comparison and A/A variability','',zh?'前一版固定 `2fc6476`，当前版固定 `b9dfae6`。每版每格 5 次，表中为行渲染总量（毫秒）。A/A 是当前版另外 5 次与主组逐轮配对的绝对差超过 10% 的数量；不将额外样本合并进主表。保留全部不稳定配对，较低中位数不等于稳定提升。':'Parent is `2fc6476`; current main is `b9dfae6`. Each cell uses five runs and total row-render work in milliseconds. A/A counts the five additional current-version runs whose paired relative difference exceeds 10%; these runs are not pooled into the main table. All unstable pairs are retained; lower medians do not establish stable improvements.',''];
    for(const platform of ['web','ios']){
      lines.push(`#### ${platform==='ios'?'iOS':'Web'}`,'',zh?'| 场景 | 前一版 ms | main ms | 相对前一版 | A/A 超过 10% | 最大 A/A 差 |':'| Scenario | Parent ms | Main ms | vs parent | A/A over 10% | Max A/A difference |','| --- | ---: | ---: | ---: | ---: | ---: |');
      for(const [fixture,en,cn]of fixtures){const a=get(platform,fixture,'parent','rows'),b=get(platform,fixture,'fork','rows'),aa=summary.aa.find(g=>g.platform===platform&&g.fixture===fixture),diagnostic=aa.pairs.some(pair=>pair.diagnosticOnly);lines.push(`| ${zh?cn:en} | ${num(a)} | ${num(b)} | ${a===null||b===null?'N/A':`${b/a-1>=0?'+':''}${((b/a-1)*100).toFixed(2)}%`} | ${diagnostic?'N/A':`${aa.over10}/5`} | ${diagnostic?'N/A':`${aa.maxAbsolutePercent.toFixed(2)}%`} |`);}
      lines.push('');
    }
    return lines.join('\n');
  };
  const historyText=zh=>{
    const lines=[zh?'### 长会话加载':'### Long-history loading','',zh?'同轮最多 4 组并行复测 `history-complete-v1`：Web 和 iOS 各 40 次，共 **80 次**。每个平台、每个场景有 5 对当前版 A/A，以及每种对照 5 次。固定 `b9dfae6` / Beautiful Chat `42b61d8`，使用默认设置。810 条 / 1 个实际 provider turn 与 832 条 / 12 轮两种输入均保留 59,427 字符长回复。260 条 reasoning 使用等长唯一合成标识；这不证明旧重复 key 输入已修复。':'The same concurrent-max4 campaign reruns `history-complete-v1`: 40 Web and 40 iOS samples, **80 total**. Each scenario/platform has five current-version A/A pairs and five runs per control. Sources are `b9dfae6` and Beautiful Chat `42b61d8`, with default settings. Both the 810-entry / one-provider-turn and 832-entry / 12-turn inputs retain the 59,427-character reply. The 260 reasoning items use distinct equal-length synthetic tags; this does not establish a fix for the old duplicate-key input.','',`![${zh?'长历史冷打开行渲染':'Long-history cold-open row work'}](docs/perf/readme/history-complete-open.${zh?'zh':'en'}.svg)`,''];
    for(const platform of ['web','ios']){
      lines.push(`#### ${platform==='ios'?'iOS':'Web'}`,'',zh?'| 场景 / 阶段 | 不开插件 | Beautiful Chat | Better Paseo |':'| Scenario / phase | No plugin | Beautiful Chat | Better Paseo |','| --- | ---: | ---: | ---: |');
      for(const scenario of ['incident','multi-turn'])for(const [phase,en,cn]of [['open','Cold-open row work','冷打开行渲染'],['older','First older reveal row work','首次上翻行渲染'],['sessionRemount','Whole-session return row work','整体会话返回行渲染']]){
        const cells=['native','baseline','candidate'].map(mode=>{const g=history.groups.find(g=>g.platform===platform&&g.scenario===scenario&&g.mode===mode&&g.phase===phase);if(g?.diagnosticOnly)return 'N/A';if(!g||g.n!==(mode==='candidate'?10:5)||!Number.isFinite(g.metrics.rows?.median))throw Error('missing history cell');return num(g.metrics.rows.median);});
        lines.push(`| ${scenario==='incident'?(zh?'810 条 / 1 轮':'810 entries / 1 turn'):(zh?'832 条 / 12 轮':'832 entries / 12 turns')} — ${zh?cn:en} | ${cells.join(' | ')} |`);
      }lines.push('');
    }
    lines.push(`![${zh?'整体会话返回行渲染':'Whole-session return row work'}](docs/perf/readme/history-complete-return.${zh?'zh':'en'}.svg)`,'',zh?'单位为毫秒。Web 上翻从尾部发出覆盖当前总高度的真实滚轮输入，不做未计时的预滚动；iOS 记录准备定位，再计时真实 HID 拖动。整体返回先确认目标时间线真实卸载，再通过宿主标签页返回同一会话；不是滚动导致的独立 Markdown 块重新挂载。只有通过上翻前和返回后完整复制验证的当前版组才发布数值；任一样本失败，该场景／配置的三个阶段整组标 N/A，不以其余成功样本补算。JS 就绪代理不等于首个可用视口；上翻和返回可能渲染不同的行集合，需结合范围和 A/A 波动理解。':'Values are milliseconds. Web older reveal uses a full-height physical wheel from the tail, with no untimed pre-scroll; iOS records preparation before a measured HID drag. Whole-session return proves target unmount before returning through the host pane; it is not independent Markdown-block remount during scrolling. Numeric current-version groups require exact copying before reveal and after return. Any failed attempt makes every phase of its scenario/configuration group N/A; no successful subset is substituted. JS-ready proxies are not first-usable viewport times; reveal/return may render different row sets, so interpret totals with ranges and A/A spread.','',`[${zh?'长历史范围、A/A 与原始证据':'History ranges, A/A and raw evidence'}](${bench}/history/RESULTS.md)`,'');
    return lines.join('\n');
  };
  for(const zh of [false,true]){
    const lang=zh?'zh':'en',file=`${repo}/${zh?'README-zh.md':'README.md'}`;let text=readFileSync(file,'utf8');
    const heading=zh?'## 性能对比':'## Performance',endHeading=zh?'### 时间省在哪里':'### Where the time goes';
    const start=text.indexOf(heading),end=text.indexOf(endHeading,start);
    if(start<0||end<0)throw Error('performance markers missing');
    const lines=[heading,'',zh?'### 最新 main：630 次同轮采样':'### Latest main: 630 fresh samples','',zh?'2026-10-17 在 Mac Studio（Apple M5 Max、18 核、64 GB、macOS 27.0.1）固定最新 `main` **`b9dfae6`** 重跑。Web / iOS 各 11 场景 × 5 配置 × 5 次，共 **550 次回放**；另有 **80 次长历史测试**。五配置为不开插件、Beautiful Chat `42b61d8`、当前版、当前版 A/A 重复和前一版 `2fc6476`。最多 4 组隔离并行，按场景和轮次轮换分组与配置顺序；下方三模式表每格取 5 次主组的中位数。显示错误整组标 N/A，完整范围和失败记录见[本轮报告](docs/bench/2026-10-17-readme/README.md)。':'Rerun on Mac Studio (Apple M5 Max, 18 cores, 64 GB, macOS 27.0.1) on 2026-10-17, pinned to the latest `main`, **`b9dfae6`**. Web/iOS each run 11 scenarios × 5 configurations × 5 repetitions: **550 replays**, plus **80 long-history samples**. Configurations are no plugin, Beautiful Chat `42b61d8`, current main, an independent current-main A/A repeat and parent `2fc6476`. Up to four isolated groups run concurrently, rotating lane placement and configuration order by scenario and repetition; three-mode tables use medians of five primary runs per cell. Display-error groups are N/A. [Full ranges, failures and evidence](docs/bench/2026-10-17-readme/README.md).','',`![${zh?'Web 主线程时间':'Web main-thread time'}](docs/perf/readme/web-cpu.${lang}.svg)`,'',zh?`整段回放主线程 Task 时间对比不开插件：${describe('web','task','native',zh,.5)}；对比 Beautiful Chat：${describe('web','task','upstream',zh,.5)}。相差不到 10%，或两边整段 Task 均低于 0.5 秒，记为持平。`:`Whole-replay main-thread Task time vs no plugin: ${describe('web','task','native',zh,.5)}; vs Beautiful Chat: ${describe('web','task','upstream',zh,.5)}. Under 10%, or both whole Task replays below 0.5 seconds, is even.`,'',zh?`下表为行渲染总量（宿主 Profiler \`allRows.sum\`，毫秒），对比不开插件：${describe('web','rows','native',zh)}；不是单次提交 p95。`:`The table measures cumulative row-render work (host Profiler allRows.sum, milliseconds), not per-commit p95. Vs no plugin: ${describe('web','rows','native',zh)}.`,'',table('web','rows',zh),'',zh?'各模式保留默认展开行为：Beautiful Chat 默认展开运行中的工具，Better Paseo 默认折叠。`tool-expanded-streaming` 不执行展开操作，此处称“工具日志增长（默认状态）”，不据此宣称展开工具体的性能。':'Modes retain default disclosure: Beautiful Chat opens running tools; Better Paseo keeps them collapsed. `tool-expanded-streaming` performs no expand action and is labelled “Growing tool log (defaults)”; this does not establish expanded-body performance.','',zh?'### 流式布局偏移':'### Streaming layout shift','',zh?'同批 Web 的累计布局偏移（CLS，越低越好），保留 6 位小数；不套用 Task 的 0.5 秒规则。微小基数的百分比可能放大绝对差异。':'Cumulative layout shift (CLS, lower is better) from the same Web runs, with six decimals. The Task-time 0.5-second rule does not apply; percentages can magnify tiny absolute differences.','',table('web','cls',zh,{digits:6}),'','### iOS','',`![${zh?'iOS 行渲染总量':'iOS total row-render work'}](docs/perf/readme/ios-commit.${lang}.svg)`,'',zh?`iPhone 16 Pro / iOS 18.6 开发版 Hermes 模拟器，每次冷启动；使用 4 台隔离测试模拟器，最多 4 组并行；Web 阶段全部完成后再测 iOS。行渲染总量单位为毫秒，不到 10% 记为持平。对比不开插件：${describe('ios','rows','native',zh)}；对比 Beautiful Chat：${describe('ios','rows','upstream',zh)}。不代表真机帧率或 Release 性能。`:`iPhone 16 Pro / iOS 18.6 development Hermes simulator, cold-launched per sample. Four isolated benchmark simulators, up to four concurrent groups; all Web work completes before iOS starts. Row-render totals are milliseconds; under 10% is even. Vs no plugin: ${describe('ios','rows','native',zh)}; vs Beautiful Chat: ${describe('ios','rows','upstream',zh)}. These are not physical-device frame rates or Release performance.`,'',table('ios','rows',zh),'',zh?'绿色 ⬆ 表示更低，红色 ⬇ 表示更高；百分比按舍入前中位数计算。`history-100` 是夹具名，不等于 100 个实际 provider turn，此处称“历史回放”。':'Green ⬆ is lower; red ⬇ is higher. Percentages use unrounded medians. `history-100` is a fixture name, not 100 actual provider turns; it is labelled “History replay”.','',zh?'**方法与边界。** 固定 Paseo 0.11.2 / `759532509` 与相同宿主行探针；为各组重新导出生产 profiling Web 构建并记录哈希。Chrome 155.0.8059.40、1280×900，CDP 测主线程，计时后强制 GC 测 JS 堆和 DOM；默认功能配置，当前版开启测量计数。行渲染不包含整个 native 布局或应用 CPU。原始数据记录负载、CPU 空闲率及内存压力；入场要求 CPU 空闲率 ≥15%、内存空闲比例 ≥10%、压力等级为 1；记录负载但不以负载平均值拒绝采样，结束时资源超限样本保留并标记。实际并发随阶段变化，仅为本协议下观察中位数，不代表固定并发吞吐或稳定提升。':'**Method and limits.** Fixed Paseo 0.11.2 / `759532509` with identical host row probes; each lane has a freshly exported production profiling Web build with a recorded hash. Chrome 155.0.8059.40, 1280×900; CDP measures main-thread time, with forced-GC heap/DOM readings after timing. Default feature settings; current-version measurement counters are enabled. Row work excludes whole native layout and app CPU. Raw data records load, CPU idle and memory pressure; admission requires CPU idle ≥15%, memory free ≥10% and pressure level 1; load is recorded without a load-average cutoff. End-resource excursions remain flagged. Actual overlap varies: these are observed medians under this protocol, not fixed-concurrency throughput or stable-speedup claims.','',regression(zh),'',historyText(zh),''];
    text=text.slice(0,start)+lines.join('\n')+'\n'+text.slice(end);
    const ms=text.indexOf(zh?'## 内存对比':'## Memory comparison'),me=text.indexOf(zh?'## 功能':'## Features',ms);
    if(ms<0||me<0)throw Error('memory markers missing');
    const memory=[zh?'## 内存对比':'## Memory comparison','',zh?'2026-10-17，同批 Web 生产 profiling 测试，每格为强制 GC 后 5 次主组的中位数。统计 JS 堆，不是进程或应用总内存。差值为 Better Paseo 减去对照，单位 MB；不套用 10% 持平规则。':'2026-10-17, the same Web production profiling runs, median of five primary post-GC readings. This is JS heap, not total process/app memory. Differences are Better Paseo minus each control, in MB; the 10% even rule does not apply.','',`![${zh?'JS 堆与 DOM 节点':'JS heap and DOM nodes'}](docs/perf/readme/web-memory.${lang}.svg)`,'',table('web','heap',zh,{memory:true}),'',`[${zh?'原始 Web 样本':'Raw Web samples'}](${bench}/raw/web)`,'','---','',''];
    text=text.slice(0,ms)+memory.join('\n')+text.slice(me);
    text=text.replace(zh?/^- \*\*性能实测。\*\*.*$/m:/^- \*\*Measured performance\.\*\*.*$/m,zh?'- **性能实测。** 最新 main `b9dfae6` 完成 630 次同轮采样，完整对比及 A/A 波动见[性能对比](#性能对比)。':'- **Measured performance.** Latest main `b9dfae6` has 630 fresh samples; comparisons and A/A variability are disclosed in [Performance](#performance).');
    text=text.replace(zh?/^截图于 .*$/m:/^Screenshots refreshed .*$/m,zh?`截图于 ${shots.capturedAt} 基于 \`b9dfae6\` 的离线 Web showcase 重拍。全部产品截图默认浅色，并随阅读器主题自动切换深色；手机外框为示意。性能版本及条件见上文。[截图清单](docs/images/screenshots.json)。`:`Screenshots refreshed on ${shots.capturedAt} from b9dfae6 using the offline Web showcase. All product screenshots default to light and switch to dark with the reader’s theme; the phone frame is illustrative. Performance versions and conditions are identified above. [Capture manifest](docs/images/screenshots.json).`);
    writeFileSync(file,text);
  }
}
if(process.argv[1]&&realpathSync(process.argv[1])===fileURLToPath(import.meta.url))updateReadme(resolve(process.argv[2]??'.'));
