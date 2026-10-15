# 流式尾块复用：iOS 前后对照（2026-10-15）

被测改动：`768ff43`（perf(markdown): redraw only what a streamed chunk changes in a reply）和 `633d208`（perf(scroll): commit a sideways scroller's width only when its indicator shows it）。before 是改动前的 `0a930bd`，after 是 `633d208`，两者之间只有这两个提交。

## 结论

代码块、表格、长回复三个场景，每一次 after 都短于每一次 before，组间没有重叠。混合一轮和两个思考场景持平。

| 场景 | 次数 | 每行渲染耗时合计（中位数） | 变化 | 主卡片 p95 | 掉帧比例 | 各次读数 before / after |
|---|---:|---:|---:|---:|---:|---|
| 代码块流式 | 3+3 | 988.1 → 719.2 ms | −27% | 5.7 → 4.5 ms | 0.13 → 0.10 | 968, 1000, 988 / 753, 690, 719 |
| 表格流式 | 3+3 | 699.8 → 543.4 ms | −22% | 8.1 → 6.3 ms | 0.13 → 0.12 | 643, 700, 716 / 516, 577, 543 |
| 长回复 | 3+3 | 1837.4 → 1517.6 ms | −17% | 5.6 → 5.1 ms | 0.28 → 0.27 | 1822, 1874, 1837 / 1567, 1505, 1518 |
| 混合一轮 | 3+3 | 271.3 → 248.9 ms | −8%（读数重叠，记为持平） | 3.5 → 3.3 ms | 0.06 → 0.06 | 271, 310, 251 / 249, 249, 288 |
| 思考散文 | 6+6 | 358.6 → 361.4 ms | +1%（持平） | 3.3 → 3.0 ms | 0.03 → 0.03 | 324, 339, 373, 358, 360, 363 / 340, 364, 359, 374, 376, 315 |
| 思考分节 | 6+6 | 315.8 → 318.1 ms | +1%（持平） | 3.2 → 3.2 ms | 0.04 → 0.03 | 316, 315, 303, 320, 350, 312 / 317, 331, 311, 271, 319, 329 |

主卡片：思考场景取 reasoning 行，其余取 assistant 行。表由 `python3 tools/summarize.py` 从 `raw/ios` 生成。

- 两个思考场景按默认设置折叠，流式时不挂载 Markdown，改动的代码在这里几乎不运行。前 2 轮思考散文是 +6%，补到 6 轮后是 +1%，那 6% 是噪声。
- 掉帧比例基本不变。开发版模拟器的掉帧主要来自宿主和开发模式本身，这组数字不能代表真机发布版的手感。
- 离线口径（Node 开发模式，react-test-renderer 加宿主元素替身，7 轮中位数，两次交替 A/B）的降幅更大：长回复 142–190 → 91–99 ms，代码块 280–293 → 126–138 ms，表格 64–81 → 41–51 ms；每个 chunk 重渲染的 Text 从 4.6 / 22.7 / 18.6 个降到 3.8 / 4.4 / 5.5 个。iOS 上还有宿主行外壳和原生端的固定开销，所以比例小一些。正确性由 `test/unit/markdown-stream-reuse.test.ts` 保证：每个 fixture 的每个 chunk，以及一份逐字符流式的压力文档，增量渲染都和全新挂载完全一致。

## 方法

- 机器：rrd-mac-studio（Apple M5 Max），1 分钟负载约 5–10。另一个 agent 的 iOS 基准在同一台机器上同时运行，两边都有 CPU 争用，所以绝对毫秒数只在本组内部比较，不和 `docs/fork-vs-upstream.md` 的 10 月 14 日表对读。
- 宿主：Paseo 0.11.2 开发版，iPhone 16 Pro 模拟器，iOS 18.6，加宿主探针补丁（[`native-vs-fork/tools/paseo-host-probe.patch`](../native-vs-fork/tools/paseo-host-probe.patch)）。指标是 `StreamItemWrapper` 外层 `React.Profiler` 的 `actualDuration`，和 10 月 14 日的 iOS 三方表同一口径。
- 隔离：单独的模拟器、daemon（6879）、Metro（8096）、控制服务（8098）。宿主 checkout 是 APFS 克隆，探针的控制端口从 8099 改成 8098。两版插件各放一个目录，用 `paseo plugin reload` 切换符号链接。
- 回放：`bc-bench` 提供方按 fixture 原速回放（速度 1），iOS 上回复按帧揭示。每次运行前冷启动 App。每个场景、每一轮里 before 和 after 都跑，先后顺序逐轮交替。每份 dump 都带版本标识，校验通过才记录（`identity`、`mode`、插件路径）。

## 不点击的驱动方式

Xcode 27 下 serve-sim 的点击要经过 DeviceHub 转发，到不了第二台无头模拟器。所以这次全程没有点击：

- 冷启动：`xcrun simctl launch <udid> sh.paseo.debug --initialUrl http://localhost:<metro>`。expo-dev-launcher 读这个启动参数，不弹 "Open in" 确认框。
- 进入 agent 页：给探针控制通道加一个 `open` 命令（[`tools/patch-hp.py`](tools/patch-hp.py)）。app 先调用 `refreshWorkspaceDirectory`，再自己调用 `Linking.openURL`。app 内部打开自家 scheme 不会弹确认框；新装的 app 从没加载过工作区目录（平时打开侧边栏时才加载），不先刷新就会一直停在 "Loading workspace"。驱动脚本的对应改动见 [`tools/patch-ab.py`](tools/patch-ab.py)。
- 通知权限：模拟器关机时，把一台已经回答过通知授权的模拟器里 `sectionInfo/sh.paseo.debug` 这一条，合并进新模拟器的 `data/Library/BulletinBoard/VersionedSectionInfo.plist`（[`tools/bb.py`](tools/bb.py)）。`simctl privacy` 不支持授权通知。
- 调试：[`tools/cdp-eval.mjs`](tools/cdp-eval.mjs) 通过 Metro 的 inspector 在 app 里执行表达式。Hermes 不接受 `async` 表达式，要用 `.then`。

这几个补丁脚本写死了当时的 `/tmp` 路径，复用前要按实际位置修改。
