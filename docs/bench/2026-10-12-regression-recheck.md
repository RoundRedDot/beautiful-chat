# 倒退项复测（2026-10-12）

`docs/fork-vs-upstream.md` 里标成倒退的有两类：一是 Web 堆内存（代码块流式、100 轮历史、长回复、思考分节），二是 iOS 用户卡片的提交时间。这两类数字都来自 V1（`81ce36b`），之后的代码没有重新量过。本次把 Beautiful Chat 基线和本仓库放在同一会话里交替复测；Web 上确认还存在的多余内存已经修掉。

## 方法

| | |
|---|---|
| 宿主 | Paseo 0.11.2 Web 生产构建（`/tmp/bc-web-dist`），无头 Chrome 155.0.8059.40，端口 8093 |
| daemon | 独立的 `~/.paseo-bench-pr`（127.0.0.1:6870），只装 `bc-bench` 和被测插件，不碰 6767、6868、6869 |
| 构建 | `base` = Beautiful Chat `42b61d8` 加探针（`4637382`）；`main` = `c00be20`；`pr` = 本分支。每次只启用一个 |
| 轮次 | 每个场景每个构建 3 次，构建顺序按轮交替；每次都重新载入页面、新建 agent |
| 设置 | 三个构建都打开「增强的提问气泡」，让用户卡片由插件绘制，与 Beautiful Chat 可比（默认是交给宿主） |
| 堆 | CDP `Performance.getMetrics` 的 `JSHeapUsedSize`：`载入后`（开跑前先强制 GC）、`跑完`（不 GC，V1 的口径）、`常驻`（跑完后强制 GC 两次） |
| 工具 | `tools/recheck-ab.mjs`、`tools/recheck-summary.py`；原始数据在 `raw-recheck/` |

V1 表里的堆内存读的是插件探针 dump 里的 `performance.memory.usedJSHeapSize`。Chrome 对这个值做了量化和缓存，同一构建、同一场景的三次读数可以相差 20MB 以上，例如 `table-streaming` Beautiful Chat 131 / 157 / 135MB。而且它比 CDP 的精确值一直高出 30–55MB。V1 每个场景只跑 1 次，所以那几行「↓」靠的是一个噪声很大的单次读数。下表仍列出这个值，但结论只按 CDP 的数字下。

## Web 堆内存（MB，3 次中位数）

| 场景 | 跑完：Beautiful Chat | 跑完：main | 跑完：本分支 | 常驻：Beautiful Chat | 常驻：main | 常驻：本分支 | performance.memory Beautiful Chat → 本分支 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 代码块流式 | 126.4 | 116.7 | **117.5** | 110.1 | 111.0 | **109.1** | 164.6 → 154.9 |
| 100 轮历史 | 523.8 | 216.2 | **206.0** | 178.4 | 154.7 | **153.3** | 405.5 → 245.5 |
| 长回复 | 120.7 | 124.9 | **111.7** | 110.4 | 112.8 | **110.7** | 174.8 → 150.8 |
| 思考分节 | 117.2 | 115.5 | **111.7** | 107.4 | 108.8 | **106.7** | 156.5 → 155.8 |
| 表格流式 | 120.5 | 109.8 | **107.5** | 107.6 | 109.6 | **107.4** | 135.4 → 161.5 |
| 混合一轮 | 128.8 | 114.2 | **114.2** | 115.6 | 111.1 | **109.3** | 169.2 → 144.5 |
| 载入后（18 次中位数） | 104.4 | 106.6 | **104.6** | | | | |

- **跑完时的堆**（V1 的口径）：本分支在 6 个场景里都低于 Beautiful Chat。当年代码块流式 143 → 183MB 的读数，主要来自 Web 上的逐帧揭示（V1 时解析 894 次，`7b8c27a` 已经在 Web 上关掉），再叠加上面说的读数噪声。
- **常驻堆**：`main` 在 6 个场景里有 4 个比 Beautiful Chat 高 1–2.4MB，确实还有倒退。本分支 5 个场景低于 Beautiful Chat；长回复高 0.3MB，在轮次之间的波动以内。
- `performance.memory` 一列里，表格流式本分支三次读数是 161.5 / 140.4 / 162.8，CDP 的跑完值却是 107.5 / 107.5 / 108.5。这再次说明那一列不能作为依据。

## 找到并修掉的两处

### 1. 流式尾块占满 lex LRU（`5b9c734`）

每来一个 chunk，回复最后一块的源码就会变一次。原来每个版本都整棵 lex 进 500 槽的 LRU。这些半截版本不会再画出来，却一直占着内存，还会把已定稿的块挤出缓存。现在尾块走 8 个槽的小缓存，覆盖同时流式的几条回复，以及探针对同一尾块的第二次读取；定稿块照旧进 LRU。

用 `tools/recheck-lex-retention.ts` 按 fixture 的 chunk 顺序离线重放「分块 → 修复尾块 → lex」，跑完后 GC，看保留多少：

| fixture | 之前 | 之后 | LRU 条目 |
|---|---:|---:|---:|
| markdown-long | 2.53 MB | 1.65 MB | 500 → 107 |
| table-streaming | 2.16 MB | 1.06 MB | 171 → 7 |
| codeblock-streaming | 1.32 MB | 0.92 MB | 500 → 13 |
| reasoning-long-sections | 0.96 MB | 0.82 MB | 197 → 39 |

### 2. bundle 里一个非 ASCII 字符让整份源码翻倍（`07d3798`）

引擎会保留它求值的源码。V8 只有在所有字符都是 Latin-1 时才用单字节存字符串，Hermes 的要求是 ASCII。esbuild 会转义字符串字面量，但保留下来的注释和正则字面量会原样进入 bundle。原来 bundle 里有 `–`、`—`、`…`、`✓` 等 18 处，于是整份约 950KB 的源码按双字节存。Beautiful Chat 的 bundle 也有这类字符，只是它只有 666KB。

正则里的字符改写成 `\uXXXX`，留在 bundle 里的注释改成 ASCII。`npm run check:hermes` 新增一步：bundle 只要出现非 ASCII 字符就失败，并给出大致的源码位置。

验证（`mixed-turn`，各 4 次，`raw-recheck/ascii/`）：载入后的堆从 106.0 降到 104.1MB（Beautiful Chat 103.6），常驻从 109.2 降到 107.2MB（Beautiful Chat 107.7）。完整复测里，载入后的堆是 `main` 106.6、本分支 104.6、Beautiful Chat 104.4MB。

## 提交时间和渲染次数没有变差

同一批跑次里，用户卡片的提交时间 Beautiful Chat p50 2.7–6.3ms，本分支 1.0–1.4ms（单轮场景）。本分支用户卡片只渲染 1 次，Beautiful Chat 是 6–8 次。100 轮历史里 Beautiful Chat p50/p95 是 41.2/99.7ms、渲染 6,214 次，本分支 6.7/30.6ms、渲染 110 次。最忙卡片的 p95：Beautiful Chat 4.6–132ms，本分支 1.1–30.6ms。掉帧：100 轮历史 Beautiful Chat 0.8，本分支 0.2；其余场景都是 0。

## iOS 用户卡片

V1 的配对 A/B（`raw-ab/`）显示，用户卡片 p50 从 18.0 变成 26.6ms。原因是设置同步的 leader 挂在首张卡片上，卡片每次重渲染都会重跑 `useSettings`。S5 已经修掉（`a2996c5`，单独 memo）。修复后同一模拟器的配对 A/B（各 4 轮，`docs/delivery/reports/S5.md`）：

| 卡片 | Beautiful Chat p50 | 本仓库 p50 | Beautiful Chat p95 | 本仓库 p95 |
|---|---:|---:|---:|---:|
| 用户 | 15.8 | 13.3 | 25.3 | 13.3 |
| 助手 | 20.2 | 13.1 | 108.2 | 21.6 |
| 思考 | 22.1 | 9.6 | 94.4 | 21.5 |
| 工具 | 45.1 | 15.4 | 122.6 | 27.0 |
| 待办 | 60.5 | 28.0 | 137.9 | 40.8 |

用户卡片每轮渲染 4 → 1 次，每轮总耗时 61.8–110.8ms → 12.7–14.2ms。

这次没有在 iOS 上重跑。新建的模拟器会自动连回本机 6767 的主 daemon，要接到隔离 daemon 得在界面里反复改 host。为了不碰主 daemon，我停下并删除了这台模拟器。S5 之后用户卡片又加了复制按钮、回退菜单和大纲锚点；同一份 JS 在 Web 上的复测里，用户卡片挂载 1.0–1.4ms，Beautiful Chat 每次提交 2.7–6.3ms，看不出它们带回了倒退。另外，「增强的提问气泡」现在默认关闭，默认设置下用户消息由宿主绘制，插件这一侧没有这张卡片的开销。

## 附带发现（未改动）

增强气泡本身占内存。同一天较早的一次三方复测里，`bc-main` 还没有设置文件，用默认值（气泡交给宿主），100 轮历史的常驻堆是 113.8MB；打开气泡后是 153–155MB，110 张用户卡片大约占 40MB（`raw-recheck/abc/`）。这个值仍低于 Beautiful Chat 的 178MB，开关也默认关闭，所以本次没有改。要继续压内存，下一个该看这里。

## 复现

```
paseo --home ~/.paseo-bench-pr daemon config set daemon.listen 127.0.0.1:6870   # 再在 config.json 里把 8093 加进 CORS
paseo --home ~/.paseo-bench-pr daemon start
paseo --home ~/.paseo-bench-pr plugin install <repo>/tools/bench-provider
paseo --home ~/.paseo-bench-pr plugin install <worktree@4637382> --id bc-base   # 以及 bc-main / bc-pr
node serve-web.mjs /tmp/bc-web-dist 8093
node docs/bench/tools/recheck-ab.mjs --reps 3 --modes base,main,pr --out <dir> codeblock-streaming:1 markdown-long:1 reasoning-long-sections:1 history-100:max table-streaming:1 mixed-turn:1
python3 docs/bench/tools/recheck-summary.py <dir>
```

`recheck-ab.mjs` 要能解析到 `playwright-core`（`.showcase/node_modules`）。`recheck-lex-retention.ts` 的用法写在文件开头（esbuild 打包，再用 `node --expose-gc` 运行）。
