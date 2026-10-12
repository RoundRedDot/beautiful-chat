# Paseo 原生渲染 vs 本仓库 fork 插件

问题：装上本仓库的 beautiful-chat（`c00be20`）之后，和不装插件、直接用 Paseo 0.11.2 内置渲染相比，性能是好是坏。

场景沿用 [`docs/fork-vs-upstream.md`](../../fork-vs-upstream.md) 的 11 个回放 fixture，速度也相同：其余 1，`history-100` max，`tool-expanded-streaming` 4。平台同样分两边：Web 生产构建和 iOS 模拟器开发版。测量于 2026-10-12。

## 结论

- **每一行渲染一次的代价，fork 更低。** Web 上 11 个场景里，有 10 个的行渲染 p95 降了 33–88%，剩下的 `history-100` 持平。iOS 上，8 个场景的「单次提交里所有行之和」p95 降了 15–86%。纯文本流式（长回复、代码块、表格、思考）收益最大：Web 主线程 CPU 降 7–53%，iOS 上长回复单次提交 p95 从 59ms 降到 8ms。
- **Web 上有一处倒退：工具在运行时的那个圆点。** 它用 React Native 的 `Animated`，Web 上没有 native driver，每一帧都触发一次 React 提交。工具和待办较多的场景因此比原生多花 20–38% 的主线程时间：`mixed-turn` +38%，`shell-log-large` +22%，`tool-expanded-streaming` +33%，`history-100` +20%。打开「减少动态效果」让圆点静止后，这几项全都降到原生以下（−2% 到 −37%）。归因已经确认，见 §4。
- **iOS 没有这处倒退**，那里的圆点走 native driver。iOS 上单次提交 p95 比原生差的有三项：`history-100` +34%，`shell-log-large` +22%，`reasoning-long-prose` +6%（这一项在噪声范围内）。掉帧方面，文本流式明显好转（长回复 45.9% → 29.0%，代码块 32.4% → 20.9%），其余场景持平或差几个百分点。iOS 只跑了 2 轮，这个幅度落在噪声范围内。
- **Web 的布局偏移，fork 更高**：长回复 0.21 → 0.41，代码块 0.045 → 0.084。fork 在 Web 上按 daemon 的 chunk（大约 60ms）一批出字，原生是逐帧揭示，所以 fork 每次长高的幅度更大。

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

和 `fork-vs-upstream.md` 的数字**不能直接比**。那份文档测的是插件卡片内部「开始渲染 → layout effect」的时间；这里测的是宿主行外壳的 React 渲染时间。Web 上的 `Profiler` 计时精度是 0.1ms（Chrome 不在跨源隔离环境下会把 `performance.now()` 截到 100µs），所以 0 和 0.1 之间的差别没有意义。

## 2. 环境

| | |
|---|---|
| 机器 | Apple M5 Pro，macOS 27.0.1。**同时有其他 agent 在跑，负载 11–17**，所以按场景交替两种模式（ABBA）、取中位数 |
| daemon | 单独的 `~/.paseo-bench-ab`（127.0.0.1:6869，0.11.2），只装 `bc-bench` 和本仓库 `c00be20` 的 worktree。两种模式只差 `paseo plugin enable/disable beautiful-chat`；插件设置都是默认值（增强提问气泡关，所以两边的用户消息都是 Paseo 自己画的） |
| 宿主 | Paseo `759532509`（v0.11.2）加探针补丁，worktree 在 `paseo/.worktrees/bc-native-perf`（分支 `bench/native-vs-fork`） |
| Web | `expo export --platform web` 生产构建，headless Chrome 155.0.8059.40，1280×900，`zh-CN`。**每个场景每种模式 3 次**，取中位数，每次重新加载页面 |
| iOS | 新建的 iPhone 16 Pro 模拟器 `bc-native-ab`（iOS 18.6），Paseo 0.11.2 **开发版**，JS 由 Metro 提供（8085）。**每次运行前都冷启动 App**，每个场景每种模式 2 次，`mixed-turn` 4 次。开发版的绝对毫秒数只能做相对比较 |
| 原始数据 | `raw/web/*.json`（66 次 + 12 次减少动态效果），`raw/ios/*.json`（48 次），每次都附截图 |

## 3. Web（生产构建，3 次取中位数）

单元格是 `原生 → fork`，百分比是 fork 相对原生的变化，负数表示 fork 更快或更少。

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

圆点静止后，fork 在这四个场景里都不比原生慢，其中三个快 31–37%。可选的修法：Web 上改用 CSS `@keyframes` 做透明度动画，交给合成线程；或者把圆点隔离成不随行一起提交的叶子节点。改完需要再跑一次 §3。

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

# 表格
node tools/report.mjs raw/web
node tools/report.mjs raw/web --a fork --b forkrm
node tools/report.mjs raw/ios --ios
```
