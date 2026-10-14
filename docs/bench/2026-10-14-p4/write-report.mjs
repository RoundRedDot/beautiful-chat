import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const here = import.meta.dirname;
const raw = path.join(here, 'raw');
const data = JSON.parse(readFileSync(path.join(raw, 'summary.json'), 'utf8'));
const env = JSON.parse(readFileSync(path.join(raw, 'environment.json'), 'utf8'));
const { summary: s, comparisons } = data;
const fmt = (v, scale = 1, digits = 2) => `${(v.median / scale).toFixed(digits)} [${(v.min / scale).toFixed(digits)}, ${(v.max / scale).toFixed(digits)}]`;
const mib = 1024 * 1024;
function table(headers, rows) {
  return ['| ' + headers.join(' | ') + ' |', '| ' + headers.map(() => '---').join(' | ') + ' |', ...rows.map(row => '| ' + row.join(' | ') + ' |')].join('\n');
}
const commands = [
  ['npm ci', 'npm-ci.log', 0, '413 packages installed; package files unchanged'],
  ['npm run typecheck (baseline)', 'baseline-0.log', 0, 'c8ed5c7'],
  ['npm test -- --reporter=dot (baseline)', 'baseline-1.log', 0, '91 files / 1110 tests'],
  ['npm run check:hermes', 'baseline-2.log', 0, 'compile + stock/sticky host evaluation'],
  ['node .showcase/tools/bundle-size.mjs', 'baseline-3.log', 0, '842214 bytes / gzip 194447 bytes'],
  ['node docs/bench/2026-10-14-p4/baseline.mjs --write', 'baseline-generate.log', 0, '36 loaded entries / 192 resolver cases / 56 outputs'],
  ['npm run typecheck (with new test)', 'final-typecheck.log', 0, 'new test included'],
  ['npm test -- --reporter=dot test/unit/p4-highlight-equivalence.test.ts', 'equivalence-test.log', 0, '249 tests'],
  ['node docs/bench/2026-10-14-p4/baseline.mjs --verify', null, 0, 'exact golden equality'],
  ['npm test -- --reporter=dot (final)', 'final-test.log', 0, '92 files / 1359 tests'],
  ['node docs/bench/2026-10-14-p4/run.mjs', 'measurements.log', 0, '91 cold processes, 22 fixture scenarios; final isolated run'],
  ['node docs/bench/2026-10-14-p4/summarize.mjs', null, 0, 'summary.json'],
  ['node docs/bench/2026-10-14-p4/verify-model.mjs', 'verify-model.log', 0, 'uninstrumented handler + 16-grammar markdown model equivalent'],
];
for (const [, file] of commands) if (file) copyFileSync(`/tmp/bc-perf-p4/${file}`, path.join(raw, file));
writeFileSync(path.join(raw, 'validation.json'), JSON.stringify(commands.map(([command, log, exitCode, result]) => ({ command, log, exitCode, result })), null, 2) + '\n');

const timing = table(['实际 eager 请求', '模块加载 ms', 'deferred packages + factory ms', 'core create ms', 'buildEngine ms', '首次 token ms', '首次 handler ms', '后续同码缓存 ms', '后续不同码 ms'],
  ['typescript', 'markdown'].map(id => {
    const m = s[`eager/${id}`].metrics;
    return [id, ...['moduleLoadMs', 'deferredPackagesAndFactoryMs', 'createMs', 'buildEngineMs', 'firstTokenMs', 'firstHighlightMs', 'subsequentCachedMs', 'subsequentUncachedMs'].map(k => fmt(m[k], 1, k === 'subsequentCachedMs' ? 3 : 2))];
  }));
const grammar = table(['孤立语法/组', 'n', 'grammar package ms', 'loadLanguage ms', '两者合计 ms', '首次 token ms', 'first load 含 token ms', '注册 heap delta MiB'],
  Object.entries(s).filter(([k]) => k.startsWith('group/')).map(([k,v]) => {
    const m = v.metrics;
    return [k.replace('group/', ''), m.firstLoadMs.n, ...['grammarPackagesMs','loadLanguageMs','grammarInitMs','firstTokenMs','firstLoadMs'].map(f => fmt(m[f])), fmt(m.heapRegistrationDelta, mib, 3)];
  }));
const memory = table(['进程/首请求', 'GC 后阶段', 'n', 'rss MiB', 'heapUsed MiB', 'external MiB', 'arrayBuffers MiB'],
  ['eager/typescript','eager/markdown','group/typescript','group/markdown-group'].flatMap(k => ['idle','first','all'].map(stage => [k, stage, s[k].memory[stage].rss.n, ...['rss','heapUsed','external','arrayBuffers'].map(field => fmt(s[k].memory[stage][field], mib, 3))])));
const deltas = table(['模型', 'GC 后 first-idle heap delta MiB', 'GC 后 all-idle heap delta MiB'],
  ['eager/typescript','group/typescript','eager/markdown','group/markdown-group'].map(k => [k, fmt(s[k].metrics.heapFirstDelta, mib, 3), fmt(s[k].metrics.heapAllDelta, mib, 3)]));
const dispersion = table(['fixture', '展开模式', '首次使用语言顺序', '今天单次 init ms', 'lazy grammar init 求和 ms', 'lazy 含公共 base ms', 'lazy first-load 含 token 求和 ms', '加载事件 eager→lazy'],
  data.dispersion.map(row => [row.fixture.replace('.jsonl',''), row.scope, row.order.join(' → ') || '无', fmt(row.eagerInitMs), fmt(row.lazyGrammarSumMs), fmt(row.lazyWithBaseMs), fmt(row.lazyFirstLoadIncludingTokenSumMs), `${row.eagerInitEvents} → ${row.lazyInitEvents}`]));
const aa = table(['模型/指标', '5 对差值 B−A（绝对单位；相对百分比）', '最大绝对差'],
  ['eager/typescript','group/typescript','eager/markdown','group/markdown-group'].flatMap(k => Object.entries(s[k].aa).map(([metric,v]) => {
    const scale = metric.startsWith('heap') ? mib : 1; const unit = metric.startsWith('heap') ? 'MiB' : 'ms';
    return [`${k} / ${metric}`, v.pairs.map(p => `${(p.difference/scale).toFixed(3)} ${unit} (${p.percent.toFixed(2)}%)`).join('; '), `${(v.maxAbsoluteDifference/scale).toFixed(3)} ${unit}`];
  })));

const ended = new Date().toISOString();
const report = `# Result

Phase 1 完成，建议 **STOP：不进入 Phase 2**。已建立当前 eager handler 的可复跑等价性基线，完成 91 次冷进程测量；未实施按需加载、未修改生产源码或 package 文件、未提交。止损依据是 fixture 内首次语法加载事件由 1 次增加到 2–4 次；不存在已验证的 daemon 或宿主性能收益。

# Execution (model, start-end)

- 模型/档位：codex/gpt-6.1-sol，thinking high（按任务给定的 parent-verified 配置；不是脚本探测值）。
- 执行：${env.started} 至 ${ended}（Asia/Singapore 为 UTC+08:00）；最终测量结束 ${env.ended}。
- worktree：/Users/luopeihuan/workspace/rrd/beautiful-chat/.worktrees/perf-p4；branch perf/p4；HEAD ${env.revision}。
- ${env.node}，${env.platform}/${env.arch}，${env.cpu}，Darwin ${env.os}；Shiki core/primitive/langs 4.4.3。逐进程机器 loadavg 见 cold-runs.json；末尾 loadavg=${JSON.stringify(env.loadAtEnd)}，共享机器负载较高。
- 开始工作区干净；授权目录内没有既有同名路径，无重叠写入。未访问主 checkout/其它 worktree，未 re-delegate；没有 daemon、browser、device、commit、push、merge、deploy 操作。

# Findings (path:line)

- index.server.ts:268、:300、:308、:546：当前第一次任何高亮请求都调用 eager buildEngine，加载 18 种 grammar 和两套主题；失败 memo 清除保持原行为。模块空闲时已推迟 grammar 求值，因此完全不发高亮请求的会话已获得这部分节省，P4 不能重复计为新增收益。
- node_modules/@shikijs/primitive/dist/index.mjs:273、:305、:319、:437：html 有 javascript/css 硬依赖；后续加载 markdown 懒嵌入语言会重建 markdown；getLoadedLanguages 包含 grammar aliases。raw/grammar-metadata.json 由实际 dist module 导出数据取得，markdown 支持组是 16 grammar（自身 + 15），仅排除 jsx/toml。
- index.server.ts:340、:351：192 条解析基线覆盖 ALIASES、EXTENSIONS、grammar 名称/别名并集，大小写/空白、提示路径、Windows 文件名、Dockerfile 与 hint/filename 优先级。cts/mts/cjs/mjs/ps/pwsh 的显式 hint 在今天回包中保留别名字符串，不能仅凭 canonical grammar 偷换 response.language。
- index.server.ts:449、:453、:550：超限仍返回已解析的 language（例如 typescript）及无色 lines；diffBodyCode 独立使用 filename 推断。56 个逐 token 输出覆盖每种语言深浅主题、纯文本、未知、空串、三个 guard、diff 主路/正文与未知正文文件；首个请求是含 ts/python/html fences 的 markdown。loaded 排序快照有 36 个名称/别名；test/unit/p4-highlight-equivalence.test.ts:24 共 249 项测试。
- client/highlight.ts:46、:165、:204 与 index.server.ts:419：两端缓存 200 条，客户端并发去重并在 render 读缓存；已经缓存的初次错误着色不能靠后续 grammar 加载修复。本次只冻结 eager 正确结果。
- client/components/markdown/render/code-block.tsx:43、client/components/tool-callouts.tsx:918、:944、client/components/syntax-highlight.tsx:545：普通 Markdown 回复不请求 markdown grammar，代码 fence 才调用高亮；read/write 用 classifier hint，diff 正文用 filename。shell-log/terminal 本地着色，不能当成 shell grammar RPC。本组 11 个 stream fixture 没有实际 markdown grammar 请求，markdown 组另以离线样例覆盖。

# Measurements (median + range)

所有表格均为 **median [min, max]**；每种孤立 grammar 至少 3 次冷进程，eager TS、eager markdown、TS 模型、markdown group 各 10 次（5 对 A/A）。取中位数前先按进程计算 heap before/after delta，不用跨进程绝对 heap 作对象归因；rss、heapUsed、external、arrayBuffers 四项分别报告，arrayBuffers 不与 external 相加。

## 方法与可比边界

handler 通过 benchmark 中的 esbuild 单个 CJS bundle 和 contribute/handle 注册在进程内加载，只调用 highlight.tokens；没有连接 Paseo。harness.mjs:25 在只读源码的内存副本中为 buildEngine 添加计时，并包裹真实 core 来观察 getLoadedLanguages/token 时间；没有新增生产导出或改变返回值。worker.mjs:20 预先读好 bundle，moduleLoadMs 包括编译/eval 和外部 SDK/zod 的本地加载，不含 bundle 文件 I/O、esbuild 编译、OS process startup。target es2022 是离线 Node 构建参数，未核实当前宿主 compiler 的 server 参数，不能称为生产 daemon 启动实测。

deferredPackagesAndFactoryMs 是实际 buildEngine 总时间减去真实 createHighlighterCore 时间，包含 deferred package 求值、regex factory 和少量 glue；两者分别报告。此处 package 指同包中的求值时间，不是 npm 网络下载或磁盘冷缓存。每次是 fresh Node process、module/engine/cache 冷；没有清除 OS 文件缓存。

group 模型仅是 bench 脚本，用同一单 bundle 内的所有动态 import loader，按 group 初始化空 engine + 两套主题，再 loadLanguage；不含服务器 SDK/字体等初始化，因此其绝对进程 moduleLoad/rss 不与 handler 相减作为 daemon 收益。group firstHighlightMs 是各 timed 活动区间的总和，排除了分段 GC，非完整 RPC/宿主 wall time。core/主题只计一次。第一次 token 化会初始化/编译 regex，成本明显高于 grammar registration：今天 eager 也在第一次使用各 grammar 时支付这部分成本，不能把 lazy 含 token 的总和与今天仅 buildEngine 的数值直接当作回退比。

首次样例见 cases.mjs:1。内存点是两次 forced GC 后读取，分别为 module load idle、首次 highlight、全部 18 grammar 各至少一次（worker.mjs:10、:38、:42、:57、:64）；所有 91 个进程都有完整三点四指标，raw/cold-runs.json。

## 当前 eager handler

${timing}

## 每语言孤立 first load 与 markdown group

公共 base（core/regex/themes 求值 + 空 core create）为 ${fmt(data.base)} ms。html 行含 javascript + css；markdown 单独一行是依赖风险诊断值，**不是输出等价方案**，不得作为收益候选。markdown-group 才是等价组。

${grammar}

## GC 后全进程内存（MiB）

${memory}

同一进程内 heap delta：

${deltas}

不含 markdown 的 TS 单语种样例：模型对 eager 的配对 heap delta 差为 ${fmt(comparisons.typescript.heapFirstDelta, mib, 3)} MiB，即约 3.02 MiB 更少；active init 差 ${fmt(comparisons.typescript.initDeltaMs)} ms，即约 31.84 ms 更少。其 first request 差 ${fmt(comparisons.typescript.firstHighlightMs)} ms，但 group A/A 最大差 95.43 ms，方向/量级不稳定，首次延迟收益不判定。这只是该 Node 离线样例的 Shiki 操作保留堆/初始化潜力，不是任意多语言会话收益或 daemon 内存读数。

含 markdown 的同一 fenced 样例：配对 heap delta 差 ${fmt(comparisons.markdown.heapFirstDelta, mib, 3)} MiB，即约 0.48 MiB 更少；active init 差 ${fmt(comparisons.markdown.initDeltaMs)} ms，首请求差 ${fmt(comparisons.markdown.firstHighlightMs)} ms，均没有超出当前耗时 A/A 差异，不能认定初始化/延迟收益。先加载 16/18 grammar 几乎回到 eager；全部 18 grammar 使用后，操作 heap delta 约 19 MiB，模型和 eager 接近，没有全量会话的持续节省证据。未测 daemon RSS 收益，不能将这些离线 delta 宣传为 daemon 节省。

## Session dispersion

default=只分析 assistant 的代码块，工具与 reasoning 卡片保持默认折叠；expanded=所有工具/reasoning/code 展开，依 fixture event 顺序取第一次有效 hint，完成 fence 才算请求，diff 主/正文各解析一次。使用真实 classifier、lexer 与 handler resolver（run.mjs:31、:38、:64）。这是确定性提取模型，无 UI 渲染/真实 RPC 时序；真实分组加载导致的首绘无色事件按任务定义为“首次使用尚未加载语言/组”。每个新内容的既有 RPC/cache miss 自身也可能先无色，**实际无色帧数未观测**。

每个 fixture 的完整逐请求记录/原始 SHA256 在 raw/sessions.json。“sum range”是各孤立测量 min/max 的求和包络，**不是实际会话耗时分布**；median 列为各语言 medians 求和。语言样例不是 fixture 原始 code，含 token 求和只供成本拆解。当前集合没有 html/markdown overlap，未重复计硬依赖；若未来组内部分 grammar 已加载，不能直接把孤立组全成本代入。无请求会话两边成本为零，不能归纳为 P4 收益。

${dispersion}

markdown-start 的补充场景：加载 markdown-group 后，上述 15 种的后续 first-use 没有新加载事件；若后来还用 jsx/toml，最多再各 1 次，合计最多 3 次。没有该场景的 stream fixture，不伪造 session 实测；其 first-load/heap 用表中同样例模型数据。

## 当前离线 A/A（5 对）

${aa}

这是本轮同运行时离线 A/A，未借用历史噪声。耗时差异在 5 对后仍有方向/量级不稳定，尤其 markdown 与 group TS first request，按 §5 只报告，不进行交付收益判定；宿主/daemon A/A 完全未执行。

# Recommendation with the rule check

**STOP Phase 2**。语法 registration/init 求和在这些无 markdown session 模型中没有明确变差（例如 codeblock-streaming 含 base ${fmt(data.dispersion.find(row => row.fixture === 'codeblock-streaming.jsonl' && row.scope === 'expanded').lazyWithBaseMs)} ms，对 today ${fmt(s['eager/typescript'].metrics.buildEngineMs)} ms）；然而任务/计划是 **耗时之和或首次无色加载事件任一明显变差就停**：codeblock-streaming 的加载事件 1→4，展开后的 diff-large/history-100/mixed-turn 是 1→2，触发确定性事件止损。单语言 TS 的潜在 heap/init 改善不足以抵消该条件，也不能证明宿主首绘改善。

含 markdown 的会话更无充分理由推进：16/18 grammar 必须一次加载，约 0.48 MiB 离线保留堆差，初始化/首次延迟差落在 A/A 范围；不含高亮的会话今天已不初始化。没有客户端 bundle 或网络收益声明，动态 import 在同一 bundle 仅推迟执行。

# Validation (commands → exit codes)

${table(['命令', 'exit code', '结果 / raw log'], commands.map(([command, log, exitCode, result]) => [command, exitCode, result + (log ? ` / raw/${log}` : '')]))}

基线检查完成后 git diff --exit-code 为 0；最终仍无 tracked source/package 修改，仅三个授权位置的新增内容。npm ci 的已有依赖审计警告、React renderer/act 警告保留在 raw 日志，没有进行依赖修复。

# Remaining

- 按任务要求 Phase 1 后停止；不实现 index.server.ts lazy loading，不创建 commit。
- 生产 daemon、宿主真实 RPC/首绘、Web/iOS/Android、网络、真实设备、多连接与生产包加载均未验证，也未获本阶段授权；离线全进程 memoryUsage 不能替代 daemon 实测。
- 并发加载 memo/失败重试/加载顺序的 lazy 实现测试属于 Phase 2，本阶段只有 eager 等价性 golden；如父级日后决定重新开 Phase 2，须新增这些实现专属用例并保持 fixture 不变。
- raw/exploratory-overlapping.log 是已排除的探索运行（与验证进程重叠），不进入任何 summary。最终 91 cold runs 顺序执行，未并行运行本任务的测试/编译；系统仍有其他负载，loadavg 已逐次记录。
- 复跑：先 npm ci；node docs/bench/2026-10-14-p4/baseline.mjs --verify；npm test -- --reporter=dot test/unit/p4-highlight-equivalence.test.ts；待测试退出后 node docs/bench/2026-10-14-p4/run.mjs；node docs/bench/2026-10-14-p4/summarize.mjs；node docs/bench/2026-10-14-p4/write-report.mjs。--write 只用于首次冻结当前 eager golden，Phase 2 不应重生成。

原始数据：docs/bench/2026-10-14-p4/raw/{environment,grammar-metadata,cold-runs,sessions,summary,validation}.json；测试 golden：test/fixtures/p4-highlight/eager.json；阶段报告：/tmp/bc-perf-p4/phase1-report.md。
`;
writeFileSync(path.join(here, 'README.md'), report);
writeFileSync('/tmp/bc-perf-p4/phase1-report.md', report);
console.log('/tmp/bc-perf-p4/phase1-report.md');
