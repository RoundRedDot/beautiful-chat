# Paseo 原生渲染 vs 本仓库 fork 插件

问题：装上本仓库的 better-paseo 之后，和不装插件、直接用 Paseo 0.11.2 内置渲染相比，性能是好是坏。2026-10-13 又把 Beautiful Chat `42b61d8` 放进同一次会话。

场景沿用 [`docs/fork-vs-upstream.md`](../../fork-vs-upstream.md) 的 11 个回放 fixture，速度也相同：其余 1，`history-100` max，`tool-expanded-streaming` 4。平台同样分两边：Web 生产构建和 iOS 模拟器开发版。下面 §3–§5 是 2026-10-12 的记录（当时的插件是 `c00be20` 到 `1ec3458` 一带）。**当前数字在 §9**（2026-10-14，rrd-mac-studio，Web 和 iOS 都是三方）。§8 是 2026-10-13 的 Web 三方，插件 `2146289`，跑在负载很高的 M5 Pro 上，秒数不能和 §9 对读。

## 结论

2026-10-14 在 rrd-mac-studio（Apple M5 Max，1 分钟负载大约 0.8–1.7）上的三方复测在 §9。机器和早前几轮的 M5 Pro 笔记本不同，秒数不能和 §3–§8 对读，只比较这一轮内部的三种模式。

Web：11 个场景里 10 个主线程时间短于不开插件（14–38%）。大 diff 整段 0.41 秒对 0.31 秒，两边都不到半秒，记为持平。11 个都短于 Beautiful Chat（12–91%）。先回收再读的 JS 堆，长回复少 40.8MB，其余场景和不开插件相差 −1.4 到 +4.0MB。Beautiful Chat 在大 diff、100 轮历史、读 20 个文件上是 213.6–242.6MB。

iOS 这一轮三方都用宿主探针。早前那张卡片内部探针的表不能在 Beautiful Chat 上重测。行渲染总量上，相对不开插件 5 个更短（15–64%）、2 个持平（大 diff、100 轮历史）、4 个更长（18–63%）。相对 Beautiful Chat，11 个都更短（12–99%）。`history-100` 的单次提交 p95 不能比：不开插件把 50 次行渲染打进 5 次提交，Beautiful Chat 把 182 次打进 125 次提交，本仓库把 90 次打进 17 次提交。比的是渲染总量，200.1 / 230.6 / 202.9 ms。

下面几条是 10 月 12 日、还没有 Beautiful Chat 这一列时的记录。10 月 13 日的 Web 三方表留在 §8，插件当时是 `2146289`。

- **每一行渲染一次的代价，fork 更低。** Web 上 11 个场景里，有 10 个的行渲染 p95 降了 33–88%，剩下的 `history-100` 持平。iOS 上，8 个场景的「单次提交里所有行之和」p95 降了 15–86%。纯文本流式（长回复、代码块、表格、思考）收益最大：Web 主线程 CPU 降 7–53%，iOS 上长回复单次提交 p95 从 59ms 降到 8ms。
- **Web 上有一处倒退，已修：运行中的那个圆点。** 它用 React Native 的 `Animated`，Web 上没有 native driver，每一帧都触发一次 React 提交。工具和待办较多的场景因此比原生多花 20–38% 的主线程时间：`mixed-turn` +38%，`shell-log-large` +22%，`tool-expanded-streaming` +33%，`history-100` +20%。打开「减少动态效果」让圆点静止后，这几项全都降到原生以下（−2% 到 −37%），归因因此确认。`58f6728` 在 Web 上把圆点改成 CSS 动画；修复后在 `main` 上重跑了两轮。第一轮 10 个场景的主线程时间低于原生，`history-100` 多 8%；第二轮（`de7c0d3`）11 个全部低于原生，`history-100` 少 10%，视为持平，见 §4。
- **iOS**：补到 6 次后，`history-100` 与原生持平（82.5 对 82.6ms）。`shell-log-large` 的单次提交 p95 多 23%，但行渲染的总量相当，只是集中到了一次提交里，见 §5.3。
- **内存（§4.3，先回收再读）**：JS 堆和原生基本一样（多 0–4MB），长回复少 41MB；DOM 节点除 `history-100` 多 1% 外都更少或持平。
- **Web 的布局偏移，已修。** 修前的累计值约为原生的两倍：长回复 0.41 对 0.20，代码块 0.087 对 0.040。原因不是按批次出字：回复要晚一次提交才长高，错过了宿主当次提交里的贴底。`1ec3458` 修复后，长回复降到 0，代码块降到 0.012，都低于原生，见 §4.4。

## 1. 为什么不能直接沿用 `/bc-perf`

`/bc-perf` 的探针埋在插件卡片里。关掉插件后，Paseo 自己画的行上没有探针，两边也就不在同一个口径上。这次把探针放在**宿主**：给 Paseo 0.11.2 打了一个只用于测量的补丁（[`tools/paseo-host-probe.patch`](tools/paseo-host-probe.patch)），不改界面：

| 探针 | 做法 | 两边是否同口径 |
|---|---|---|
| 行渲染耗时 | `agent-stream/view.tsx` 的 `StreamItemWrapper` 里，每一行（原生或插件）外面套一个 `React.Profiler`。记录 `actualDuration`（这一行子树在这次提交里的渲染耗时），按种类归并：user / assistant / reasoning / tool / todo | 是。插件行和原生行套的是同一个外壳 |
| 单次提交合计 | 同一次 React 提交里所有行的 `actualDuration` 相加 | 是 |
| 帧 | rAF 计帧，和插件 `store.ts` 的口径相同：超过 1.5 倍帧间隔算掉帧，超过 1s 的间隔算页面挂起、不计 | 是 |
| Web 主线程 CPU | Playwright 读 CDP `Performance.getMetrics`，取回放前后的差值：`TaskDuration`、`ScriptDuration`、`LayoutDuration` + `RecalcStyleDuration` | 是 |
| Web 长任务、布局偏移、JS 堆、DOM 节点 | `PerformanceObserver`、CDP `JSHeapUsedSize`、`Nodes` | 是 |

Web 生产构建默认不跑 `<Profiler>`。补丁让 Metro 在构建时设置 `BC_REACT_PROFILING=1`，把 `react-dom/client` 换成 React 自带的 `react-dom/profiling`，这一项对两边一样。

`fork-vs-upstream.md` 性能一节里标成当前的表和这里 §9 是同一套宿主探针。那份文档里留作历史的 10 月 13 日表和这里 §8 是更早的一套。那份文档后半段的卡片内部探针测的是「开始渲染 → layout effect」，和这里的行外壳不是同一个口径，毫秒数不能直接比。Web 上的 `Profiler` 计时精度是 0.1ms（Chrome 不在跨源隔离环境下会把 `performance.now()` 截到 100µs），所以 0 和 0.1 之间的差别没有意义。

## 2. 环境

| | |
|---|---|
| 机器 | Apple M5 Pro，macOS 27.0.1。**同时有其他 agent 在跑，负载 11–17**，所以按场景交替两种模式（ABBA）、取中位数 |
| daemon | 单独的 `~/.paseo-bench-ab`（127.0.0.1:6869，0.11.2），只装 `bc-bench` 和本仓库 `c00be20` 的 worktree。两种模式只差 `paseo plugin enable/disable better-paseo`；插件设置都是默认值（增强提问气泡关，所以两边的用户消息都是 Paseo 自己画的） |
| 插件 | §3、§5 是 `c00be20`；§4.2 是 `main` `724c96f`（修前），加 `58f6728`（修后） |
| 宿主 | Paseo `759532509`（v0.11.2）加探针补丁，worktree 在 `paseo/.worktrees/bc-native-perf`（分支 `bench/native-vs-fork`） |
| Web | `expo export --platform web` 生产构建，headless Chrome 155.0.8059.40，1280×900，`zh-CN`。**每个场景每种模式 3 次**，取中位数，每次重新加载页面 |
| iOS | 新建的 iPhone 16 Pro 模拟器 `bc-native-ab`（iOS 18.6），Paseo 0.11.2 **开发版**，JS 由 Metro 提供（8085）。**每次运行前都冷启动 App**，每个场景每种模式 2 次，`mixed-turn` 4 次。开发版的绝对毫秒数只能做相对比较 |
| 原始数据 | `raw/web/*.json`（`c00be20`，66 次，另有 12 次减少动态效果），`raw/web-fix/*.json`（`main` `724c96f`：修前的 fork 12 次，修后的 fork 和原生各 33 次），`raw/web-gc/*.json`（`de7c0d3`，66 次，先回收再读内存），`raw/ios/*.json`（`c00be20`，48 次）。每个平台每种模式只留一张 `mixed-turn` 截图 |

## 3. Web（生产构建，3 次取中位数）

单元格是 `原生 → fork`，百分比是 fork 相对原生的变化，负数表示 fork 更快或更少。本节是 `c00be20`，还没有修圆点；修复后的数字在 §4.2。

### 3.1 主线程 CPU（秒，整段回放）

| 场景 | Task | | Script | | Layout+Style | |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| codeblock-streaming | 3.45 → 1.63 | −53% | 2.24 → 0.87 | −61% | 0.32 → 0.17 | −46% |
| diff-large | 0.38 → 0.40 | +7% | 0.13 → 0.18 | +38% | 0.05 → 0.03 | −24% |
| history-100 | 1.18 → 1.42 | +20% | 1.00 → 1.25 | +25% | 0.08 → 0.07 | −14% |
| markdown-long | 5.97 → 3.79 | −36% | 3.47 → 1.79 | −48% | 0.70 → 0.59 | −15% |
| mixed-turn | 1.17 → 1.62 | +38% | 0.47 → 0.79 | +66% | 0.17 → 0.14 | −17% |
| reads-20 | 1.02 → 0.74 | −28% | 0.51 → 0.37 | −27% | 0.17 → 0.07 | −55% |
| reasoning-long-prose | 2.27 → 1.80 | −21% | 1.22 → 0.93 | −23% | 0.19 → 0.15 | −22% |
| reasoning-long-sections | 1.76 → 1.64 | −7% | 0.95 → 0.85 | −11% | 0.15 → 0.12 | −20% |
| shell-log-large | 0.78 → 0.95 | +22% | 0.16 → 0.41 | +154% | 0.12 → 0.08 | −31% |
| table-streaming | 1.98 → 1.14 | −42% | 1.34 → 0.56 | −58% | 0.17 → 0.12 | −30% |
| tool-expanded-streaming | 1.14 → 1.51 | +33% | 0.38 → 0.75 | +100% | 0.15 → 0.11 | −24% |

Layout+Style 在 11 个场景里都是 fork 更低。Script 升高的 5 个场景，都是有工具或待办处于「运行中」的场景。

### 3.2 行渲染耗时（ms）与提交次数

| 场景 | 行 p50 | 行 p95 | | 行 max | 单次提交合计 p95 | | 行提交次数 | |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| codeblock-streaming | 1.3 → 0.3 | 2.5 → 0.9 | −64% | 5.5 → 5.0 | 2.5 → 0.9 | −64% | 871 → 467 | −46% |
| diff-large | 0 → 0.1 | 1.2 → 0.6 | −50% | 6.6 → 1.5 | 1.2 → 0.7 | −42% | 45 → 119 | +164% |
| history-100 | 0 → 0 | 0.3 → 0.3 | 0% | 10.5 → 4.9 | 12.3 → 7.2 | −41% | 4,308 → 5,460 | +27% |
| markdown-long | 0.7 → 0.2 | 1.4 → 0.6 | −57% | 3.9 → 7.6 | 1.9 → 0.6 | −68% | 1,975 → 809 | −59% |
| mixed-turn | 0.4 → 0.1 | 1.5 → 0.2 | −87% | 7.0 → 2.1 | 2.6 → 0.3 | −88% | 267 → 1,510 | +466% |
| reads-20 | 0.2 → 0.1 | 1.6 → 0.4 | −75% | 9.9 → 1.2 | 2.8 → 0.7 | −75% | 280 → 490 | +75% |
| reasoning-long-prose | 0.5 → 0.1 | 0.7 → 0.3 | −57% | 7.8 → 1.3 | 0.7 → 0.3 | −57% | 826 → 1,264 | +53% |
| reasoning-long-sections | 0.4 → 0.1 | 0.6 → 0.3 | −50% | 7.8 → 1.3 | 0.6 → 0.3 | −50% | 764 → 1,093 | +43% |
| shell-log-large | 0 → 0.1 | 1.7 → 0.2 | −88% | 5.9 → 0.9 | 2.2 → 0.2 | −91% | 44 → 603 | +1270% |
| table-streaming | 1.2 → 0.3 | 1.8 → 0.9 | −50% | 3.6 → 2.3 | 1.8 → 0.9 | −50% | 649 → 271 | −58% |
| tool-expanded-streaming | 0 → 0.1 | 0.3 → 0.2 | −33% | 6.2 → 1.3 | 0.6 → 0.3 | −50% | 315 → 1,217 | +286% |

单行更便宜，但工具场景里的提交次数多了好几倍。`mixed-turn` 的待办行在原生上提交 15 次，在 fork 上提交 918 次，`shell-log-large` 的工具行从 7 次变成 576 次。单次只有 0.1–0.2ms，但累积起来就是 3.1 里多出的 Script 时间。

### 3.3 帧、长任务、布局偏移、内存

这张表里的 JS 堆和 DOM 节点是在没有强制回收的情况下读的，受 GC 时机影响很大，不要再引用。回收之后的数字见 §4.3。

| 场景 | 掉帧 % | 最长帧 ms | 长任务合计 ms | 布局偏移 | JS 堆 MB | DOM 节点 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| codeblock-streaming | 0.1 → 0.1 | 33 → 33 | 0 → 0 | 0.045 → 0.084 | 128 → 132 | 2,746 → 3,240 |
| diff-large | 0 → 0.4 | 17 → 33 | 0 → 0 | 0 → 0 | 193 → 124 | 2,156 → 991 |
| history-100 | 19.4 → 22.3 | 183 → 183 | 415 → 231 | 0 → 0 | 270 → 251 | 11,517 → 10,663 |
| markdown-long | 0.1 → 0.1 | 33 → 33 | 0 → 0 | 0.208 → 0.409 | 175 → 143 | 4,844 → 4,822 |
| mixed-turn | 0.4 → 0.2 | 50 → 33 | 56 → 0 | 0.012 → 0.021 | 125 → 127 | 1,431 → 1,386 |
| reads-20 | 0.4 → 0.4 | 50 → 33 | 0 → 0 | 0.002 → 0.011 | 141 → 127 | 1,541 → 1,440 |
| reasoning-long-prose | 0.3 → 0.8 | 50 → 167 | 0 → 0 | 0.001 → 0.002 | 122 → 126 | 1,057 → 979 |
| reasoning-long-sections | 0.1 → 0.2 | 33 → 33 | 0 → 0 | 0 → 0.001 | 122 → 123 | 1,051 → 981 |
| shell-log-large | 0.1 → 0 | 33 → 17 | 0 → 0 | 0 → 0 | 121 → 127 | 1,056 → 1,052 |
| table-streaming | 0.1 → 0.2 | 33 → 33 | 0 → 0 | 0.050 → 0.046 | 160 → 124 | 2,338 → 1,467 |
| tool-expanded-streaming | 0 → 0.1 | 17 → 33 | 0 → 0 | 0 → 0 | 142 → 126 | 1,122 → 986 |

除 `history-100` 外，两边在 Web 上都几乎不掉帧，差别在 1 个百分点以内。`history-100` 是最大速度回放，两边都掉大约 20%，但 fork 的长任务合计少了 44%。`diff-large` 和 `table-streaming` 的 DOM 节点和堆明显更少，因为 fork 默认把 diff 折叠起来，表格的节点也更少。

## 4. 归因：Web 上的运行中圆点

`client/ui/running-dot.tsx` 用 `Animated.loop` 驱动透明度。iOS/Android 上走 native driver；Web 上没有，React Native Web 每一帧都重新渲染这个 `Animated.View`，所在的行也跟着提交一次。

验证方法：用 Chrome 模拟 `prefers-reduced-motion: reduce`，插件会把圆点画成静止的，再把这四个场景各跑 3 次（`raw/web/web-forkrm-*`）：

| 场景 | 行提交次数 fork → fork（减少动态效果） | Task 秒：原生 / fork / fork（减少动态效果） |
| --- | ---: | ---: |
| mixed-turn | 1,510 → 201 | 1.17 / 1.62 / **0.74** |
| shell-log-large | 603 → 39 | 0.78 / 0.95 / **0.49** |
| tool-expanded-streaming | 1,217 → 409 | 1.14 / 1.51 / **0.78** |
| history-100 | 5,460 → 5,227 | 1.18 / 1.42 / **1.17** |

圆点静止后，fork 在这四个场景里都不比原生慢，其中三个快 31–37%。

### 4.1 修法

`58f6728`：Web 上的圆点是普通 `View`，用 `StyleSheet.create` 里的 `animationKeyframes` 让 React Native Web 编译出 `@keyframes`。周期 1200ms，透明度 1 → 0.3 → 1，每半程 `cubic-bezier(0.33, 1, 0.68, 1)`，和原来的 `outCubic` 一致。这个属性只能写在 `StyleSheet.create` 里，写成内联样式不生效。iOS/Android 仍走 native driver。减少动态效果时圆点静止。在真实的 Web 构建里确认过：圆点的 `animationName` 是编译出来的类名，`1.2s infinite`，计算出的透明度在 0.30 和 1.00 之间循环。

### 4.2 修复后重跑（`main` `724c96f`，Web 生产构建，每格 3 次）

分两批跑。第一批是修前的 `main`，只跑四个场景；第二批是修后的 `main`，跑全部 11 个。两批都和原生交替跑，但第二批的原生结果和第一批同名，把第一批的覆盖掉了，所以表里的原生数字都来自第二批。第一批期间机器负载一度到 30，所以修前和修后之间只比次数，不比毫秒。

| 场景 | 行提交次数：修前 → 修后（原生） | 主线程任务时间 秒：原生 → 修后 | |
| --- | ---: | ---: | ---: |
| codeblock-streaming | — | 4.18 → 2.12 | −49% |
| diff-large | — | 0.47 → 0.38 | −20% |
| history-100 | 5,624 → 5,763（5,270） | 1.76 → 1.90 | +8% |
| markdown-long | — | 7.27 → 4.80 | −34% |
| mixed-turn | 1,518 → 196（274） | 1.41 → 1.29 | −8% |
| reads-20 | — | 1.29 → 0.78 | −39% |
| reasoning-long-prose | — | 2.34 → 1.35 | −42% |
| reasoning-long-sections | — | 2.11 → 1.28 | −39% |
| shell-log-large | 604 → 38（43） | 0.89 → 0.74 | −17% |
| table-streaming | — | 2.89 → 1.39 | −52% |
| tool-expanded-streaming | 1,216 → 407（315） | 1.29 → 1.10 | −15% |

修复后，单行渲染 p95 在 10 个场景里低于原生，`tool-expanded-streaming` 是 0.3 → 0.4。修前的数字之所以显得更低，是因为大量 0.1ms 的圆点提交把分布往下拉了。

上一版这里写过 `reads-20` 在 `main` 上 DOM 涨了 74%、堆涨了 50%，这个结论是错的，已撤回。在 7 个提交点上二分，读数都在 1,440–1,537 个节点、130–138MB；偶尔有一次跑到 2,500 个节点、200MB，原生也会这样。原因是 CDP 的 `Nodes` 和 `JSHeapUsedSize` 会把还没回收的游离节点和垃圾也算进去，所以读数呈双峰。§4.3 改为先强制回收、再读数。

### 4.3 第三轮：当前 `main`，先回收再读内存（`de7c0d3`，每格 3 次）

`web-ab.mjs` 现在先读时间类指标，再调用 CDP `HeapProfiler.collectGarbage`，然后读 JS 堆和 DOM 节点；回收前的读数保留在 `cdp.beforeGc`。原始数据在 `raw/web-gc/`。

| 场景 | 主线程秒 | | 单行 p95 ms | JS 堆 MB | DOM 节点 |
| --- | ---: | ---: | ---: | ---: | ---: |
| codeblock-streaming | 3.65 → 1.91 | −48% | 2.7 → 1.2 | 123 → 122 | 2,559 → 2,139 |
| diff-large | 0.45 → 0.40 | −11% | 2.0 → 2.1 | 116 → 120 | 1,046 → 991 |
| history-100 | 1.86 → 1.68 | −10% | 0.6 → 0.3 | 124 → 126 | 1,780 → 1,797 |
| markdown-long | 6.97 → 4.67 | −33% | 1.6 → 0.7 | 165 → 124 | 4,716 → 2,835 |
| mixed-turn | 1.41 → 1.05 | −26% | 2.0 → 1.0 | 121 → 122 | 1,431 → 1,363 |
| reads-20 | 0.90 → 0.81 | −10% | 1.7 → 0.6 | 120 → 124 | 1,476 → 1,440 |
| reasoning-long-prose | 2.39 → 1.45 | −39% | 0.9 → 0.5 | 117 → 120 | 1,040 → 979 |
| reasoning-long-sections | 2.14 → 1.22 | −43% | 0.8 → 0.5 | 117 → 121 | 1,040 → 981 |
| shell-log-large | 0.86 → 0.61 | −29% | 1.7 → 1.5 | 117 → 121 | 1,047 → 986 |
| table-streaming | 2.35 → 1.45 | −38% | 2.0 → 1.2 | 121 → 122 | 1,496 → 1,214 |
| tool-expanded-streaming | 1.59 → 1.16 | −27% | 0.5 → 0.5 | 120 → 124 | 1,047 → 986 |

- 回收之后，同一格三次之间的堆读数相差不超过 3MB。DOM 节点在大多数格里三次完全相同。
- 11 个场景的主线程时间都低于原生。`history-100` 在 §4.2 是 +8%，这里是 −10%，两次都在一成以内，视为持平。
- JS 堆比原生多 0–4MB，大约是插件代码本身的大小；`markdown-long` 少了 41MB。
- 布局偏移和 §3.3 一致：`markdown-long` 0.203 → 0.408，`codeblock-streaming` 0.045 → 0.087。

### 4.4 布局偏移：回复晚一次提交才长高（`1ec3458`，每格 3 次，原始数据 `raw/web-shift/`）

`shift-sources.mjs` 会记录每一次 layout-shift 及其来源元素。在 `markdown-long` 上，插件和原生的偏移几乎都来自同一个元素，即底部「工作了 Ns」那一行（`turn-working-indicator`）：回复每长一截就把它往下推，宿主再把列表滚回底部。逐帧采样（`scrollHeight`、`scrollTop`、该行的 `top`）显示，插件的内容长高其实更平滑（单帧超过 150px 的增长只有 1 次，原生 23 次），但 253 次增长里有 211 次晚一帧才贴底，原生是 273 次里 133 次。

原因在宿主 `strategy-web.tsx`：当次贴底发生在 `segments` 变化的那次提交的 layout effect 里；ResizeObserver 触发的贴底则排到下一帧。插件在 Web 上不逐帧揭示（`ASSISTANT_REVEAL.web = false`），却仍把文本交给宿主的 `useRevealedText(text, "complete")`。这个 hook 遇到更长的文本时，先保留旧的可见长度，等 passive effect 里 `settle()` 之后再 `forceRender`，所以回复总是晚一次提交才长高。

也试过在 Web 上开启逐帧揭示：`markdown-long` 的布局偏移只从 0.410 降到 0.347，主线程时间却从 4.19s 涨到 6.00s，比原生（5.68s）还高（`raw/web-reveal/`），所以没有采用。

修法是：不揭示的回复直接画收到的文本，hook 只拿一个常量；收起的思考卡片也直接画文本。修复后整套 11 个场景重跑：

| 场景 | 布局偏移：原生 / 修前 / 修后 | 主线程秒：原生 → 修后 |
| --- | ---: | ---: |
| markdown-long | 0.203 / 0.408 / **0** | 5.68 → 3.60（−37%） |
| codeblock-streaming | 0.040 / 0.087 / **0.012** | 2.87 → 1.69（−41%） |
| table-streaming | 0.050 / 0.048 / **0.011** | 2.67 → 1.03（−62%） |
| mixed-turn | 0.042 / 0.021 / **0.008** | 1.14 → 0.91（−20%） |

其余场景两边的布局偏移都低于 0.01。主线程时间方面，9 个场景比原生省，`history-100` 持平（0%）。`reads-20` 这一轮是 +17%，但它整段只有 0.7–1.3 秒、单次波动更大，和 §4.3 的 6 次合起来中位数是 0.84 对 0.89，算持平。

### 4.5 工具行按到达时间排序（`tool-spacing` 分支，原始数据 `raw/web-wip/`）

宿主在工具调用完成时会把时间戳改成完成时刻，但它在时间线里的位置不变。插件原来用这个时间戳排序，来决定行间距。并行的几个 Read 中，先完成的一行会排到下一行之后，紧凑间距（−12pt）就在两行之间来回跳。改为每行记住首次出现时的时间之后，在 `main` 上对比（每格 3 次）：

| 场景 | 布局偏移 | 工具行提交 | 主线程秒 |
| --- | ---: | ---: | ---: |
| reads-20 | 0.0078 → 0.0029 | 245 → 212–232 | 0.92 → 0.63 |
| mixed-turn | 0.0079 → 0.0075 | 75 → 70 | 1.05 → 1.01 |
| history-100 | 0 → 0 | 持平 | 1.78 → 1.80 |
| shell-log-large | 0 → 0 | 持平 | 见下 |

`shell-log-large` 最初 6 轮里，改后的版本每轮都更慢（中位 0.71 对 0.56s）。但两边的布局次数、样式重算次数和 DOM 节点完全相同，各项耗时是等比例变长，按代码这个场景只会少做事。再交替补跑 8 对，中位数都是 0.43s，逐对比较 4 次高、3 次低、1 次相同，所以前 6 轮的差距按当时的机器负载处理。两次 CPU profile 里耗时最多的是 react-native-unistyles 的 `recreate`（每次增删样式都会重写整张 `<style>`），它属于宿主，单次波动在 25–73ms。`tools/cpu-profile.mjs` 可以按函数汇总自身耗时。

## 5. iOS（模拟器开发版，冷启动，2 次取中位数；`mixed-turn` 4 次）

### 5.1 行渲染耗时与单次提交

| 场景 | 行 p95 ms | | 单次提交合计 p95 ms | | 行渲染合计 ms | | 掉帧 % | 最长帧 ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| codeblock-streaming | 22.9 → 6.5 | −71% | 23.6 → 6.6 | −72% | 2,907 → 1,142 | −61% | 32.4 → 20.9 | 277 → 220 |
| diff-large | 8.5 → 5.2 | −39% | 13.5 → 6.1 | −55% | 57 → 47 | −18% | 5.1 → 4.8 | 158 → 157 |
| history-100 | 8.8 → 14.0 | +60% | 77.6 → 104.1 | +34% | 247 → 282 | +14% | 16.7 → 20.5 | 252 → 299 |
| markdown-long | 14.8 → 8.4 | −43% | 59.4 → 8.4 | −86% | 7,257 → 2,784 | −62% | 45.9 → 29.0 | 331 → 444 |
| mixed-turn | 9.6 → 5.3 | −44% | 16.0 → 7.5 | −53% | 382 → 236 | −38% | 8.6 → 7.7 | 162 → 229 |
| reads-20 | 8.0 → 4.5 | −44% | 16.3 → 8.7 | −46% | 433 → 344 | −20% | 15.2 → 16.1 | 195 → 195 |
| reasoning-long-prose | 4.9 → 2.4 | −51% | 4.1 → 4.3 | +6% | 360 → 391 | +9% | 9.1 → 9.7 | 172 → 205 |
| reasoning-long-sections | 4.6 → 1.8 | −60% | 4.6 → 3.9 | −15% | 309 → 301 | −2% | 8.4 → 8.6 | 242 → 200 |
| shell-log-large | 9.7 → 7.1 | −26% | 16.2 → 19.9 | +22% | 62 → 51 | −18% | 3.0 → 3.5 | 190 → 220 |
| table-streaming | 14.5 → 6.8 | −53% | 14.8 → 6.9 | −54% | 1,130 → 579 | −49% | 19.5 → 14.9 | 216 → 196 |
| tool-expanded-streaming | 5.6 → 1.9 | −66% | 5.6 → 3.1 | −44% | 226 → 188 | −16% | 3.1 → 6.0 | 242 → 187 |

### 5.2 `mixed-turn` 分卡片（4 次中位数，ms）

| 卡片 | 提交次数 | p50 | p95 | 合计 |
|---|---:|---:|---:|---:|
| 用户（两边都是 Paseo 气泡） | 5 → 5 | 0.60 → 0.56 | 3.1 → 2.9 | 6 → 5 |
| 助手 | 72 → 57 | 0.26 → 0.36 | 12.0 → 3.8 | 213 → 60 |
| 思考 | 37 → 43 | 1.22 → 0.70 | 10.0 → 3.4 | 75 → 47 |
| 工具 | 39 → 76 | 1.32 → 0.22 | 6.4 → 5.3 | 75 → 92 |
| 待办 | 11 → 10 | 0.01 → 0.34 | 4.8 → 11.1 | 13 → 33 |

iOS 上 fork 的长回复、代码块、表格几乎省掉一半以上的渲染时间。`history-100`（110 张卡片按最大速度一次塞进来）是唯一明显更差的：单次提交合计 p95 从 78ms 涨到 104ms，工具行渲染合计从 41ms 涨到 111ms。`mixed-turn` 的待办卡片 p95 也从 4.8ms 涨到 11.1ms。iOS 每格只有 2–4 个样本，十几个百分点的差距不足以下结论。

### 5.3 补测：`history-100` 和 `shell-log-large` 各 6 次（当前 `main`，`raw/ios-hist/`）

| 场景 | 单次提交合计 p95 | 行 p95 | 行渲染合计 | 工具行合计 | 掉帧 % |
| --- | ---: | ---: | ---: | ---: | ---: |
| history-100 | 82.6 → 82.5 | 9.5 → 7.5 | 228 → 176 | 39 → 79 | 14.8 → 15.3 |
| shell-log-large | 14.8 → 18.2 | 8.0 → 4.3 | 57 → 44 | 21 → 23 | 2.2 → 2.8 |

- `history-100`：6 次里两边各自在 74–191ms 之间波动，之前 2 次样本得出的 +34% 是噪声。插件工具行每次挂载后大约还会再提交一次（41 对 15 次提交），合计更高，但被其它行省下的抵消了。
- `shell-log-large`：原生 6 次都稳定在 14–16ms；插件有 4 次在 15–19ms，2 次是 28ms。工具行渲染的总量相当（中位 23 对 21ms），区别在于插件把工具完成时的重渲染集中到一次提交里（14–27ms），原生分在 4 次里（每次 2–11ms）。在 Hermes VM 里单测插件对这 64KB 输出的处理：`classifyTool` 和 `summarizeTool` 约 0ms，`stripAnsi` 0.7ms（完成状态下不会调用）。耗时在开发版 React 渲染这一行的组件树上，每个工具只发生一次，这次没有改。

## 6. 局限

- iOS 是模拟器上的开发版：React 开发检查都开着，绝对值偏大。Profiler 只覆盖 React 渲染阶段，不含 Fabric 挂载和原生布局；iOS 上也没有 CPU 总量这一项。
- 机器同时在跑其他任务。Web 每格 3 次、iOS 每格 2 次，只有 `mixed-turn` 是 4 次。帧指标的噪声最大。
- 没覆盖 Electron 桌面端本身，Web 生产构建是它的代理，和以前一样。也没覆盖真机。
- 插件设置用的是默认值。打开「增强的提问气泡」后，用户行也会交给插件来画，不在这次的范围内。

## 7. 复现

```bash
# 宿主：Paseo v0.11.2 + 探针
git -C ~/workspace/rrd/paseo worktree add .worktrees/bc-native-perf 759532509
git -C ~/workspace/rrd/paseo/.worktrees/bc-native-perf apply <this-dir>/tools/paseo-host-probe.patch
# npm ci && npm run build:server-deps && (cd packages/expo-two-way-audio && npm run build)
cd packages/app
CI=1 EXPO_PUBLIC_BC_HOST_PERF=1 BC_REACT_PROFILING=1 npx expo export --platform web --output-dir /tmp/bcnp-web-dist
CI=1 EXPO_PUBLIC_BC_HOST_PERF=1 EXPO_PUBLIC_LOCAL_DAEMON=localhost:6869 npx expo start --dev-client --port 8085

# daemon：~/.paseo-bench-ab（6869，CORS 放行 127.0.0.1:8092），安装 tools/bench-provider 和插件 worktree

# Web（web-ab.mjs 需要 playwright-core：ln -s <repo>/.showcase/node_modules tools/node_modules）
node tools/serve-web.mjs /tmp/bcnp-web-dist 8092 &
node tools/web-ab.mjs --reps 3 --out raw/web
node tools/web-ab.mjs --reps 3 --modes fork --reduced-motion --out raw/web mixed-turn:1 shell-log-large:1 tool-expanded-streaming:4 history-100:max

# iOS
node tools/control-server.mjs raw/ios 8099 &
BC_SIM_UDID=<udid> BC_WORKSPACE=<wks> OUT=raw/ios tools/ios-all.sh 2

# 修前 / 修后（插件 worktree 分别处在两个版本，各跑一批）
node tools/web-ab.mjs --reps 3 --fork-label forkold --out raw/web-fix mixed-turn:1 shell-log-large:1 tool-expanded-streaming:4 history-100:max
node tools/web-ab.mjs --reps 3 --fork-label forkfix --out raw/web-fix

# 2026-10-13 三方（daemon 的 better-paseo 路径指向一条符号链接）
# BC_PLUGIN_LINK=.../bench-active BC_FORK_DIR=.../bench-fork BC_UPSTREAM_DIR=.../bench-upstream
node tools/web-ab.mjs --reps 3 --modes native,fork,upstream --out raw/web-2026-10-13
node tools/report.mjs raw/web-2026-10-13 --a native --b fork
node tools/report.mjs raw/web-2026-10-13 --a upstream --b fork
node tools/chart.mjs web raw/web-2026-10-13 ../../perf/web-native-cpu.svg fork native
node tools/chart.mjs web raw/web-2026-10-13 ../../perf/web-upstream-cpu.svg fork upstream

# 表格和 docs/perf 的两张图（10 月 12 日）
node tools/report.mjs raw/web
node tools/report.mjs raw/web-fix --a native --b forkfix
node tools/chart.mjs web raw/web-fix ../../perf/web-native-cpu.svg forkfix
node tools/chart.mjs ios raw/ios ../../perf/ios-native-commit.svg
node tools/report.mjs raw/web --a fork --b forkrm
node tools/report.mjs raw/ios --ios
```

## 8. 2026-10-13：不开插件、Beautiful Chat、本仓库，同一次会话

插件 `2146289`（`.worktrees/bench-fork`）和 Beautiful Chat `42b61d8`（`.worktrees/bench-upstream`）装在同一个目录插件上，用符号链接切换，`web-ab.mjs` 在换目标后 `plugin reload`。模式顺序按轮旋转，所以三种模式轮流先跑。每格 3 次，原始数据在 `raw/web-2026-10-13/`（99 个 JSON）。宿主仍是 10 月 12 日那份带探针的 Web 生产构建。开跑时 1 分钟负载 18、15 分钟负载 242，结束时分别是 10 和 21。第一轮有几个场景偏慢（例如不开插件的代码块流式 11.3 / 3.8 / 3.8 秒，中位数 3.81），中位数取的是中间那次。

主线程任务时间，秒，中位数。本仓库相对不开插件、相对 Beautiful Chat 的变化见 [`docs/fork-vs-upstream.md`](../../fork-vs-upstream.md) 的性能一节。

| 场景 | 不开插件 | Beautiful Chat | 本仓库 |
| --- | ---: | ---: | ---: |
| codeblock-streaming | 3.81 | 3.45 | 1.70 |
| diff-large | 0.38 | 2.41 | 0.37 |
| history-100 | 2.92 | 8.49 | 2.14 |
| markdown-long | 7.07 | 8.42 | 3.67 |
| mixed-turn | 1.20 | 2.95 | 1.02 |
| reads-20 | 0.96 | 3.72 | 0.70 |
| reasoning-long-prose | 2.06 | 3.57 | 1.27 |
| reasoning-long-sections | 1.97 | 3.92 | 1.02 |
| shell-log-large | 0.88 | 1.60 | 0.64 |
| table-streaming | 2.77 | 1.64 | 1.08 |
| tool-expanded-streaming | 1.49 | 3.26 | 0.97 |

回收之后的 JS 堆（MB）和 DOM 节点，挑差距大的几格：

| 场景 | 堆：不开插件 / Beautiful Chat / 本仓库 | DOM：不开插件 / Beautiful Chat / 本仓库 |
| --- | ---: | ---: |
| diff-large | 132 / 239 / 135 | 1,094 / 40,362 / 1,039 |
| history-100 | 140 / 265 / 142 | 1,828 / 14,263 / 1,845 |
| markdown-long | 181 / 141 / 140 | 4,764 / 2,930 / 2,883 |
| reads-20 | 136 / 266 / 139 | 1,524 / 56,158 / 1,488 |
| shell-log-large | 133 / 152 / 135 | 1,104 / 9,625 / 1,034 |
| tool-expanded-streaming | 135 / 147 / 138 | 1,095 / 6,501 / 1,034 |

其余场景的堆，三种模式都在 133–147MB。Beautiful Chat 默认把运行中的工具展开，读 20 个文件因此提交 11,015 次，本仓库 286 次，不开插件 277 次。Beautiful Chat 也自己画用户气泡，本仓库和不开插件的用户行都是 Paseo 的气泡。

布局偏移：长回复 0.157 / 0.644 / 0，代码块 0.039 / 0.127 / 0.012，表格 0.049 / 0.040 / 0.011，100 轮历史 0 / 0.478 / 0。顺序是不开插件 / Beautiful Chat / 本仓库。

`history-100` 不开插件的三次是 5.52、2.92、1.95 秒，中位数 2.92 仍比本仓库的 2.14 高，但这一格的不开插件一侧波动大。Beautiful Chat 三次都在 8.4–8.5 秒。本仓库三次是 2.15、2.14、2.04。

图：`docs/perf/web-native-cpu.svg`（淡色是不开插件），`docs/perf/web-upstream-cpu.svg`（淡色是 Beautiful Chat）。

## 9. 2026-10-14：rrd-mac-studio 上的三方复测（Web + iOS）

这一节是当前数字。§3–§8 留着作记录，秒数不能和这里对读：那些轮次跑在一台共享的、负载很高的 M5 Pro 笔记本上，这一轮跑在空闲的 Mac Studio 上。

### 9.1 环境

| | |
| --- | --- |
| 机器 | rrd-mac-studio。`sysctl machdep.cpu.brand_string` 为 Apple M5 Max，`hw.ncpu` 18，`hw.memsize` 68719476736（64 GB），macOS 27.0.1。Web 开跑前 1 分钟负载 0.83，结束 0.87；iOS 两批大约 1.46–1.85。整轮 1 分钟负载大约 0.8–1.7 |
| 宿主 | Paseo 0.11.2（`759532509`）加 `tools/paseo-host-probe.patch`。Web 用的是和 10 月 12–13 日同一份带探针的生产构建，主 JS sha256 前缀 `9dd7eab4521434bc` |
| daemon | 私有目录 `~/.paseo-bench-p0p1`，`127.0.0.1:6871`，CLI `/tmp/bc-perf-p0p1/paseo-cli/node_modules/.bin/paseo`。插件设置保持默认 |
| 三种模式 | 不开插件；Beautiful Chat `42b61d8`（`/tmp/bc-bench-1014/upstream`）；本仓库 `9f270c6`（`/tmp/bc-bench-1014/fork`）。daemon 里的插件路径指向符号链接 `/tmp/bc-bench-1014/bench-active`，换目标后 `plugin reload`。顺序按轮旋转 |
| Web | headless Chrome 155.0.8059.40，1280×900。profile `/tmp/bc-bench-1014/web-profile`，页面来自 `http://127.0.0.1:8092`。2026-10-14 20:30–21:21（+0800），一批跑完 |
| iOS | 模拟器 `bc-perf-ios`，UDID `4497FFF9-93D1-4713-B55B-A9988BC2209E`，iPhone 16 Pro，iOS 18.6，开发版 `sh.paseo.debug`。Metro 8085 提供带探针的 JS，每次运行前冷启动。2026-10-14 22:18 至次日 00:27（+0800），分两批 |
| 次数 | Web：11 × 3 种模式 × 3 次 = 99，页面错误 0。iOS：11 × 3 × 2，`history-100` 和 `shell-log-large` 每种模式 6 次，共 90。速度仍是其余 1、`history-100` max、`tool-expanded-streaming` 4 |

### 9.2 方法上的变化

每次运行都核对当时画时间线的是哪一版，对不上就重做，原始 JSON 里记着 `identity`。

- Web（`web-ab.mjs`）：fork 的 `globalThis.__bcPerf.snapshot()` 里有 `imageRpc`，且页面上没有 `#beautiful-chat-frosted`；Beautiful Chat 有这个 DOM 节点，且没有 `imageRpc`；不开插件两者都没有，并且 `__hostPerf` 在。
- iOS（新文件 `tools/ios-identity.mjs`）：通过 Metro 的 inspector 读同一组标记。fork 仍是 `imageRpc`。Beautiful Chat 在 iOS 上不会创建那个 DOM 节点，所以把「有插件行、且没有 `imageRpc`」当作 upstream，把「两个标记都没有、且 `rows.native > 0`」当作不开插件。命令行：`node ios-identity.mjs --port 8085 [--expect native|fork|upstream] [--dump file] [--check-file file]`。

脚本加了环境变量，不设的时候默认值和原来写死的路径一样，旧的两方跑法还在。

- `web-ab.mjs`：`BC_BENCH_HOME`（`~/.paseo-bench-ab`）、`BC_BENCH_PORT`（`6869`）、`BC_PROJECT`（`/tmp/bcnp-proj`）、`BC_PROFILE`（`/tmp/bcnp-web-profile`）、`BC_PASEO_BIN`（`paseo`）、`BC_ORIGIN`（`http://127.0.0.1:8092`）、`BC_PLUGIN_LINK`、`BC_FORK_DIR`、`BC_UPSTREAM_DIR`。
- `ios-ab.sh`：`BC_BENCH_HOME`、`BC_PASEO_BIN`、`BC_BUNDLE_ID`（默认 `sh.paseo`）、`BC_URL_SCHEME`、`BC_DEV_SCHEME`、`METRO_PORT`（8085）、`BC_SERVE_SIM_PORT`（3160）、`BC_PLUGIN_LINK`、`BC_FORK_DIR`、`BC_UPSTREAM_DIR`、`BC_DISMISS_OPEN_ALERT`、`BC_SKIP_EXISTING`、`BC_IDENTITY_ATTEMPTS`。不设 `BC_PLUGIN_LINK` 时，仍用 `plugin enable/disable` 在不开插件和本仓库之间切换。
- `ios-all.sh`：`BC_MODES` 不设时仍是 native/fork 的 ABBA；设成 `native,fork,upstream` 就按这个列表旋转。`BC_REP_START` 默认 1，用来把后补的轮次接到同一批输出上。

iOS 以前只有不开插件和本仓库走宿主探针，Beautiful Chat 用的是卡片内部探针。这一轮三种模式都走宿主探针。卡片内部探针不在 Beautiful Chat 里，那张旧表不能重测。

### 9.3 Web

中位数，3 次。左右两份成对报告是 `raw/web-2026-10-14/report-native-fork.txt` 和 `report-upstream-fork.txt`。下面收成三列。`report.mjs` 把 JS 堆印成整数 MB；README 保留一位小数，精确中位数在 README 的内存表里。用户、助手、思考、工具、待办分种类的表仍在这两份报告里，这里不重复贴。

`report.mjs` 里标题为「行提交次数」的那一列读的是 `probe.allRows.n`，是行渲染次数，不是 React 提交次数。下面按行渲染次数写。

主线程 CPU，秒（CDP 回放前后的差）。Layout+Style 是 `LayoutDuration` + `RecalcStyleDuration`。

| 场景 | Task 不开插件 | Task Beautiful Chat | Task 本仓库 | Script 不开插件 | Script Beautiful Chat | Script 本仓库 | 版式 不开插件 | 版式 Beautiful Chat | 版式 本仓库 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| codeblock-streaming | 3.96 | 3.50 | 2.51 | 2.65 | 2.55 | 1.59 | 0.37 | 0.23 | 0.21 |
| diff-large | 0.41 | 1.81 | 0.31 | 0.17 | 1.17 | 0.15 | 0.05 | 0.20 | 0.03 |
| history-100 | 0.73 | 7.03 | 0.63 | 0.61 | 6.80 | 0.53 | 0.05 | 0.09 | 0.03 |
| markdown-long | 8.72 | 8.62 | 5.62 | 5.35 | 6.45 | 3.09 | 0.95 | 0.48 | 0.54 |
| mixed-turn | 1.61 | 3.68 | 1.21 | 0.69 | 1.95 | 0.55 | 0.24 | 0.30 | 0.13 |
| reads-20 | 1.15 | 3.45 | 0.99 | 0.56 | 2.39 | 0.57 | 0.19 | 0.31 | 0.09 |
| reasoning-long-prose | 2.75 | 4.01 | 1.79 | 1.61 | 2.41 | 1.01 | 0.20 | 0.41 | 0.16 |
| reasoning-long-sections | 2.50 | 3.73 | 1.55 | 1.49 | 2.51 | 0.92 | 0.18 | 0.29 | 0.12 |
| shell-log-large | 1.00 | 2.30 | 0.66 | 0.22 | 1.02 | 0.19 | 0.15 | 0.18 | 0.08 |
| table-streaming | 3.01 | 2.12 | 1.85 | 2.07 | 1.34 | 1.07 | 0.23 | 0.20 | 0.16 |
| tool-expanded-streaming | 1.85 | 4.46 | 1.41 | 0.75 | 2.53 | 0.72 | 0.20 | 0.36 | 0.12 |

持平规则和 README 相同：相差不到一成，或者整段回放两边都不到半秒，记为持平。百分比在舍入前用中位数算。相对不开插件，10 个场景短 14–38%，`diff-large` 持平（0.41 对 0.31，原始差距 25%，但两边都不到半秒）。相对 Beautiful Chat，11 个都更短，少 12–91%。

行渲染耗时，毫秒。p50 / p95 / max 保留报告里的小数，合计是报告里的整数。

| 场景 | p50 | p95 | max | 合计 |
| --- | ---: | ---: | ---: | ---: |
| codeblock-streaming | 1.6 / 3 / 0.3 | 2.7 / 5.5 / 2.1 | 9.2 / 7.4 / 6.1 | 1,288 / 1,321 / 363 |
| diff-large | 0.1 / 0.2 / 0.2 | 2.4 / 0.6 / 2.6 | 8.6 / 124.3 / 4.6 | 38 / 556 / 20 |
| history-100 | 0 / 0.1 / 0 | 0.2 / 0.3 / 0.1 | 6.9 / 25.2 / 5.9 | 160 / 4,503 / 138 |
| markdown-long | 1.1 / 4 / 0.3 | 2.1 / 7.3 / 1.5 | 6 / 12.6 / 10 | 2,007 / 3,228 / 480 |
| mixed-turn | 0.6 / 0 / 0.2 | 2.6 / 0.2 / 1.7 | 9 / 6.5 / 3.8 | 211 / 563 / 96 |
| reads-20 | 0.2 / 0 / 0.2 | 2.2 / 0.1 / 1.2 | 7.1 / 16.6 / 4 | 135 / 994 / 111 |
| reasoning-long-prose | 0.6 / 1 / 0.2 | 0.9 / 2.1 / 0.8 | 9 / 3.7 / 2.7 | 489 / 1,040 / 149 |
| reasoning-long-sections | 0.6 / 1.6 / 0.2 | 0.9 / 2.6 / 0.8 | 8.5 / 4.7 / 3.1 | 458 / 1,361 / 133 |
| shell-log-large | 0.1 / 0.2 / 0.1 | 3.6 / 0.4 / 2.4 | 9.9 / 22.6 / 3.7 | 39 / 244 / 18 |
| table-streaming | 1.8 / 1.8 / 0.2 | 2.9 / 3 / 2.8 | 7.1 / 4.4 / 3.9 | 1,146 / 448 / 275 |
| tool-expanded-streaming | 0 / 0.1 / 0.2 | 0.6 / 5.8 / 0.8 | 6.3 / 15.7 / 2.1 | 57 / 959 / 106 |

顺序是不开插件 / Beautiful Chat / 本仓库。单行 p95 在纯文本上并没有掉到不开插件的一半：长回复 2.1 → 1.5，代码块 2.7 → 2.1，表格 2.9 → 2.8（不到一成）。和 Beautiful Chat 的差距主要在次数和合计。读 20 个文件时，Beautiful Chat 的单行 p95 是 0.1ms，因为它把展开的工具拆成大约一行一次提交；行渲染 10,812 次，合计 994ms。不开插件是 277 次、135ms，本仓库是 319 次、111ms。

每次提交里所有行之和的 p95 / max（毫秒），以及行渲染次数（`allRows.n`）：

| 场景 | 提交内 p95 | 提交内 max | 行渲染次数 |
| --- | ---: | ---: | ---: |
| codeblock-streaming | 3 / 5.6 / 2.1 | 11 / 7.4 / 6.1 | 867 / 463 / 467 |
| diff-large | 2.5 / 0.4 / 3.1 | 11 / 125.5 / 6.1 | 47 / 336 / 40 |
| history-100 | 6.4 / 75.6 / 3.5 | 21.4 / 112 / 15.2 | 4,283 / 27,759 / 3,654 |
| markdown-long | 3 / 7.3 / 1.5 | 9.7 / 12.6 / 10 | 1,993 / 807 / 813 |
| mixed-turn | 4.2 / 1.3 / 2.6 | 9.2 / 12.9 / 4.7 | 269 / 6,178 / 202 |
| reads-20 | 3.7 / 6.4 / 1.8 | 8.7 / 121.7 / 5.3 | 277 / 10,812 / 319 |
| reasoning-long-prose | 0.9 / 2.1 / 0.9 | 9 / 5.1 / 4.6 | 829 / 986 / 471 |
| reasoning-long-sections | 0.9 / 2.6 / 0.9 | 8.5 / 4.8 / 4.7 | 765 / 873 / 422 |
| shell-log-large | 4.3 / 0.4 / 5.1 | 13.3 / 24.6 / 5.1 | 44 / 877 / 38 |
| table-streaming | 3 / 3.1 / 2.8 | 7.1 / 4.4 / 3.9 | 646 / 249 / 272 |
| tool-expanded-streaming | 0.9 / 6.9 / 1 | 7.7 / 16.4 / 2.9 | 315 / 1,357 / 314 |

掉帧比例（%）和最长帧（毫秒）：

| 场景 | 掉帧 | 最长帧 |
| --- | ---: | ---: |
| codeblock-streaming | 0.1 / 0.2 / 0.1 | 33 / 50 / 33 |
| diff-large | 0.5 / 13.9 / 0.2 | 33 / 317 / 33 |
| history-100 | 11.8 / 85.2 / 10 | 150 / 233 / 133 |
| markdown-long | 0.1 / 0.4 / 0.1 | 33 / 50 / 33 |
| mixed-turn | 0.2 / 0.3 / 0.2 | 33 / 50 / 33 |
| reads-20 | 0.3 / 2.7 / 0.2 | 33 / 200 / 33 |
| reasoning-long-prose | 0.1 / 0.1 / 0 | 33 / 33 / 17 |
| reasoning-long-sections | 0 / 0.1 / 0.1 | 17 / 33 / 33 |
| shell-log-large | 0.2 / 1 / 0.1 | 33 / 100 / 33 |
| table-streaming | 0 / 0 / 0.1 | 17 / 17 / 33 |
| tool-expanded-streaming | 0.2 / 2.1 / 0 | 33 / 33 / 17 |

长任务、布局偏移、回收后的 JS 堆（报告里的整数 MB）和 DOM 节点：

| 场景 | 长任务数 | 长任务合计 ms | 布局偏移 | JS 堆 MB | DOM 节点 |
| --- | ---: | ---: | ---: | ---: | ---: |
| codeblock-streaming | 0 / 0 / 0 | 0 / 0 / 0 | 0.042 / 0.129 / 0.012 | 114 / 113 / 112 | 2,920 / 3,685 / 2,509 |
| diff-large | 0 / 6 / 0 | 0 / 971 / 0 | 0 / 0.024 / 0 | 107 / 214 / 111 | 1,407 / 40,675 / 1,368 |
| history-100 | 1 / 43 / 0 | 56 / 3,079 / 0 | 0 / 0.226 / 0 | 115 / 243 / 118 | 2,141 / 15,436 / 2,167 |
| markdown-long | 0 / 0 / 0 | 0 / 0 / 0 | 0.218 / 0.648 / 0 | 156 / 114 / 115 | 5,077 / 3,243 / 3,205 |
| mixed-turn | 0 / 0 / 0 | 0 / 0 / 0 | 0.042 / 0.093 / 0.027 | 112 / 121 / 113 | 1,792 / 4,362 / 1,694 |
| reads-20 | 0 / 1 / 0 | 0 / 176 / 0 | 0.001 / 0.318 / 0.001 | 111 / 241 / 115 | 1,837 / 56,471 / 2,026 |
| reasoning-long-prose | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0.099 / 0.001 | 109 / 112 / 112 | 1,401 / 1,378 / 1,349 |
| reasoning-long-sections | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0.149 / 0.001 | 109 / 112 / 112 | 1,401 / 1,378 / 1,351 |
| shell-log-large | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0.022 / 0 | 108 / 125 / 112 | 1,417 / 9,938 / 1,361 |
| table-streaming | 0 / 0 / 0 | 0 / 0 / 0 | 0.046 / 0.040 / 0.011 | 112 / 113 / 113 | 2,054 / 1,589 / 1,951 |
| tool-expanded-streaming | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0.014 / 0 | 111 / 123 / 114 | 1,408 / 6,814 / 1,361 |

长回复的布局偏移，报告印成 0 的那一格，未舍入中位数是 1.46e-5，README 也写成 0。

### 9.4 iOS

中位数。2 次的格子取两次的平均，6 次的格子取排序后中间两格的平均，和 `report.mjs` 相同。成对报告是 `raw/ios-2026-10-14/report-native-vs-fork.txt` 和 `report-upstream-vs-fork.txt`。分种类的表在这两份报告里。

行渲染耗时，毫秒。合计是报告里的整数；README 和下面 9.5 用的是未舍入中位数保留一位，`history-100` 的 Beautiful Chat 因此是 230.6 而不是报告里的 231。

| 场景 | p50 | p95 | max | 合计 |
| --- | ---: | ---: | ---: | ---: |
| codeblock-streaming | 0.26 / 10.47 / 0.6 | 18.04 / 18.64 / 5.65 | 52.3 / 61.4 / 68.6 | 2,301 / 4,532 / 965 |
| diff-large | 0.35 / 1.04 / 0.38 | 7.96 / 1,704.72 / 7.2 | 9.1 / 2,877.7 / 17.7 | 54 / 5,541 / 51 |
| history-100 | 2.74 / 0.74 / 1.58 | 7.34 / 3.92 / 7.9 | 36.5 / 10.8 / 18.2 | 200 / 231 / 203 |
| markdown-long | 3.73 / 17.84 / 1.54 | 9.29 / 36.71 / 5.44 | 62.8 / 97.9 / 165 | 5,075 / 13,393 / 1,833 |
| mixed-turn | 0.42 / 1.96 / 0.62 | 7.47 / 11.58 / 4.73 | 11.3 / 41.4 / 12.5 | 300 / 633 / 242 |
| reads-20 | 0.87 / 1.62 / 0.87 | 5.46 / 85.8 / 3.99 | 8.9 / 133.2 / 21.5 | 281 / 2,653 / 331 |
| reasoning-long-prose | 0.35 / 4.42 / 0.67 | 3.55 / 7.6 / 2.62 | 8.3 / 11.7 / 12.2 | 270 / 1,473 / 335 |
| reasoning-long-sections | 0.36 / 8.75 / 0.64 | 3.37 / 14.09 / 1.37 | 8.8 / 20.6 / 11.4 | 230 / 2,459 / 281 |
| shell-log-large | 0.35 / 0.99 / 0.35 | 7.34 / 104.89 / 4.22 | 8.3 / 212.7 / 16.2 | 51 / 355 / 43 |
| table-streaming | 0.4 / 4.58 / 0.5 | 12.83 / 8.14 / 6.43 | 23.5 / 20.4 / 21.9 | 993 / 1,169 / 549 |
| tool-expanded-streaming | 1.07 / 0.94 / 1.02 | 4.3 / 54.28 / 3.38 | 9 / 62.6 / 21 | 160 / 3,026 / 260 |

每次提交里所有行之和的 p95 / max（毫秒）。「行渲染次数」仍是 `allRows.n`。真正的提交次数（`perCommit.n` 的中位数）报告没印，写在 9.5，从 JSON 重算。

| 场景 | 提交内 p95 | 提交内 max | 行渲染次数 |
| --- | ---: | ---: | ---: |
| codeblock-streaming | 18.63 / 18.67 / 5.67 | 53.2 / 63.2 / 70.4 | 475 / 443 / 484 |
| diff-large | 13.97 / 2,877.67 / 19.96 | 14 / 2,877.7 / 20 | 26 / 28 / 34 |
| history-100 | 65.56 / 4.51 / 70.15 | 65.6 / 59.9 / 70.1 | 50 / 182 / 90 |
| markdown-long | 43.74 / 36.71 / 5.45 | 133.3 / 101.7 / 166.1 | 1,341 / 716 / 802 |
| mixed-turn | 14.51 / 21.3 / 8.81 | 23.9 / 57 / 20.5 | 163 / 188 / 189 |
| reads-20 | 9.02 / 159.76 / 7.68 | 15.5 / 232.3 / 22.2 | 198 / 181 / 255 |
| reasoning-long-prose | 3.53 / 7.66 / 3.07 | 11 / 11.7 / 12.2 | 315 / 331 / 467 |
| reasoning-long-sections | 3.41 / 14.12 / 3.06 | 11.8 / 20.6 / 11.4 | 283 / 301 / 413 |
| shell-log-large | 14.35 / 212.67 / 17.35 | 14.3 / 212.7 / 17.4 | 26 / 26 / 32 |
| table-streaming | 12.98 / 8.16 / 6.43 | 29.1 / 22.2 / 22.9 | 261 / 246 / 270 |
| tool-expanded-streaming | 4.54 / 54.68 / 3.42 | 12 / 64.7 / 22.8 | 116 / 204 / 211 |

2 次样本的行渲染次数，报告用 `toFixed(0)`，所以 474.5 印成 475。上表沿用报告的印法。

掉帧比例（%）和最长帧（毫秒）。探针丢掉超过 1 秒的帧间隔，所以最长帧不会出现数秒的 JS 样本。Beautiful Chat 的 `diff-large` 就是这样：行渲染合计 5,541ms，单次提交 p95 2,877.7ms，留下的最长帧是 139ms。

| 场景 | 掉帧 | 最长帧 |
| --- | ---: | ---: |
| codeblock-streaming | 24.2 / 37.4 / 14.8 | 194 / 216 / 156 |
| diff-large | 4 / 5.4 / 4.7 | 125 / 139 / 145 |
| history-100 | 11.1 / 10.2 / 13.5 | 196 / 204 / 231 |
| markdown-long | 26.9 / 53.3 / 27.7 | 160 / 307 / 322 |
| mixed-turn | 6.4 / 11.4 / 7.1 | 126 / 140 / 149 |
| reads-20 | 10.8 / 43.2 / 11.5 | 124 / 656 / 148 |
| reasoning-long-prose | 5.5 / 18 / 3.5 | 137 / 143 / 147 |
| reasoning-long-sections | 5.5 / 27.2 / 3.4 | 146 / 142 / 148 |
| shell-log-large | 2.3 / 5.1 / 2.3 | 135 / 319 / 144 |
| table-streaming | 15.3 / 15.4 / 11.3 | 150 / 150 / 147 |
| tool-expanded-streaming | 2 / 40.3 / 4.7 | 134 / 291 / 143 |

README 的 iOS 表用行渲染总量（未舍入中位数，一位小数），不用上面的单次提交 p95。相对不开插件：5 个更短（代码块 58%、长回复 64%、混合一轮 19%、大段终端 15%、表格 45%），2 个持平（大 diff 5.4%、100 轮历史 1.4%，都不到一成），4 个更长（读 20 个文件 18%、思考散文 24%、思考分节 22%、展开的工具 63%）。这 4 个都是每种模式 2 次运行，两次的行渲染总量（`allRows.sum`，毫秒，一位小数）互不重叠：读 20 个文件，不开插件 274.2 / 287.9，本仓库 321.2 / 341.0；思考散文 264.1 / 276.4 对 333.5 / 336.9；思考分节 227.9 / 232.0 对 278.0 / 283.1；展开的工具 152.7 / 167.6 对 249.2 / 271.6。相对 Beautiful Chat，11 个都更短，少 12–99%。半秒条款只用于 Web 的整段回放；这里是毫秒，只套用「不到一成」。

一位小数的总量（不开插件 / Beautiful Chat / 本仓库）：代码块 2301.1 / 4532.1 / 965.4，大 diff 54.4 / 5541.4 / 51.5，100 轮历史 200.1 / 230.6 / 202.9，长回复 5075.3 / 13393.2 / 1833.4，混合一轮 299.7 / 633.5 / 242.2，读 20 个文件 281.0 / 2652.9 / 331.1，思考散文 270.3 / 1472.6 / 335.2，思考分节 229.9 / 2459.0 / 280.6，大段终端 50.8 / 355.4 / 43.0，表格 993.0 / 1169.4 / 549.4，展开的工具 160.1 / 3025.9 / 260.4。

### 9.5 `history-100` 的分批，以及其他会把 p95 看反的格子

`history-100` 是最大速度回放。三种模式把行打进提交的方式差很多。下面是 JSON 里 `allRows.n` 和 `perCommit.n` 的中位数，6 次，每次都参与中位数：

| | 行渲染次数 | 提交次数 | 每次提交大约几行 |
| --- | ---: | ---: | ---: |
| 不开插件 | 50 | 5 | 10.00 |
| Beautiful Chat | 182 | 125 | 1.46 |
| 本仓库 | 90 | 17 | 5.29 |

不开插件 6 次都是 50 次行渲染、5 次提交。Beautiful Chat 的行渲染次数是 181、182、182、182、182、182，中位数 182；提交次数 124、125、125、125、126、127，中位数 125。本仓库的行渲染次数是 89、89、90、90、90、91，中位数 90；提交次数 16，然后五次 17，中位数 17。

所以 Beautiful Chat 的单次提交 p95（4.51ms）看起来最低，只是因为大约一行一次提交。这一格比的是行渲染总量：不开插件 200.138ms，Beautiful Chat 230.631ms，本仓库 202.897ms，写成 200.1 / 230.6 / 202.9。相对不开插件不到一成，持平；相对 Beautiful Chat 少 12%。README 的 iOS 图每个场景都画行渲染总量（超过 2000ms 的条截断），不画 p95。

其他场景也算了「行渲染次数 / 提交次数」（中位数相除）。只有 `history-100` 差到数倍。其次是长回复：不开插件 1.91 行/次，Beautiful Chat 和本仓库都是 1.01。所以长回复的单次提交 p95 少 88%（43.74 → 5.45），总量少 64%（5075.3 → 1833.4），两边都是本仓库更短，p95 把幅度说大了。

另外几格的 p95 和总量方向相反，结论以总量为准：

- 大 diff：p95 高 43%（19.96 对 13.97），总量 51.5 对 54.4，不到一成，持平。行/次是 2.17 / 1.75 / 1.79，批量差不多。
- 大段终端：p95 高 21%（17.35 对 14.35），总量少 15%（43.0 对 50.8）。行/次是 2.17 / 1.86 / 1.88。
- 读 20 个文件、两段思考、展开的工具：p95 相对不开插件看起来更低或差不多，总量更长（18%、24%、22%、63%）。行/次都在 1.0–2.5 之间，不是 `history-100` 那种把很多行塞进少数提交。更长是因为行渲染次数变多（例如展开的工具 116 → 211，思考散文 315 → 467）。相对 Beautiful Chat，这四格的总量仍然少 77–91%。

### 9.6 局限

- 绝对毫秒不能和 §3–§8 比。机器不同，当时的负载也不同。
- iOS 是模拟器上的开发版，不是真机，也不是发布包。开发版的毫秒数只在这一轮内部比较。
- 没有测 Electron。插件设置是默认值。
- 探针丢掉超过 1 秒的帧间隔。最长帧因此盖不住 Beautiful Chat 在 `diff-large` 上那次数秒的工具行渲染。
- Web 上 `performance.now()` 在非跨源隔离环境下截到 0.1ms，0 和 0.1 之间的差别没有意义。
- 用户气泡：Beautiful Chat 自己画，本仓库和不开插件用的是 Paseo 的气泡（增强提问气泡默认关）。

### 9.7 截图

`raw/web-2026-10-14/` 只留三张 `mixed-turn` 第一次运行的截图：`web-native-mixed-turn-r1.png`、`web-fork-mixed-turn-r1.png`、`web-upstream-mixed-turn-r1.png`。其余 30 张 PNG 已删，避免把每个场景的截图都放进仓库。99 个 JSON 和两份 `report-*.txt` 都还在。`raw/ios-2026-10-14/` 本来就只有三张 `mixed-turn` 的 r1 截图。

### 9.8 复现

下面是这一轮用过的命令。daemon、模拟器和 Metro 当时在工作室机器上，现在都停了；这里只作记录。不设下列变量时，脚本回到原来的默认路径。

Web：

```bash
export BC_BENCH_HOME=~/.paseo-bench-p0p1
export BC_BENCH_PORT=6871
export BC_PASEO_BIN=/tmp/bc-perf-p0p1/paseo-cli/node_modules/.bin/paseo
export BC_PROFILE=/tmp/bc-bench-1014/web-profile
export BC_ORIGIN=http://127.0.0.1:8092
export BC_PLUGIN_LINK=/tmp/bc-bench-1014/bench-active
export BC_FORK_DIR=/tmp/bc-bench-1014/fork
export BC_UPSTREAM_DIR=/tmp/bc-bench-1014/upstream
node docs/bench/native-vs-fork/tools/web-ab.mjs \
  --reps 3 --modes native,fork,upstream \
  --out docs/bench/native-vs-fork/raw/web-2026-10-14
node docs/bench/native-vs-fork/tools/report.mjs \
  docs/bench/native-vs-fork/raw/web-2026-10-14 --a native --b fork
node docs/bench/native-vs-fork/tools/report.mjs \
  docs/bench/native-vs-fork/raw/web-2026-10-14 --a upstream --b fork
```

iOS。先把 11 个场景各跑 2 轮，再从第 3 轮补 4 轮 `history-100` 和 `shell-log-large`。`OUT`、`BC_SIM_UDID`、`BC_SERVE_SIM` 每次都要设。这一轮还设了 `BC_BUNDLE_ID=sh.paseo.debug`、`METRO_PORT=8085`、`BC_SERVE_SIM_PORT=3160`、`BC_DISMISS_OPEN_ALERT=1`，模拟器 UDID `4497FFF9-93D1-4713-B55B-A9988BC2209E`。切片报告没有记下另一套 URL scheme。

```bash
export BC_MODES=native,fork,upstream
export OUT=docs/bench/native-vs-fork/raw/ios-2026-10-14
docs/bench/native-vs-fork/tools/ios-all.sh 2
BC_REP_START=3 docs/bench/native-vs-fork/tools/ios-all.sh 4 history-100:max shell-log-large:1
node docs/bench/native-vs-fork/tools/report.mjs \
  docs/bench/native-vs-fork/raw/ios-2026-10-14 --ios --a native --b fork
node docs/bench/native-vs-fork/tools/report.mjs \
  docs/bench/native-vs-fork/raw/ios-2026-10-14 --ios --a upstream --b fork
```

README 的三张图由 `node docs/perf/readme-charts.mjs` 从这两个目录生成。iOS 图的第三条是 Beautiful Chat，11 个场景画的都是行渲染总量。
