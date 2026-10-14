# Result

Phase 1 完成，建议 **STOP：不进入 Phase 2**。已建立当前 eager handler 的可复跑等价性基线，完成 91 次冷进程测量；未实施按需加载、未修改生产源码或 package 文件、未提交。止损依据是 fixture 内首次语法加载事件由 1 次增加到 2–4 次；不存在已验证的 daemon 或宿主性能收益。

# Execution (model, start-end)

- 模型/档位：codex/gpt-6.1-sol，thinking high（按任务给定的 parent-verified 配置；不是脚本探测值）。
- 执行：2026-10-14T08:57:44Z 至 2026-10-14T09:17:25.279Z（Asia/Singapore 为 UTC+08:00）；最终测量结束 2026-10-14T09:10:01.734Z。
- worktree：/Users/luopeihuan/workspace/rrd/beautiful-chat/.worktrees/perf-p4；branch perf/p4；HEAD c8ed5c7efd0bd29ea65ad560312e81e1ccad927d。
- v24.18.0，darwin/arm64，Apple M5 Pro，Darwin 27.0.0；Shiki core/primitive/langs 4.4.3。逐进程机器 loadavg 见 cold-runs.json；末尾 loadavg=[23.32275390625,27.4375,23.5791015625]，共享机器负载较高。
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

| 实际 eager 请求 | 模块加载 ms | deferred packages + factory ms | core create ms | buildEngine ms | 首次 token ms | 首次 handler ms | 后续同码缓存 ms | 后续不同码 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| typescript | 79.89 [58.86, 102.27] | 12.23 [9.89, 14.31] | 28.37 [23.53, 31.98] | 40.60 [33.79, 46.09] | 145.12 [123.51, 166.80] | 188.71 [157.58, 204.58] | 0.070 [0.060, 0.077] | 12.94 [11.57, 14.15] |
| markdown | 71.21 [58.76, 97.36] | 11.84 [10.47, 16.92] | 27.01 [23.26, 37.31] | 38.85 [33.73, 54.24] | 277.18 [253.74, 330.27] | 314.94 [289.29, 381.06] | 0.078 [0.070, 0.145] | 15.96 [14.59, 19.54] |

## 每语言孤立 first load 与 markdown group

公共 base（core/regex/themes 求值 + 空 core create）为 5.01 [4.22, 12.73] ms。html 行含 javascript + css；markdown 单独一行是依赖风险诊断值，**不是输出等价方案**，不得作为收益候选。markdown-group 才是等价组。

| 孤立语法/组 | n | grammar package ms | loadLanguage ms | 两者合计 ms | 首次 token ms | first load 含 token ms | 注册 heap delta MiB |
| --- | --- | --- | --- | --- | --- | --- | --- |
| typescript | 10 | 0.99 [0.85, 1.54] | 1.35 [1.20, 2.13] | 2.39 [2.09, 3.67] | 143.09 [119.59, 229.69] | 145.51 [121.68, 233.36] | 0.510 [0.500, 0.510] |
| markdown-group | 10 | 6.53 [5.54, 7.92] | 26.20 [19.78, 32.20] | 33.58 [25.32, 39.37] | 282.92 [240.46, 316.40] | 316.24 [265.78, 355.77] | 3.088 [3.080, 3.104] |
| tsx | 3 | 1.17 [1.12, 1.45] | 1.26 [1.15, 1.60] | 2.38 [2.32, 3.04] | 86.74 [80.96, 108.05] | 89.12 [83.28, 111.09] | 0.516 [0.508, 0.517] |
| javascript | 3 | 1.26 [1.26, 1.41] | 1.65 [1.57, 1.71] | 2.98 [2.84, 3.05] | 112.73 [107.61, 115.85] | 115.78 [110.59, 118.69] | 0.518 [0.517, 0.518] |
| jsx | 3 | 1.15 [0.98, 1.25] | 1.41 [1.18, 1.52] | 2.44 [2.39, 2.67] | 86.28 [82.76, 99.64] | 88.67 [85.20, 102.30] | 0.519 [0.510, 0.519] |
| json | 3 | 0.09 [0.08, 0.10] | 0.55 [0.51, 0.95] | 0.63 [0.59, 1.04] | 6.91 [6.22, 9.37] | 7.53 [6.82, 10.41] | 0.060 [0.060, 0.060] |
| shellscript | 3 | 0.37 [0.36, 0.44] | 0.94 [0.84, 1.10] | 1.29 [1.28, 1.46] | 47.72 [38.44, 50.49] | 49.19 [39.71, 51.78] | 0.222 [0.222, 0.222] |
| python | 3 | 0.67 [0.53, 0.75] | 1.59 [1.39, 1.69] | 2.26 [1.92, 2.44] | 37.58 [33.48, 41.05] | 39.84 [35.40, 43.48] | 0.353 [0.353, 0.363] |
| diff | 3 | 0.08 [0.08, 0.08] | 0.71 [0.63, 0.76] | 0.79 [0.71, 0.84] | 11.08 [10.90, 11.43] | 11.78 [11.73, 12.22] | 0.051 [0.051, 0.051] |
| yaml | 3 | 0.20 [0.18, 0.21] | 0.84 [0.72, 1.02] | 1.04 [0.90, 1.23] | 16.36 [12.77, 17.40] | 17.40 [13.67, 18.62] | 0.095 [0.095, 0.095] |
| markdown | 3 | 0.45 [0.39, 0.56] | 1.21 [0.89, 1.46] | 1.67 [1.28, 2.02] | 28.04 [22.99, 31.66] | 30.06 [24.27, 33.33] | 0.320 [0.320, 0.320] |
| rust | 3 | 0.24 [0.21, 0.25] | 0.74 [0.69, 0.97] | 0.95 [0.93, 1.22] | 18.01 [14.97, 18.58] | 18.96 [15.90, 19.81] | 0.116 [0.116, 0.537] |
| go | 3 | 0.48 [0.39, 0.51] | 1.34 [1.03, 1.34] | 1.82 [1.42, 1.86] | 53.66 [50.08, 55.35] | 55.09 [51.93, 57.16] | 0.263 [0.263, 0.274] |
| html | 3 | 2.43 [1.84, 2.47] | 2.62 [2.59, 3.05] | 5.05 [4.44, 5.52] | 220.00 [215.54, 232.93] | 225.05 [219.98, 238.45] | 0.887 [0.887, 0.887] |
| css | 3 | 0.38 [0.37, 0.45] | 1.28 [0.89, 1.50] | 1.73 [1.26, 1.88] | 81.73 [78.91, 94.94] | 83.46 [80.17, 96.81] | 0.205 [0.205, 0.205] |
| sql | 3 | 0.16 [0.15, 0.19] | 0.71 [0.64, 0.86] | 0.90 [0.80, 1.01] | 59.33 [54.96, 65.39] | 60.22 [55.76, 66.40] | 0.102 [0.102, 0.102] |
| toml | 3 | 0.18 [0.12, 0.19] | 0.78 [0.73, 0.79] | 0.96 [0.84, 0.97] | 11.94 [9.38, 14.96] | 12.91 [10.22, 15.93] | 0.075 [0.075, 0.075] |
| docker | 3 | 0.08 [0.07, 0.08] | 0.67 [0.65, 0.67] | 0.74 [0.73, 0.75] | 7.80 [6.89, 9.59] | 8.53 [7.63, 10.33] | 0.052 [0.052, 0.052] |
| powershell | 3 | 0.21 [0.19, 0.23] | 0.78 [0.74, 1.02] | 0.97 [0.96, 1.24] | 48.15 [44.88, 53.97] | 49.39 [45.84, 54.94] | 0.137 [0.137, 0.137] |

## GC 后全进程内存（MiB）

| 进程/首请求 | GC 后阶段 | n | rss MiB | heapUsed MiB | external MiB | arrayBuffers MiB |
| --- | --- | --- | --- | --- | --- | --- |
| eager/typescript | idle | 10 | 86.391 [85.703, 86.766] | 18.264 [18.263, 18.264] | 2.081 [2.081, 2.081] | 0.131 [0.131, 0.131] |
| eager/typescript | first | 10 | 121.406 [120.609, 123.531] | 26.083 [26.071, 26.088] | 2.081 [2.081, 2.081] | 0.131 [0.131, 0.131] |
| eager/typescript | all | 10 | 169.719 [168.531, 171.172] | 37.522 [37.507, 37.542] | 2.081 [2.081, 2.081] | 0.131 [0.131, 0.131] |
| eager/markdown | idle | 10 | 86.375 [85.922, 86.953] | 18.264 [18.264, 18.264] | 2.081 [2.081, 2.081] | 0.131 [0.131, 0.131] |
| eager/markdown | first | 10 | 156.359 [151.172, 165.703] | 31.199 [31.164, 31.202] | 2.081 [2.081, 2.081] | 0.131 [0.131, 0.131] |
| eager/markdown | all | 10 | 170.188 [169.922, 170.953] | 37.272 [37.254, 37.296] | 2.081 [2.081, 2.081] | 0.131 [0.131, 0.131] |
| group/typescript | idle | 10 | 61.148 [60.063, 61.594] | 9.996 [9.996, 9.996] | 1.911 [1.911, 1.911] | 0.131 [0.131, 0.131] |
| group/typescript | first | 10 | 91.109 [90.328, 91.516] | 14.797 [14.791, 14.799] | 1.911 [1.911, 1.911] | 0.131 [0.131, 0.131] |
| group/typescript | all | 10 | 160.180 [159.109, 162.281] | 29.326 [29.241, 29.355] | 1.911 [1.911, 1.911] | 0.131 [0.131, 0.131] |
| group/markdown-group | idle | 10 | 61.297 [60.984, 61.594] | 9.996 [9.996, 9.996] | 1.911 [1.911, 1.911] | 0.131 [0.131, 0.131] |
| group/markdown-group | first | 10 | 121.867 [121.203, 123.016] | 22.441 [22.430, 22.459] | 1.911 [1.911, 1.911] | 0.131 [0.131, 0.131] |
| group/markdown-group | all | 10 | 159.203 [157.484, 159.609] | 28.968 [28.953, 28.998] | 1.911 [1.911, 1.911] | 0.131 [0.131, 0.131] |

同一进程内 heap delta：

| 模型 | GC 后 first-idle heap delta MiB | GC 后 all-idle heap delta MiB |
| --- | --- | --- |
| eager/typescript | 7.819 [7.808, 7.825] | 19.258 [19.243, 19.278] |
| group/typescript | 4.801 [4.795, 4.803] | 19.329 [19.245, 19.359] |
| eager/markdown | 12.935 [12.900, 12.938] | 19.008 [18.990, 19.032] |
| group/markdown-group | 12.445 [12.434, 12.463] | 18.972 [18.957, 19.001] |

不含 markdown 的 TS 单语种样例：模型对 eager 的配对 heap delta 差为 -3.018 [-3.024, -3.004] MiB，即约 3.02 MiB 更少；active init 差 -31.84 [-37.61, -23.55] ms，即约 31.84 ms 更少。其 first request 差 -38.31 [-71.10, 64.15] ms，但 group A/A 最大差 95.43 ms，方向/量级不稳定，首次延迟收益不判定。这只是该 Node 离线样例的 Shiki 操作保留堆/初始化潜力，不是任意多语言会话收益或 daemon 内存读数。

含 markdown 的同一 fenced 样例：配对 heap delta 差 -0.475 [-0.503, -0.455] MiB，即约 0.48 MiB 更少；active init 差 -0.76 [-15.20, 5.70] ms，首请求差 15.93 [-66.54, 46.13] ms，均没有超出当前耗时 A/A 差异，不能认定初始化/延迟收益。先加载 16/18 grammar 几乎回到 eager；全部 18 grammar 使用后，操作 heap delta 约 19 MiB，模型和 eager 接近，没有全量会话的持续节省证据。未测 daemon RSS 收益，不能将这些离线 delta 宣传为 daemon 节省。

## Session dispersion

default=只分析 assistant 的代码块，工具与 reasoning 卡片保持默认折叠；expanded=所有工具/reasoning/code 展开，依 fixture event 顺序取第一次有效 hint，完成 fence 才算请求，diff 主/正文各解析一次。使用真实 classifier、lexer 与 handler resolver（run.mjs:31、:38、:64）。这是确定性提取模型，无 UI 渲染/真实 RPC 时序；真实分组加载导致的首绘无色事件按任务定义为“首次使用尚未加载语言/组”。每个新内容的既有 RPC/cache miss 自身也可能先无色，**实际无色帧数未观测**。

每个 fixture 的完整逐请求记录/原始 SHA256 在 raw/sessions.json。“sum range”是各孤立测量 min/max 的求和包络，**不是实际会话耗时分布**；median 列为各语言 medians 求和。语言样例不是 fixture 原始 code，含 token 求和只供成本拆解。当前集合没有 html/markdown overlap，未重复计硬依赖；若未来组内部分 grammar 已加载，不能直接把孤立组全成本代入。无请求会话两边成本为零，不能归纳为 P4 收益。

| fixture | 展开模式 | 首次使用语言顺序 | 今天单次 init ms | lazy grammar init 求和 ms | lazy 含公共 base ms | lazy first-load 含 token 求和 ms | 加载事件 eager→lazy |
| --- | --- | --- | --- | --- | --- | --- | --- |
| codeblock-streaming | default | typescript → python → diff → rust | 40.60 [33.79, 46.09] | 6.39 [5.64, 8.16] | 11.39 [9.86, 20.89] | 216.09 [184.72, 308.87] | 1 → 4 |
| codeblock-streaming | expanded | typescript → python → diff → rust | 40.60 [33.79, 46.09] | 6.39 [5.64, 8.16] | 11.39 [9.86, 20.89] | 216.09 [184.72, 308.87] | 1 → 4 |
| diff-large | default | 无 | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0 → 0 |
| diff-large | expanded | diff → tsx | 40.60 [33.79, 46.09] | 3.17 [3.03, 3.88] | 8.17 [7.24, 16.61] | 100.90 [95.02, 123.31] | 1 → 2 |
| history-100 | default | typescript | 40.60 [33.79, 46.09] | 2.39 [2.09, 3.67] | 7.39 [6.30, 16.40] | 145.51 [121.68, 233.36] | 1 → 1 |
| history-100 | expanded | diff → typescript | 40.60 [33.79, 46.09] | 3.17 [2.79, 4.50] | 8.18 [7.01, 17.24] | 157.29 [133.41, 245.58] | 1 → 2 |
| markdown-long | default | 无 | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0 → 0 |
| markdown-long | expanded | 无 | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0 → 0 |
| mixed-turn | default | 无 | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0 → 0 |
| mixed-turn | expanded | typescript → diff | 40.60 [33.79, 46.09] | 3.17 [2.79, 4.50] | 8.18 [7.01, 17.24] | 157.29 [133.41, 245.58] | 1 → 2 |
| reads-20 | default | 无 | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0 → 0 |
| reads-20 | expanded | typescript | 40.60 [33.79, 46.09] | 2.39 [2.09, 3.67] | 7.39 [6.30, 16.40] | 145.51 [121.68, 233.36] | 1 → 1 |
| reasoning-long-prose | default | 无 | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0 → 0 |
| reasoning-long-prose | expanded | 无 | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0 → 0 |
| reasoning-long-sections | default | 无 | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0 → 0 |
| reasoning-long-sections | expanded | 无 | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0 → 0 |
| shell-log-large | default | 无 | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0 → 0 |
| shell-log-large | expanded | 无 | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0 → 0 |
| table-streaming | default | 无 | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0 → 0 |
| table-streaming | expanded | 无 | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0 → 0 |
| tool-expanded-streaming | default | 无 | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0 → 0 |
| tool-expanded-streaming | expanded | 无 | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 0 → 0 |

markdown-start 的补充场景：加载 markdown-group 后，上述 15 种的后续 first-use 没有新加载事件；若后来还用 jsx/toml，最多再各 1 次，合计最多 3 次。没有该场景的 stream fixture，不伪造 session 实测；其 first-load/heap 用表中同样例模型数据。

## 当前离线 A/A（5 对）

| 模型/指标 | 5 对差值 B−A（绝对单位；相对百分比） | 最大绝对差 |
| --- | --- | --- |
| eager/typescript / firstHighlightMs | 22.646 ms (12.45%); 40.094 ms (24.88%); 29.766 ms (17.99%); 9.891 ms (5.38%); 46.207 ms (29.32%) | 46.207 ms |
| eager/typescript / buildEngineMs | 6.133 ms (15.35%); -1.318 ms (-3.72%); 7.376 ms (20.51%); 3.963 ms (9.61%); 9.265 ms (27.42%) | 9.265 ms |
| eager/typescript / heapFirstDelta | 0.017 MiB (0.22%); 0.014 MiB (0.18%); -0.001 MiB (-0.01%); 0.000 MiB (0.00%); -0.000 MiB (-0.01%) | 0.017 MiB |
| eager/typescript / heapAllDelta | 0.036 MiB (0.19%); 0.013 MiB (0.07%); 0.018 MiB (0.09%); 0.000 MiB (0.00%); -0.003 MiB (-0.01%) | 0.036 MiB |
| group/typescript / firstHighlightMs | -95.431 ms (-38.78%); -3.115 ms (-2.02%); 41.121 ms (32.56%); 17.547 ms (12.66%); -8.726 ms (-6.17%) | 95.431 ms |
| group/typescript / heapFirstDelta | -0.002 MiB (-0.05%); -0.000 MiB (-0.00%); -0.001 MiB (-0.03%); 0.000 MiB (0.00%); 0.006 MiB (0.12%) | 0.006 MiB |
| group/typescript / heapAllDelta | 0.115 MiB (0.60%); 0.012 MiB (0.06%); 0.015 MiB (0.08%); -0.013 MiB (-0.07%); 0.044 MiB (0.23%) | 0.115 MiB |
| eager/markdown / firstHighlightMs | -82.083 ms (-21.91%); -10.004 ms (-3.06%); 24.037 ms (8.31%); 73.338 ms (23.83%); -34.959 ms (-10.34%) | 82.083 ms |
| eager/markdown / buildEngineMs | -10.183 ms (-23.19%); -2.958 ms (-7.50%); 3.026 ms (8.58%); 10.557 ms (24.17%); -2.971 ms (-7.36%) | 10.557 ms |
| eager/markdown / heapFirstDelta | 0.002 MiB (0.02%); -0.026 MiB (-0.20%); 0.014 MiB (0.11%); -0.022 MiB (-0.17%); -0.001 MiB (-0.01%) | 0.026 MiB |
| eager/markdown / heapAllDelta | -0.024 MiB (-0.12%); 0.002 MiB (0.01%); 0.015 MiB (0.08%); 0.001 MiB (0.01%); 0.002 MiB (0.01%) | 0.024 MiB |
| group/markdown-group / firstHighlightMs | -22.485 ms (-6.79%); 85.978 ms (31.80%); -35.437 ms (-10.88%); -39.333 ms (-11.12%); -42.406 ms (-11.73%) | 85.978 ms |
| group/markdown-group / heapFirstDelta | -0.011 MiB (-0.09%); -0.015 MiB (-0.12%); -0.013 MiB (-0.10%); 0.000 MiB (0.00%); -0.002 MiB (-0.01%) | 0.015 MiB |
| group/markdown-group / heapAllDelta | 0.014 MiB (0.07%); -0.019 MiB (-0.10%); -0.012 MiB (-0.07%); -0.021 MiB (-0.11%); -0.025 MiB (-0.13%) | 0.025 MiB |

这是本轮同运行时离线 A/A，未借用历史噪声。耗时差异在 5 对后仍有方向/量级不稳定，尤其 markdown 与 group TS first request，按 §5 只报告，不进行交付收益判定；宿主/daemon A/A 完全未执行。

# Recommendation with the rule check

**STOP Phase 2**。语法 registration/init 求和在这些无 markdown session 模型中没有明确变差（例如 codeblock-streaming 含 base 11.39 [9.86, 20.89] ms，对 today 40.60 [33.79, 46.09] ms）；然而任务/计划是 **耗时之和或首次无色加载事件任一明显变差就停**：codeblock-streaming 的加载事件 1→4，展开后的 diff-large/history-100/mixed-turn 是 1→2，触发确定性事件止损。单语言 TS 的潜在 heap/init 改善不足以抵消该条件，也不能证明宿主首绘改善。

含 markdown 的会话更无充分理由推进：16/18 grammar 必须一次加载，约 0.48 MiB 离线保留堆差，初始化/首次延迟差落在 A/A 范围；不含高亮的会话今天已不初始化。没有客户端 bundle 或网络收益声明，动态 import 在同一 bundle 仅推迟执行。

# Validation (commands → exit codes)

| 命令 | exit code | 结果 / raw log |
| --- | --- | --- |
| npm ci | 0 | 413 packages installed; package files unchanged / raw/npm-ci.log |
| npm run typecheck (baseline) | 0 | c8ed5c7 / raw/baseline-0.log |
| npm test -- --reporter=dot (baseline) | 0 | 91 files / 1110 tests / raw/baseline-1.log |
| npm run check:hermes | 0 | compile + stock/sticky host evaluation / raw/baseline-2.log |
| node .showcase/tools/bundle-size.mjs | 0 | 842214 bytes / gzip 194447 bytes / raw/baseline-3.log |
| node docs/bench/2026-10-14-p4/baseline.mjs --write | 0 | 36 loaded entries / 192 resolver cases / 56 outputs / raw/baseline-generate.log |
| npm run typecheck (with new test) | 0 | new test included / raw/final-typecheck.log |
| npm test -- --reporter=dot test/unit/p4-highlight-equivalence.test.ts | 0 | 249 tests / raw/equivalence-test.log |
| node docs/bench/2026-10-14-p4/baseline.mjs --verify | 0 | exact golden equality |
| npm test -- --reporter=dot (final) | 0 | 92 files / 1359 tests / raw/final-test.log |
| node docs/bench/2026-10-14-p4/run.mjs | 0 | 91 cold processes, 22 fixture scenarios; final isolated run / raw/measurements.log |
| node docs/bench/2026-10-14-p4/summarize.mjs | 0 | summary.json |
| node docs/bench/2026-10-14-p4/verify-model.mjs | 0 | uninstrumented handler + 16-grammar markdown model equivalent / raw/verify-model.log |

基线检查完成后 git diff --exit-code 为 0；最终仍无 tracked source/package 修改，仅三个授权位置的新增内容。npm ci 的已有依赖审计警告、React renderer/act 警告保留在 raw 日志，没有进行依赖修复。

# Remaining

- 按任务要求 Phase 1 后停止；不实现 index.server.ts lazy loading，不创建 commit。
- 生产 daemon、宿主真实 RPC/首绘、Web/iOS/Android、网络、真实设备、多连接与生产包加载均未验证，也未获本阶段授权；离线全进程 memoryUsage 不能替代 daemon 实测。
- 并发加载 memo/失败重试/加载顺序的 lazy 实现测试属于 Phase 2，本阶段只有 eager 等价性 golden；如父级日后决定重新开 Phase 2，须新增这些实现专属用例并保持 fixture 不变。
- raw/exploratory-overlapping.log 是已排除的探索运行（与验证进程重叠），不进入任何 summary。最终 91 cold runs 顺序执行，未并行运行本任务的测试/编译；系统仍有其他负载，loadavg 已逐次记录。
- 复跑：先 npm ci；node docs/bench/2026-10-14-p4/baseline.mjs --verify；npm test -- --reporter=dot test/unit/p4-highlight-equivalence.test.ts；待测试退出后 node docs/bench/2026-10-14-p4/run.mjs；node docs/bench/2026-10-14-p4/summarize.mjs；node docs/bench/2026-10-14-p4/write-report.mjs。--write 只用于首次冻结当前 eager golden，Phase 2 不应重生成。

原始数据：docs/bench/2026-10-14-p4/raw/{environment,grammar-metadata,cold-runs,sessions,summary,validation}.json；测试 golden：test/fixtures/p4-highlight/eager.json；阶段报告：/tmp/bc-perf-p4/phase1-report.md。
