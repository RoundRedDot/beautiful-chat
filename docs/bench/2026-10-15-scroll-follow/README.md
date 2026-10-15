# 流式时内容区贴底有没有跳动（2026-10-15）

问题：弹出预览以前每个 chunk 都无动画地 `scrollToEnd`，内容先被推出视口再跳回，后来改成平滑滑动（`19f6c8b`、`a1702c5`）。内容区要不要也给 Paseo 上游提一个平滑贴底的 PR？

结论：不需要。iOS 和 Web 上，Paseo 的贴底都没有"先跳再回"。插件开着时，内容只会一行一行向上移动，没有向下错位，也没有闪现帧。所以没有可修的 bug，没有提 PR。

## 宿主是怎么贴底的（getpaseo/paseo `b2ca7dcf0`）

- 原生端：倒置的 FlatList（`packages/app/src/agent-stream/strategy-native.tsx`，`inverted`）。最新内容本来就在底部，流式增长不触发滚动，是旧内容往上挤。
- Web 端：`strategy-web.tsx` 在 `useLayoutEffect` 和 ResizeObserver 里，用 `behavior: "auto"` 在同一次提交内贴底。新的一行和滚动在同一帧绘制。改成平滑滚动的话，新行会先画在视口下方再滑上来，反而引入布局偏移。

## 方法

- 环境：rrd-mac-studio 上一套独立环境，包括 daemon、Metro、宿主探针控制服务、iPhone 16 Pro 模拟器（iOS 18.6，Paseo 0.11.2 开发版），以及 Paseo 0.11.2 Web 生产构建（headless Chrome，1280×900）。插件是 main `d626bf6`。开关插件用 `paseo plugin enable/disable better-paseo`，关掉时就是 Paseo 原生渲染，作为对照。
- 回放：`bc-bench` 原速回放 `markdown-long`、`codeblock-streaming`、`table-streaming`。
- 录制：
  - iOS 用 `xcrun simctl io recordVideo`，约 40–60fps，只在画面变化时出帧。驱动脚本是 [`tools/rec.sh`](tools/rec.sh)，驱动方式同 [`2026-10-15-stream-reuse`](../2026-10-15-stream-reuse/README.md)，全程不点击。
  - Web 用 CDP `Tracing` 的 `disabled-by-default-devtools.screenshot`，也就是 DevTools 胶片，记录每一帧实际呈现的画面，约 40fps，截图 500×352。trace 缓冲区约 8 秒就满，所以按 6 秒一段连续录。见 [`tools/web-rec.mjs`](tools/web-rec.mjs)。headless Chrome 的 screencast 在 40 秒里只给了 12 帧，不能用。
- 分析：只取时间线区域（去掉标题栏和消息框；Web 另去掉侧边栏），转灰度。
  - [`tools/shift.py`](tools/shift.py)：相邻两帧的按行灰度轮廓做互相关，得出垂直位移（向上为正），同时记录匹配误差。
  - [`tools/stats.py`](tools/stats.py)：只把匹配误差小于 1 的帧算作纯平移，误差更大的是"有新文字出现的变化"。
  - [`tools/transient.py`](tools/transient.py)：找闪现帧，也就是第 i 帧和前一帧差很多，但后面 1–4 帧内某一帧又和前一帧几乎一样。
  - 检测器先用人工注入的闪现验证过：在真实录像里插入"下错 30–40px、1–2 帧后回来"的画面。iOS 6 处、Web 4 处全部检出。
- `raw/*.shifts.json` 是每段录像逐帧的位移和误差。录像本身每段 7–41 MB，没有放进仓库。

## 结果

| 录像 | 纯平移 | 向下错位 | 闪现帧 | 向上步长（iOS：px@3x） |
|---|---:|---:|---:|---|
| iOS 插件开 · 长回复 | 133 | 0 | 0 | 72（一行正文 24pt）×69，84×43，120×17 |
| iOS 插件开 · 代码块 | 56 | 0 | 0 | 54×40（一行代码） |
| iOS 插件开 · 表格 | 29 | 0 | 0 | 99×21（一行表格） |
| iOS 原生 · 长回复 | 113 | 1 | 0 | 66×65，78×30 |
| iOS 原生 · 代码块 | 79 | 2 | **1** | 51×67 |
| Web 插件开 · 长回复 | 59 | 0 | 0 | — |
| Web 插件开 · 代码块 | 38 | 0 | 0 | — |
| Web 插件开 · 表格 | 4 | 0 | 0 | — |
| Web 原生 · 长回复 | 24 | 1 | 0 | — |
| Web 原生 · 代码块 | 31 | 0 | 0 | — |

Web 截图被 Chrome 缩小过，步长单位不能和 iOS 对读，所以不列。Web 表格的纯平移只有 4 次，因为表格每加一行，列宽往往也一起变，这些帧都算进了"有新文字出现的变化"，不过闪现检查同样覆盖了它们。

- 插件开着时，6 段录像都没有向下错位，也没有闪现。内容只按行高一级一级上移，一次到达几行时就一次上移几行。
- 唯一的闪现出在 iOS 原生渲染的代码块里，持续 3 帧（约 50ms）：代码围栏快结束时，原生 Markdown 先多画出一行，随后又删掉，高度先涨后缩（[`images/fn-strip.jpg`](images/fn-strip.jpg)）。这是内容本身的变化，不是滚动造成的。插件的 `repairTail` 会先扣住半截的结束围栏，所以插件开着时没有这个问题。
- [`images/f6-strip.jpg`](images/f6-strip.jpg) 是分析器第一版误报的地方：同一帧里文字变化加上多行到达，被算成了"−96px"。看画面并没有向下错位，所以后来改为只把匹配误差小于 1 的帧当作纯平移。
