# P0/P1 宿主非回退测量与功能验收（2026-10-14）

方案：[性能优化方案](../../plans/2026-10-14-performance-optimization.md) 的 P0（当前 A/A 配对差异）与 P1（缓存高亮键、最大行号单次遍历）。本文只记录本轮实测，不引用历史基准数字。P1 的主证据是单测里的计算次数与行为等价；宿主数据只用于检查有无回退，不据此宣称提速。

## 1. 环境

| 项 | 值 |
| --- | --- |
| 基线插件 | `8425dd0`（`git archive` 两份：`/tmp/bc-perf-p0p1/base`、`base2`，各自 `npm ci`） |
| 候选插件 | `perf/p0-p1` worktree，`8425dd0` 加未提交改动（`client/highlight.ts`、`client/components/syntax-highlight.tsx`、`client/debug/*`、`client/image-file.ts`） |
| daemon | 私有实例 `~/.paseo-bench-p0p1`，`127.0.0.1:6871`，Paseo 0.11.2；只装 `bc-bench`（本 worktree 的 `tools/bench-provider`）和 `better-paseo`（经 `/tmp/bc-perf-p0p1/bench-active` 符号链接切换）。脚本先经 `tools/guard.mjs` 核对 home、监听端口与 `daemon status`，页面拦截 6767/6868/6869 的 WebSocket。未读写、未连接 6767/6868/6869 |
| 宿主 | Paseo `759532509`（v0.11.2）加宿主探针补丁的 Web 生产导出 `/tmp/bcnp-web-dist`（主 JS sha256 前缀 `9dd7eab4521434bc`），本地 8092 只读服务 |
| 浏览器 | headless Chrome 155.0.8059.40，1280×900，`zh-CN`，独立 profile |
| 每次运行的插件身份 | 页面加载后断言 `"imageRpc" in __bcPerf.snapshot()`：候选为真、基线为假。30 次计时运行与全部 QA 均通过该断言 |
| 机器负载 | 同机有多个 agent 在跑：diff-expand 期间 1 分钟负载 17.9–51.8，diff-large 期间 13.7–116.3。数字只在同一批交替运行之间比较 |

## 2. 方法

- 每轮按 `base1, base2, cand` 轮转顺序各跑一次，共 5 轮；每次新建 agent、整页重新加载。A/A 配对为同一轮的 `base2 − base1`；候选差为同一轮的 `cand − base1` 与 `cand − base2`，各取中位数。
- 判定：候选差中位数的绝对值不超过 A/A 配对差中绝对值最大的一对，记为 “not exceeded”，即“未观察到超出 A/A 噪声的回退”。这不等于证明没有回退。
- 时间指标先读，再 `HeapProfiler.collectGarbage`，然后读堆与节点。
- 场景：
  - **diff-expand**（覆盖 P1 路径）：`diff-large` 以 `speed:max` 回放完（不计时）后开始计时：展开 Edit 行（挂载 `SyntaxHighlightBlock`），点 “Show 5116 more lines” 分批展开 5128 行，等 7 秒，然后深色、浅色各切一次主题。
  - **diff-large:1**（方案 §5 的“大 diff”行，沿用原 web-ab 口径）：整段流式回放计时。Edit 行全程折叠、`SyntaxHighlightBlock` 不挂载（DOM 节点恒为 990），**P1 代码不在此路径上**，只作参照。

## 3. A/A 与候选对照

原始数据：`raw/web/*.json`；表格由 `tools/pairs.mjs` 生成，见 `raw/pairs-diff-expand.txt` 与 `raw/pairs-diff-large.txt`。

### 3.1 diff-expand（n=5）

| 指标 | base1 中位 | base2 中位 | cand 中位 | A/A 最大绝对差 | cand−base1 中位 | cand−base2 中位 | 判定 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Task ms | 1719 | 1676 | 1805 | 268 | +86 (+5.0%) | +74 (+4.4%) | not exceeded |
| Script ms | 724 | 673 | 708 | 137 | −16 (−2.3%) | +47 (+7.0%) | not exceeded |
| Layout+Style ms | 322 | 301 | 335 | 58.4 | +12.9 (+4.0%) | +22.8 (+7.6%) | not exceeded |
| 行渲染 p95 ms | 19.7 | 16.8 | 20.1 | 8.7 | +0.4 | +1.8 | not exceeded |
| 单次提交 p95 ms | 23.5 | 18.1 | 20.4 | 7.2 | −3.1 | +1.6 | not exceeded |
| 行渲染合计 ms | 278 | 239 | 258 | 73.1 | −8.6 | +19.0 | not exceeded |
| 长任务 ms | 383 | 395 | 352 | 140 | +9 | +20 | not exceeded |
| CLS | 0.081 | 0.041 | 0.041 | 0.061 | −0.040 | 0.000 | not exceeded |
| GC 后 JS 堆 MB | 122 | 123 | 123 | 1.27 | −0.46 | −0.25 | not exceeded |
| GC 后 DOM 节点 | 40505 | 40522 | 40545 | 34 | +1 | +11 | not exceeded |

每对 A/A 差值见原始表。Task 的 A/A 差在 −15.3% 到 +16.1% 之间，方向不一；候选 Task 中位数比两组基线都高 4–5%，但仍在 A/A 范围内。这批数据既不能证明候选更快，也不能排除小于噪声的差异。

### 3.2 diff-large:1（n=5，P1 代码不在路径上）

| 指标 | base1 中位 | base2 中位 | cand 中位 | A/A 最大绝对差 | cand−base1 中位 | cand−base2 中位 | 判定 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Task ms | 395 | 373 | 330 | 467 | −42 | −21 | not exceeded |
| Script ms | 151 | 166 | 167 | 97.3 | +16.9 | +2.8 | not exceeded |
| Layout+Style ms | 30.8 | 35.3 | 33.1 | 9.8 | +1.7 | −1.8 | not exceeded |
| 行渲染 p95 ms | 1.7 | 2.3 | 1.9 | 0.8 | +0.2 | −0.4 | not exceeded |
| GC 后 JS 堆 MB | 111 | 111 | 111 | 0.62 | −0.17 | +0.42 | not exceeded |
| GC 后 DOM 节点 | 990 | 990 | 990 | 0 | 0 | 0 | not exceeded |

第 2 轮 base1 的 Task 为 752ms（负载峰值期间），A/A 最大差因此偏大。长任务与 CLS 的 A/A 差全为 0 或单向，只报告、不判定。

## 4. 宿主内计数（候选，`/bc-perf` 探针）

计数只在单独的 QA 运行中开启，不混入计时。原始数据：`raw/qa/cand-qa2.json`。

| 操作 | `highlight.cacheKey` | `code.maxLineNumber` | 高亮 RPC |
| --- | ---: | ---: | ---: |
| 展开 diff-large（挂载） | 1 | 1 | 1 |
| 点“显示全部”，5128 行分批追加 | 1 | 1 | 1 |
| 点 “Show less” | 1 | 1 | 1 |
| 设置页预览：切深色（阳性对照，`dark` 是键维度） | 0 → 1 | — | 1 |
| 设置页预览：代码字号 +4、换行开、换行关 | 保持 1 | — | 1 |
| 设置页预览：切回浅色 | 1 → 2 | — | 1（浅色已缓存） |

基线没有这两个计数器，宿主内无法给出基线次数；基线“每次渲染都重算”的结论来自单测（见实施报告）。所有场景里图片 RPC 都是 0 次，因为这些 fixture 不含图片，P3 所需的重复在途数据本轮没有采到。

## 5. Web 功能验收（基线 vs 候选）

原始数据：`raw/qa/{base1,cand}-qa.json`、`-qa2.json`、`-xl.json` 和截图。逐字节比较用的全文与复制文本体积较大，未入库，SHA-256 与字节数见 `raw/qa/SHA256SUMS-removed-text.txt`。

| 项 | 结果 |
| --- | --- |
| 流式最终内容（codeblock-streaming:1） | 一致：转录文本只差消息时间戳 |
| 流式贴底 | 一致：流式中 8 次采样与底部距离均为 0 |
| 用户上滚后不再跟随 | 一致：上滚后 scrollTop 保持 143，内容继续增长 |
| diff 行号 | 一致：4946 个行号，末行号 5603 |
| 行号列宽 | 一致：12px 时 40px，16px 时 48px |
| “显示全部”与 “Show less” | 一致：9 ↔ 4946 个行号，按钮文字恢复为 “Show 5116 more lines” |
| 全文复制 | 逐字节一致：231,658 字节，5129 行 |
| 展开后全文 | 逐字节一致：255,413 字符 |
| 折叠和展开 Edit 行 | 一致：`aria-expanded` 为 true / false |
| 深色和浅色主题下的 diff 块 | 元素截图逐像素比较，差异为 0 像素（780×270） |
| 代码字号 16px 下的 diff | 一致：行号数、列宽 48px、块高 143,982px、文本哈希均相同 |
| 超长 diff（40 万行，最大行号 392,000，fixture 由 `tools/gen-diff-xl.py` 临时生成，用后已删除） | **基线：该行渲染失败**，显示 “Plugin failed: Maximum call stack size exceeded”，控制台报 `RangeError … at SyntaxHighlightBlock`。**候选：正常展开**，列宽 56px，显示 “Show 399991 more lines”，无报错。截图见 `raw/qa/{base1,cand}-xl.png` |

超长 diff 的结论只适用于 Chrome 155 的 V8。同机 Node 24（V8 13.6）上，spread 传参在 12 万个时正常、15 万个时抛错。Hermes 的上限与行为仍未验证。

**两版本都存在的既有行为**（与 P1 无关，本轮不处理）：

- 切换主题后 diff 块会重新挂载，“显示全部”的状态回到折叠。
- 回复的 “Copy / 时间” 行位置随回放时序变化。整页截图中两版本各出现过两种位置，因此整页截图的像素差不可用，改用元素截图比较。

## 6. 未验证与缺口

- **iOS 模拟器：本节当时未验证，后在 rrd-mac-studio 上补做，见第 10 节。** 本机唯一闲置的 bench 模拟器 `bc-native-ab` 上，Paseo App 一启动就连上了日常 daemon（侧边栏是用户的真实工作区）。继续在上面操作有误触日常 daemon 的风险，所以只启动了一次就关闭，没有添加主机，也没有任何点击，App 已恢复为未运行状态。
- **Android：未验证。** `emulator-5554` 上已有其他会话设置的 `adb reverse`（6872、8086），说明正被其他工作使用，本轮未接管。没有连接真机。
- 代码字号的实时切换只在设置页预览上测了计数，没有做计时；时间线里没有能实时切换字号的入口。
- 方案 P0 的 daemon 内存离线测量（P4 前置）与图片重复在途数据（P3 前置）本轮未采集。
- 机器负载高，A/A 噪声大；小于噪声的回退无法排除。

## 7. 复现

脚本在 `tools/` 下。运行时放在 `/tmp/bc-perf-p0p1/tools`，`node_modules/playwright-core` 符号链接到主仓库的 `.showcase/node_modules/playwright-core`；脚本内的路径都按这个布局写死。

```bash
node bench.mjs --scenario diff-expand --reps 5 --out <dir>
node bench.mjs --scenario diff-large --reps 5 --out <dir>
node pairs.mjs <dir> diff-expand
node qa.mjs base1 <qaDir> && node qa.mjs cand <qaDir>
node qa2.mjs base1 <qaDir> && node qa2.mjs cand <qaDir>
node blockshot.mjs base1 <qaDir> && node blockshot.mjs cand <qaDir> && node pixdiff.mjs …
python3 gen-diff-xl.py <worktree>/test/fixtures/streams/diff-xl-p0p1.jsonl   # 临时，用后删除
node xl.mjs base1 <qaDir> && node xl.mjs cand <qaDir>
```

## 8. 低负载复测：rrd-mac-studio（M5 Max 18 核，64GB）

为了排除本机高负载的干扰，在 `rrd-mac-studio` 上用同样的方法复测。远程环境：

- 私有 daemon `~/.paseo-bench-p0p1`，监听 6871。
- Paseo CLI 0.11.2 安装在私有目录 `/tmp/bc-perf-p0p1/paseo-cli`，未改动全局的 0.10.2。
- Chrome 155.0.8059.40，与本机相同；Web 导出的哈希也相同（`9dd7eab4521434bc`）。
- 测量期间 1 分钟负载 0.8–1.2。

原始数据在 `studio/raw/`，脚本在 `studio/tools/`。

### 8.1 计算次数（宿主内，非计时运行，基线与候选各 3 次，3 次结果完全一致）

基线不带计数器，所以另做了一份计数版基线（`studio/tools/base-count.patch`）：只在原有的两处计算点前加 `perfCount`，其余逻辑不变，这份副本只存在于远程临时目录。

| 操作（diff-large，5128 行） | 基线累计 | 候选累计 |
| --- | ---: | ---: |
| 展开（挂载） | 2 | 1 |
| 显示全部（每帧追加 400 行，分批追加） | 15 | 1 |
| Show less | 16 | 1 |
| 切深色 | 19 | 2 |
| 切回浅色 | 21 | 3 |

键计算与最大行号计算的次数相同。整个流程中，基线 21 次，候选 3 次，减少了 18 次（−86%）。候选剩下的 3 次是首次挂载和两次主题变化，这些是必须重算的。

单次计算的耗时（`studio/tools/micro.mjs`，同机 Node 24，取 7 组中位数）：键计算 1.41 ms（对 231,658 字符的 diff 和 222,477 字符的正文各做一次 FNV 哈希），最大行号 0.024 ms（5129 个元素）。按此推算，这个流程理论上可省约 18 × 1.44 ≈ 26 ms 的 JS 计算。这只是离线推算，没有在页面内直接测到。

### 8.2 宿主计时（diff-expand n=7，diff-large:1 n=5）

| 场景与指标 | A/A 最大绝对差 | cand−base1 中位 | cand−base2 中位 | 判定 |
| --- | ---: | ---: | ---: | --- |
| diff-expand Task ms（基线中位约 994–1010） | 102 | −22.8 (−2.3%) | +2.4 (+0.2%) | not exceeded |
| diff-expand Script ms（基线中位 403） | 11.7 | −7.2 (−1.8%) | −6.8 (−1.7%) | not exceeded |
| diff-expand 行渲染合计 ms | 16.2 | −6.8 (−4.5%) | −3.5 (−2.4%) | not exceeded |
| diff-expand 行渲染 p95 ms | 3.9 | −0.7 | −0.3 | not exceeded |
| diff-expand GC 后堆 MB | 0.61 | −0.21 | −0.29 | not exceeded |
| diff-large:1 Task ms（基线中位 287） | 12.3 | +1.2 | −6.3 | not exceeded |
| diff-large:1 Script ms | 6.4 | −2.3 | −1.0 | not exceeded |

完整表格见 `studio/raw/pairs-*.txt`。低负载下 A/A 噪声明显变小：Script 的 A/A 差在 ±3% 以内，本机是 ±25%。候选的 Script 中位数比两组基线都少约 7 ms，但仍在 A/A 最大差 11.7 ms 之内，按规则不能判定为收益。这个数值也小于 8.1 推算的约 26 ms，原因未查明。可能的解释包括离线微基准与页面内运行的 JIT 状态不同，或部分重算本来就没有落在测量窗口内。

首轮 diff-expand 在第 1 轮第 3 次运行时，因“显示全部”的按钮不在可视区域、点击未命中，被断言拦下（`show-all did not complete`）。修正为先滚动到可见再点击后，全部重跑；首轮已完成的 2 次运行作废。diff-large:1 的 5 轮在修正前已完整跑完，且不经过这段代码，结果沿用。

## 9. P0 图片 RPC 探针数据（P3 进入条件）

本节在 rrd-mac-studio 的私有 daemon 上采集，使用候选构建（P0 图片探针只存在于候选中；P1 没有改动图片请求行为）。原始数据见 `studio/raw/img/`。

- **fixture**：`images-repeat-p0`，只放在远程临时目录，副本见 `studio/raw/img/images-repeat-p0.fixture.jsonl`。内容为 1 个读图工具行（默认折叠），加上 Markdown 回复中同一张本地截图 `shot.png` 出现 4 次、`shot2.png` 出现 1 次。两张都是约 2.1 MB 的不可压缩 PNG，接近真实截图的体积。
- **探针开启方式**：`__bcPerf.enable()` 会把开关写入 localStorage。刷新页面后，探针从模块加载时就开始计数。
- **脚本**：`studio/tools/imgprobe.mjs`。

3 轮结果完全一致：

| 时机 | 图片 RPC 次数 | 同一 cwd+path 在途时再次发起（duplicatesInFlight） |
| --- | ---: | ---: |
| 流式回放 speed:1（发送后到结束） | 7 | 2 |
| 刷新页面加载历史 | 4 | 2 |
| 再展开读图工具行 | 4（无新增） | 2 |

结论：同一图片在多处出现时，打开会话会产生重复的在途读取，在这个 fixture 中每次加载会多读 2 次、每次约 2.1 MB。方案中 P3 的进入条件“回放 fixture 中记录到重复在途请求”已满足。这个数据只说明这种重复会发生，不代表真实会话中的发生频率；也没有读取任何真实会话数据。P3 是否能交付，还取决于宿主 0.8–0.11 是否都按安装分别求值插件模块（见 P3 前置调研）。

## 10. iOS 模拟器验收（rrd-mac-studio）

### 环境

- **App**：在 rrd-mac-studio 上由 Paseo `v0.11.2` 源码（`759532509`，与 Web 测量用的宿主是同一提交）编译的开发版 `sh.paseo.debug`。为适配 Xcode 27，编译时在命令行上加了 `IPHONEOS_DEPLOYMENT_TARGET=15.1`，未改动任何源码。
- **模拟器**：新建的专用设备 `bc-perf-ios`（iPhone 16 Pro，iOS 18.6，UDID `4497FFF9-93D1-4713-B55B-A9988BC2209E`），键盘与语言改为英文。
- **JS 与 daemon**：JS 由本机 Metro 8095 提供，引擎为 Hermes。App 只添加了私有 daemon `127.0.0.1:6871`；它启动时探测 localhost:6767，因该机器上没有日常 daemon，连接被拒绝。
- **插件切换**：通过私有 daemon 的符号链接加 `plugin reload` 切换。超长 diff 一项做了 A-B-A 验证，即同一会话依次在候选、基线、候选下打开。
- **截图**：原分辨率原图保存在远程临时目录 `/tmp/bc-ios/ev`，用于逐像素比较；仓库里只保留缩小到 900px 宽的副本（`ios/`）。

### 结果

| 项 | 基线 `8425dd0` | P1 候选 |
| --- | --- | --- |
| 超长 diff（40 万行，最大行号 392,000）展开 | **Hermes 渲染报错** `RangeError: Maximum call stack size exceeded (native stack depth)`，调用栈指向 `SyntaxHighlightBlock :4473:57`；关闭报错浮层后，该行显示 “Plugin failed: …”（`ios/xl-base-*.png`，`ios/metro-hermes-error.log`） | 正常展开，行号列加宽到 6 位，显示 “Show 399991 more lines”（`ios/xl-cand.png`）。同一会话切回候选后同样正常（`ios/xl-base-agent-on-cand.png`） |
| diff-large 展开后的画面 | — | 与基线相比，除状态栏时钟外只差 1 个像素（气泡边缘抗锯齿） |
| 切深色、切回浅色、显示全部 | — | 与基线相比，除状态栏时钟外差异为 0 |
| 复制（`simctl pbpaste`） | sha256 前缀 `db39e3118fbc344a`，231,658 字节 | 逐字节相同，且与 Web 上的复制结果相同 |

**结论**：方案中“待复现风险：超长 diff 的 spread 调用”已在 iOS 模拟器的 Hermes 上实际复现，P1 修复了这个问题。复现条件是开发版、模拟器上的 Hermes，真机和 release 构建上没有验证。

**两版本都存在的既有现象**（与本轮改动无关）：

- iOS 深色模式下，回复正文段落带有黑色底块（`ios/*-3-dark.png`）。
- 切换主题后，diff 块回到折叠状态。

**未验证**：

- iOS 上的流式贴底与上滚：serve-sim 无法滚动聊天列表。
- iOS 上的代码字号切换。
- Android。

`attempt-1-sandbox-blocked/` 保存的是首轮由 worker 在 Codex 沙箱内的尝试：因为监听端口时报 `EPERM`，测量没有执行，其中的驱动脚本从未运行过，仅作记录。
