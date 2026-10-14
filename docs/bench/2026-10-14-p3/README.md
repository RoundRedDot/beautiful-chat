# P3：合并同一图片的并发读取（2026-10-14）

方案：[性能优化方案](../../plans/2026-10-14-performance-optimization.md) 的 P3。分支 `perf/p3`，叠在 `perf/p0-p1` 之上。单测与宿主测量时的基线为 `c8ed5c7`。

## 进入条件

- **重复在途**：P0 图片探针在回放 fixture 中记录到重复在途读取。数据见 `perf/p0-p1` 分支 `docs/bench/2026-10-14-p0-p1/README.md` 第 9 节。
- **宿主隔离**：已只读核实本地 Paseo 的每个标签 v0.8.0–v0.11.2（含预发布版）都按 `serverId/pluginId` 分别求值插件客户端 bundle。证据：
  - 模块代码由 `packages/server/src/server/plugins/compiler.ts:301` 包进一个函数，并按安装逐次调用。
  - `packages/app/src/plugins/registry.ts` 中的 `byHost.get(serverId)` 与 `` `${serverId}/${entry.id}` ``。

  所以模块级 Map 只在单个 daemon 连接内共享。SDK 不提供连接 id，manifest 的最低版本保持 `>=0.8.0`。这只是静态核实，没有在 Hermes 或 JavaScriptCore 上实际运行验证。

## 改动

- `client/image-file.ts`：
  - 同一 `(cwd, path)`（键用 `JSON.stringify([cwd, path])`）只共享尚未结算的读取 Promise，成功或失败结算后都删除条目，不保存任何图片结果。
  - 每个使用方各自保留卸载保护。
  - 路径变化时先清空再读取，与原有行为一致。
- P0 图片探针来自其下方的 P0 提交（`perf/p3` 叠在 `perf/p0-p1` 之上）。P3 只改了探针的调用条件：只在当前使用方真正发起 RPC 时计数，所以重复在途计数反映的是实际发出的请求。
- 测试：`test/unit/image-file.test.ts`（6 项），以及探针相关测试。

## 确定性证据（单测）

实现前 6 项 hook 用例中有 3 项失败：同一键并发时发出 2 次 RPC，探针读数为 `{count: 2, duplicatesInFlight: 1}`。实现后：

- 同一键并发只发 1 次 RPC，两个使用方拿到同一份结果。
- 不同 cwd 或 path 分别读取；用冒号或斜线拼接时会撞键的组合，也各自独立读取。
- 结算后重新挂载会发起新读取。
- 失败会共享给所有使用方，之后的挂载会重试。
- 一个使用方卸载后，其他使用方仍能拿到结果。

## 宿主验证（Web，rrd-mac-studio 私有 daemon 6871）

环境与 P0/P1 复测相同：Chrome 155.0.8059.40，Paseo 0.11.2 带探针补丁的 Web 导出。

- **基线**：`c8ed5c7` 加同一份 P0 探针补丁。
- **候选**：`perf/p3` 工作区文件。
- **执行方式**：基线与候选交替运行，每次运行前切换插件链接并 reload。

### 重复引用同一张图（fixture `raw/images-repeat-p0.jsonl`：约 2.1 MB 的 `shot.png` 在 Markdown 中出现 4 次，`shot2.png` 出现 1 次），3 轮完全一致

| 时机 | 基线 RPC / 重复在途 | 候选 RPC / 重复在途 |
| --- | ---: | ---: |
| 流式回放 speed:1 | 7 / 2 | 5 / 0 |
| 刷新后加载历史 | 4 / 2 | 2 / 0 |
| 再展开读图工具行 | 4 / 2（无新增） | 2 / 0（无新增） |
| 渲染出的 900px 图片数 | 4 | 4 |

### 不存在的图被引用两次（fixture `raw/images-missing-p3.jsonl`），2 轮完全一致

| | 基线 | 候选 |
| --- | --- | --- |
| 刷新后加载历史：RPC / 重复在途 | 3 / 1 | 2 / 0 |
| 页面文本 | 两处 `ENOENT … missing-shot.png`，存在的图正常显示 | 与基线逐字相同（时间戳已归一） |

结论：在这些 fixture 中，同图并发读取被合并，重复在途计数降为 0，显示结果和错误提示不变。每少一次读取，就少一次约 2.1 MB 的文件读取，以及一份 base64 编码后的传输。本节没有做耗时测量，也不宣称耗时收益。

## iOS 模拟器验收（rrd-mac-studio）

环境与 `perf/p0-p1` 分支 `docs/bench/2026-10-14-p0-p1/README.md` 第 10 节相同：v0.11.2 开发版，Hermes，专用模拟器只连接私有 daemon 6871。

在 App 输入框中执行 `/bc-perf on`，回放 `images-repeat-p0`（speed:1），再执行 `/bc-perf dump`。快照由 daemon 写入 `/tmp/bc-perf`，副本见 `ios/perfdump-*.json`。

| | 基线（`c8ed5c7` 加探针） | P3 候选 |
| --- | ---: | ---: |
| 实时回放：图片 RPC / 重复在途 | 7 / 2 | 5 / 0 |
| 4 张图片渲染 | 正常 | 正常 |

两边各运行 1 次，结果与 Web 上 3 轮完全一致的数值相同。

**不存在的图片**（`images-missing-p3`）：同一会话在基线构建与候选构建下的原分辨率截图，除状态栏外差异为 0 像素（原图在远程临时目录 `/tmp/bc-ios/ev`，含噪点图、体积大，未入库；`ios/miss-p3cand.png` 为缩小副本）。两处都显示 `ENOENT`，存在的图正常。

不同会话之间的截图存在差异，来源是标题、时间戳等。同一视图连续截图差异为 0，作为对照。

## 未验证

- Android 宿主未验证。
- 多个 daemon 同时连接时互不串图，只有静态代码证据，没有运行时验证。
- 文件在读取过程中被修改时的显示语义，只有单测覆盖。
- 真实会话中重复在途发生的频率未知。
