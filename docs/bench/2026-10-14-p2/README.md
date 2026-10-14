# P2 性能优化：Phase 1 与 Phase 2 证据

本目录保留 P2 Phase 1 基线与 Phase 2 A-only 实测证据。当前生产 `lex.ts` 仅保留完成块缓存未命中探针；Phase 2 候选 A 曾用于测试和离线测量，因未通过 retention 门槛已回退，候选 B 只在 Phase 1 工具中原型化。

## Phase 2：A-only 实测与验收

候选 A 曾短暂实现并只用于本阶段测试和测量。按本节的 retention 门槛，它没有通过；之后已从生产 `lex.ts` 回退，只保留 Phase 1 的 `md.lexFinalMiss` 探针。以下结果记录的是回退前的 A 实现。

### 同路径、无 wrapper 的测量

- Node `v24.18.0`。每个样本独立运行 `node --expose-gc`；测量前后各执行两次 GC。`retainedBytes = heapUsed_after - heapUsed_before`，是离线 Node 堆差，不是宿主内存读数。
- `tools/current-lex.ts` 是 `c8ed5c7` 的真实 `lex.ts` 副本，只改了依赖相对路径并加入 Phase 1 已批准的 miss counter。`tools/candidate-a-lex.ts` 是当时新 `lex.ts` 的副本，只改依赖相对路径。两份代码都直接使用 `Map<string, Token[]>`，回放都通过 `tools/retention-replay.ts` 调用实际 `lexBlock`；没有缓存模型、per-entry wrapper 或 token-tree JSON 序列化。
- 两边共用 `createBlockCache`、`splitBlocks`、`repairTail`、fixture 读取和 replay 顺序。history/markdown 各跑三次；multi-session 固定 6 轮 × 6 个 fixture，共 36 个 session，关闭每轮状态后强制 GC。完成条目数由真实 `lexCacheSize()` 读取。
- Candidate A 的预算为 `350,000` 个 source code units；系数采样值 `7.6761` 下对应 `2,686,635` 个 proxy units。采样系数随 workload 在 `2.77–18.9` 变化，单位只是 source-length proxy，不是 bytes。单个 entry 不限大小，因此没有固定内存上界。

### Retained bytes

| 序列 | Current runs (bytes) | A runs (bytes) | Current median | A median | A − Current | 最大 `|A/A|` | 完成条目 Current / A | replay misses Current / A |
|---|---|---|---:|---:|---:|---:|---:|---:|
| `history-100` | 1,691,336 / 1,691,352 / 1,691,000 | 1,692,136 / 1,692,224 / 1,692,456 | 1,691,336 | 1,692,224 | **+888** | **352** | 305 / 305 | 305 / 305 |
| `markdown-long` | 1,732,624 / 1,732,328 / 1,732,328 | 1,733,480 / 1,733,800 / 1,733,512 | 1,732,328 | 1,733,512 | **+1,184** | **320** | 107 / 107 | 107 / 107 |
| `multi-session` | 3,362,288 / 3,362,696 / 3,363,728 | 2,796,808 / 2,796,840 / 2,797,456 | 3,362,696 | 2,796,840 | **−565,856** | **1,440** | 500 / 355 | 3,685 / 5,695 |

下面列出每个 sequence、每个版本的所有三组 A/A 配对；相对差定义为 `abs(A−B) / ((A+B)/2) × 100%`。

| 序列 | 模式 | Pair | 绝对差 (bytes) | 相对差 |
|---|---|---:|---:|---:|
| `history-100` | current | 1–2 | 16 | 0.0009% |
| `history-100` | current | 1–3 | 336 | 0.0199% |
| `history-100` | current | 2–3 | 352 | 0.0208% |
| `history-100` | A | 1–2 | 88 | 0.0052% |
| `history-100` | A | 1–3 | 320 | 0.0189% |
| `history-100` | A | 2–3 | 232 | 0.0137% |
| `markdown-long` | current | 1–2 | 296 | 0.0171% |
| `markdown-long` | current | 1–3 | 296 | 0.0171% |
| `markdown-long` | current | 2–3 | 0 | 0.0000% |
| `markdown-long` | A | 1–2 | 320 | 0.0185% |
| `markdown-long` | A | 1–3 | 32 | 0.0018% |
| `markdown-long` | A | 2–3 | 288 | 0.0166% |
| `multi-session` | current | 1–2 | 408 | 0.0121% |
| `multi-session` | current | 1–3 | 1,440 | 0.0428% |
| `multi-session` | current | 2–3 | 1,032 | 0.0307% |
| `multi-session` | A | 1–2 | 32 | 0.0011% |
| `multi-session` | A | 1–3 | 648 | 0.0232% |
| `multi-session` | A | 2–3 | 616 | 0.0220% |

### Misses and render-pass mapping

| 场景 | Calls | Current misses | A misses | Current / A completed entries |
|---|---:|---:|---:|---:|
| 单个大块，74,799 chars | 4 | 1 | 1 | 1 / 1 |
| 三个大块，共 222,097 chars | 15 | 3 | 3 | 3 / 3 |
| `history-100`，331 个块，共 56,128 chars | 662 | 305 | 305 | 305 / 305 |

`MdBlock` 的 context 改变会导致 memo 重新渲染并再次调用 `lexBlock`；单大块用 `open=true` 模拟 streaming render，之后 `open=false` 模拟 stream finish，再走 theme 与 font-size context passes。三大块按首次挂载及 theme/font-size 往返共五轮；history-100 做初次挂载和一次 theme pass。以上三个要求场景的 miss 数与 current 持平。multi-session retention replay 自身的 miss 从 3,685 增至 5,695，也记录在表中；它不属于上述三项 render-pass miss gate。

### Go/no-go：**STOP**

- multi-session retained-byte 降低 `565,856` bytes，大于该序列最大 `|A/A|` `1,440` bytes：通过。
- history-100 的 `A−Current = +888` bytes，大于该序列最大 `|A/A|` `352` bytes；markdown-long 的 `+1,184` bytes，大于 `320` bytes。两项都出现超出 A/A 的正向 retained-byte 增加，未通过“candidate−current 在各自 `|A/A|` 内”的条件。
- 单大块、多大块、history-100 render-pass misses 均未增加：通过。
- 总门槛未通过，因此撤销了生产缓存预算策略；只保留完成块 miss counter。没有增加其他策略。

### Phase 2 raw data

- `raw/phase2-current-{history-100,markdown-long,multi-session}-run{1,2,3}.json`、`raw/phase2-a-{history-100,markdown-long,multi-session}-run{1,2,3}.json`：六组各三次保留量原始数据。
- `raw/phase2-aa-pairs.json`、`raw/phase2-retention-summary.json`：全部 A/A 配对及序列汇总。
- `raw/phase2-miss-{current,a}-{single-large,multi-large,history-100}.json`：真实 `lexBlock` debug counter render-pass misses。
- `raw/phase2-red-before-tests.json`、`raw/phase2-validation.json`：预算测试的红测证据，以及候选回退前/后的检查退出码和产物尺寸。
- `tools/current-lex.ts`、`tools/candidate-a-lex.ts`、`tools/retention-replay.ts`、`tools/retention-current.ts`、`tools/retention-a.ts`：wrapper-free retention replay。
- `tools/miss-scenarios-real.ts`、`tools/miss-current.ts`、`tools/miss-a.ts`：真实词法器的 miss replay。

### Phase 2 重现命令

```bash
npx esbuild docs/bench/2026-10-14-p2/tools/retention-current.ts --bundle --platform=node --outfile=/tmp/bc-perf-p2/retention-current.cjs
npx esbuild docs/bench/2026-10-14-p2/tools/retention-a.ts --bundle --platform=node --outfile=/tmp/bc-perf-p2/retention-a.cjs
node --expose-gc /tmp/bc-perf-p2/retention-current.cjs history-100
node --expose-gc /tmp/bc-perf-p2/retention-a.cjs history-100
node --expose-gc /tmp/bc-perf-p2/retention-current.cjs multi-session
node --expose-gc /tmp/bc-perf-p2/retention-a.cjs multi-session
npx esbuild docs/bench/2026-10-14-p2/tools/miss-current.ts --bundle --platform=node --outfile=/tmp/bc-perf-p2/miss-current-real.cjs
npx esbuild docs/bench/2026-10-14-p2/tools/miss-a.ts --bundle --platform=node --outfile=/tmp/bc-perf-p2/miss-a-real.cjs
node /tmp/bc-perf-p2/miss-current-real.cjs multi-large
node /tmp/bc-perf-p2/miss-a-real.cjs multi-large
```

## 方法

- 基线 ref：`c8ed5c7efd0bd29ea65ad560312e81e1ccad927d`；Node：`v24.18.0`。每个 retention 样本由独立 Node 进程运行 `--expose-gc`，测量前后各强制 GC 两次。
- `retainedBytes = process.memoryUsage().heapUsed_after - heapUsed_before`。这是离线 Node 进程堆差值，包含该次 fixture 仍存活的输入/分块状态；**不是宿主内存读数**，不能推导 Web、iOS、Android 或生产内存。
- A/A 每个序列跑 3 次；每一对的相对差定义为 `abs(A-B) / ((A+B)/2) × 100%`。止损使用所有 A/A 配对中最大的绝对字节差。
- `multi-session` 固定为 6 轮、每轮依次打开并关闭 `history-100`、`markdown-long`、`codeblock-streaming`、`reasoning-long-sections`、`table-streaming`、`shell-log-large`，共 36 个 session。每条回复前插入唯一 HTML marker，marker 长度轮换为 0、32、256、2,048、8,192、16,384 个字符，以避免跨 session 命中并形成不同大小的输入。关闭 session 后释放其文本与分块缓存，只留下模块级 lex 缓存。当前实现最终填满 500 个完成块槽，保留的源长度合计 588,708 个 UTF-16 code units，marker 计数 1,032。
- 当前 retention 路径调用生产 `lexBlock`；A/B 路径调用同一 `Lexer` 与 `LEXER_OPTIONS`，只替换离线缓存策略。候选不序列化 token 树；报告的重量始终是源长度代理值，不是精确字节数。
- 权重系数取三类工作负载的 cache-only retained-byte/source-code-unit 比值中位数：history `7.6761`、markdown-long `18.9117`、multi-session `2.7782`，再取三者中位数 `7.6761`。其离散度说明它只能作为 proxy 系数，不能称为精确字节换算。
- 预算设为 `350,000 × 7.6761 = 2,686,635` proxy weight units：它高于 `multi-large` 三块总源长 222,097 个 code units，同时低于 current multi-session LRU 的 588,708 个 code units。B 的 oversize 阈值用 current multi-session LRU 的 P90 源长 `2,087 × 7.6761 = 16,020.02`，并取两个 oversize 槽。两种候选都保留完成块 500 条上限和流式尾块 8 条上限。

## 当前实现 A/A

| 序列 | Run 1 (bytes) | Run 2 (bytes) | Run 3 (bytes) | 完成块 / 尾块 | 最终 LRU 源长 (chars) |
|---|---:|---:|---:|---:|---:|
| `history-100` | 1,721,928 | 1,721,672 | 1,722,208 | 305 / 8 | 55,764 |
| `markdown-long` | 1,766,960 | 1,764,904 | 1,764,904 | 107 / 8 | 20,571 |
| `multi-session` | 3,208,352 | 3,213,912 | 3,214,552 | 500 / 8 | 588,708 |

| 序列 | 配对 | 绝对差 (bytes) | 相对差 |
|---|---|---:|---:|
| `history-100` | 1–2 | 256 | 0.0149% |
| `history-100` | 1–3 | 280 | 0.0163% |
| `history-100` | 2–3 | 536 | 0.0311% |
| `markdown-long` | 1–2 | 2,056 | 0.1164% |
| `markdown-long` | 1–3 | 2,056 | 0.1164% |
| `markdown-long` | 2–3 | 0 | 0.0000% |
| `multi-session` | 1–2 | 5,560 | 0.1731% |
| `multi-session` | 1–3 | **6,200** | **0.1931%** |
| `multi-session` | 2–3 | 640 | 0.0199% |

最大 `|A/A|` 为 **6,200 bytes**（multi-session run 1–3）。

## 候选 retention 对照

每格为三次候选运行的中位 retained bytes；Δ = current 中位数 − 候选中位数，正值代表本次离线口径降低。history 与 markdown-long 中候选没有实际淘汰，源长和条目数与 current 相同，因此这些小幅读数差不作为策略收益。

| 序列 | Current median | A median (Δ) | A 完成条目 / 源长 | B median (Δ) | B 完成条目 / 源长 |
|---|---:|---:|---:|---:|---:|
| `history-100` | 1,721,928 | 1,734,896 (−12,968) | 305 / 55,764 | 1,735,352 (−13,424) | 305 / 55,764 |
| `markdown-long` | 1,764,904 | 1,771,984 (−7,080) | 107 / 20,571 | 1,772,048 (−7,144) | 107 / 20,571 |
| `multi-session` | 3,213,912 | **2,852,488 (+361,424)** | 355 / 342,941 | **2,868,528 (+345,384)** | 500 / 114,110 |

## 完成块 miss 与解析时间

当前列由真实 `lexBlock` 的 `md.lexFinalMiss` 探针读取；候选列来自离线缓存模型。时间为每个脚本运行的单次累计解析时间，未做 A/A 配对，不据此宣称 CPU 收益。

| 场景 | Current miss / ms | A miss / ms | B miss / ms | render-pass 模拟 |
|---|---:|---:|---:|---|
| 单个大块 | 1 / 0.934 | 1 / 0.606 | 1 / 0.889 | 74,799-char code fence：streaming render、finish (`open=false`)、theme 与 font-size 两次 context 重渲染 |
| 多个大块 | 3 / 1.048 | 3 / 1.035 | 15 / 2.413 | 3 个 code fence（72,499、72,499、77,099 chars），初次挂载及 4 次 theme/font-size 往返，共 15 次块渲染 |
| `history-100` | 305 / 5.884 | 305 / 5.107 | 305 / 5.683 | 331 个源块，首次浏览与一次 theme context 重渲染，共 662 次块渲染 |

模拟依据：`MdBlock` 的 `context` 改变会让 memo 比较失败并再次调用 `lexBlock`；流式结束时最后块的 `open` 从 `true` 翻为 `false`。完成块探针只统计 LRU 未命中，尾块从 8 槽 streaming cache 转完成块时的一次 miss 是 current 已有行为。

## 判定

- **候选 A 满足本 Phase 1 离线门槛**：多 session retained bytes 降低 361,424 bytes，大于最大 A/A 差 6,200 bytes；`multi-large` miss 为 3，与 current 3 相同。可供父会话决定是否进入 Phase 2；本阶段不实施候选 A。
- **候选 B 不满足门槛**：multi-session retained bytes 降低 345,384 bytes，大于 6,200 bytes；但 `multi-large` miss 从 3 增至 15，违反不得增加该场景 misses 的规则。
- 两种候选都没有固定字节硬上限：单个输入条目不受大小限制；A 会保留最新的单个超预算条目，B 的 oversize 槽也允许单条无限增大。

## 重现命令

```bash
npx esbuild docs/bench/2026-10-14-p2/tools/recheck-lex-retention.ts --bundle --platform=node --outfile=/tmp/bc-perf-p2/recheck-lex-retention.cjs
node --expose-gc /tmp/bc-perf-p2/recheck-lex-retention.cjs current history-100
node --expose-gc /tmp/bc-perf-p2/recheck-lex-retention.cjs a multi-session 2686635 7.6761 2
node --expose-gc /tmp/bc-perf-p2/recheck-lex-retention.cjs b multi-session 2686635 7.6761 2 16020.02
npx esbuild docs/bench/2026-10-14-p2/tools/miss-scenarios.ts --bundle --platform=node --outfile=/tmp/bc-perf-p2/miss-scenarios.cjs
node /tmp/bc-perf-p2/miss-scenarios.cjs current multi-large
node /tmp/bc-perf-p2/miss-scenarios.cjs a multi-large 2686635 7.6761 2 16020.02
```

## Raw data

- `raw/current-{history-100,markdown-long,multi-session}-run{1,2,3}.json`：当前实现 retention A/A。
- `raw/aa-pairs.json`：每个 A/A 配对的绝对差、相对差与最大值。
- `raw/calibration-a-unbounded-*-run{1,2,3}.json`、`raw/calibration-summary.json`：系数采样与预算参数推导。
- `raw/a-{history-100,markdown-long,multi-session}-run{1,2,3}.json`、`raw/b-...`、`raw/candidate-retention-summary.json`：候选 retention 原始结果与汇总。
- `raw/miss-{current,a,b}-{single-large,multi-large,history-100}.json`、`raw/miss-summary.json`：miss、探针计数、render-pass 和单次累计解析时间。
- `raw/validation.json`：基线与加探针后的命令退出码、测试计数和 bundle 字节数。
- `raw/*final-smoke.json` 和不带 `-runN` 后缀的 `raw/calibration-a-unbounded-*.json` 是最终脚本的预检样本；上表 A/A 与系数采用有 run 编号的最终样本，不将预检样本混入配对或中位数。
