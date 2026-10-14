# Phase B：宿主非回退测量与功能 QA

**结果：partial。** 私有 daemon、baseline 插件和 candidate 插件均成功启动/加载；Web 生产宿主未能启动，因本机沙箱拒绝监听 socket，Web A/A、candidate 对 baseline、功能 QA 和超长 diff 宿主检查均未执行。iOS、Android 的运行时也无法安全确认可用状态。没有性能 verdict，也没有“无回退”结论。

## 环境与版本

| 项目 | 值 |
|---|---|
| 插件 baseline | `8425dd0592345ec6a94e228004bfa820b5d3c9e3` |
| 插件 candidate | baseline 加未提交 Phase A `client/` 差异；差异 SHA-256 `78018b57b87a21b56d24d1f1605eb64360ee486165338368549e8865fd3fa632` |
| 宿主 | 用户指定的 `/tmp/bcnp-web-dist`；39 个文件，21 MB；文件清单 SHA-256 `9564cd1fee1b590fcd3031fb789a4a750b8b29875980720f9ba2db4961084f23` |
| 宿主 Git SHA | 静态 export 的 `metadata.json` 只有 `version: 0`、`bundler: metro`；未从产物取得 source Git SHA，因此不冒称宿主 commit |
| 构建模式 | 使用预先生成的静态 Web export；host probe 的运行时存在性未验证，因为页面没有加载 |
| 机器 | macOS 27.0.1 / arm64；Node 24.18.0 / V8 13.6.233.17-node.50；Chrome 155.0.8059.40（二进制版本，未启动） |
| 私有 daemon | `~/.paseo-bench-p0p1`，`127.0.0.1:6871`，Paseo 0.11.2，`pluginsEnabled=true`；origin 只设为 `http://127.0.0.1:8092` |
| provider | `bc-bench` 来自本 worktree 的 `tools/bench-provider`，fixture root 指向本 worktree 的 `test/fixtures/streams` |
| 回放目标 | `diff-large:1`；主题场景原计划在相同 fixture/content 上从 light 切到 dark；没有实际回放 |
| 负载观察 | 预检时 `load averages 45.16 / 50.36 / 37.98`；后续 `12.87 / 17.53 / 25.16`。这不是测量批次读数 |

Host source Git SHA、host probe、浏览器 locale/theme 实际状态均没有运行时证据。以上宿主 artifact SHA-256 用于识别只读 export，不等同于 Paseo 源码 commit。

## 方法与性能结果

计划采用每组三次 `baseline, baseline, candidate` 并轮换先后顺序；若 A/A 的方向/量级不稳定或 candidate 超出最大 A/A 绝对差异，则扩展到五组。每组会记录 Task、Script、Layout+Style 秒数、host row p95、per-commit sum p95、long tasks、CLS，以及时间读完后强制 GC 的 heap 与 DOM nodes。当前没有可比较的一组样本，所以不计算相对差、不设置 A/A 阈值，也不判定回退。

| 场景 | A/A 配对 | candidate 对 baseline 配对 | 最大 A/A 绝对差 | verdict |
|---|---:|---:|---:|---|
| `diff-large:1` | 0 / 3 | 0 / 3 | — | 不判定：Web 页面未加载 |
| `theme-switch:diff-large:1` | 0 / 3 | 0 / 3 | — | 不判定：Web 页面未加载 |

| 场景 | 指标 / 单位 | A/A 样本 | candidate−baseline | verdict |
|---|---|---:|---:|---|
| diff-large | `TaskDuration` / 秒 | 0 对 | — | 不判定 |
| diff-large | `ScriptDuration` / 秒 | 0 对 | — | 不判定 |
| diff-large | `LayoutDuration + RecalcStyleDuration` / 秒 | 0 对 | — | 不判定 |
| diff-large | host `allRows.p95` / ms | 0 对 | — | 不判定 |
| diff-large | host `perCommit.p95` / ms | 0 对 | — | 不判定 |
| diff-large | long task 数 / 总毫秒 | 0 对 | — | 不判定 |
| diff-large | CLS | 0 对 | — | 不判定 |
| diff-large | GC 后 JS heap / MB | 0 对 | — | 不判定 |
| diff-large | GC 后 DOM nodes | 0 对 | — | 不判定 |
| theme-switch | `TaskDuration` / 秒 | 0 对 | — | 不判定 |
| theme-switch | `ScriptDuration` / 秒 | 0 对 | — | 不判定 |
| theme-switch | `LayoutDuration + RecalcStyleDuration` / 秒 | 0 对 | — | 不判定 |
| theme-switch | host `allRows.p95` / ms | 0 对 | — | 不判定 |
| theme-switch | host `perCommit.p95` / ms | 0 对 | — | 不判定 |
| theme-switch | long task 数 / 总毫秒 | 0 对 | — | 不判定 |
| theme-switch | CLS | 0 对 | — | 不判定 |
| theme-switch | GC 后 JS heap / MB | 0 对 | — | 不判定 |
| theme-switch | GC 后 DOM nodes | 0 对 | — | 不判定 |

失败点是 `node .../tools/serve-web.mjs /tmp/bcnp-web-dist 8092`：端口监听检查未发现占用，但 `listen` 返回 `EPERM`。没有请求提权重试，也没有改用未带 host probe 的页面。原始阻断信息在 [`raw/environment.json`](raw/environment.json)；空样本清单在 [`raw/pair-results.json`](raw/pair-results.json)。

## Candidate 调试计数

candidate 插件已通过 `BC_PLUGIN_LINK` 指向本 worktree，并在私有 daemon 回读为 `status: running`。由于 Web 页面没有加载，未 enable/reset `globalThis.__bcPerf`，以下计数均未采集：

| 场景 | `highlight.cacheKey` | `code.maxLineNumber` | `highlightRpc` | `imageRpc` / `duplicatesInFlight` |
|---|---:|---:|---:|---:|
| theme-switch | 未采集 | 未采集 | 未采集 | 未采集；场景没有已验证的图片请求 |
| diff-large | 未采集 | 未采集 | 未采集 | 未采集；fixture 不含图片 |

## 功能 QA 矩阵

### Web

| 检查项 | 结果 | 原因 |
|---|---|---|
| streaming 最终内容一致 | 未验证 | 页面未加载 |
| copy 输出等于源内容 | 未验证 | 页面未加载 |
| diff 行号与 gutter 宽度一致 | 未验证 | 页面未加载 |
| theme / font-size 切换一致 | 未验证 | 页面未加载；font-size 自动化也未尝试 |
| show all / show less | 未验证 | 页面未加载 |
| streaming 贴底、上滚停止贴底 | 未验证 | 页面未加载 |
| 200k+ 行 extra-long diff | 未验证 | 未生成 fixture、未打开页面 |

### iOS simulator

| 检查项 | 结果 | 原因 |
|---|---|---|
| 全部功能项及 extra-long diff | 未验证 | `xcrun simctl list` 无法连接 CoreSimulatorService，不能确认指定 simulator 空闲；没有 terminate、launch、tap 或打开 host |
| Metro | 未启动 | PID `33922` 的 cwd 是 `/Users/luopeihuan/workspace/rrd/paseo/packages/app`，不属于允许复用的 `paseo/.worktrees/bc-native-perf`；simulator 服务不可用，因此没有另起 Metro |

### Android emulator

| 检查项 | 结果 | 原因 |
|---|---|---|
| 全部功能项及 extra-long diff | 未验证 | ADB host server 在 5037 启动失败，设备清单未返回；没有 serial-specific 命令、安装、forward 或应用操作 |

**ADB 操作偏差：** 初始 `adb devices -l` 清单检查未按要求带 `-s emulator-5554`。它在 host ADB server 创建 listener 时遇到 `Operation not permitted`，随后没有设备清单；没有向任何 serial 发出命令。发现该偏差后未再调用 ADB。该项按未验证处理。

## Extra-long diff 与可选项

本机 Node 对 500,000 项数组执行 spread 调用 `Math.max`，得到 `RangeError: Maximum call stack size exceeded`（Node 24.18.0 / V8 13.6.233.17-node.50）。这只说明该 Node/V8 表达式的结果，不代表 Chrome、Hermes 或 iOS/Android 结论；没有声称 Hermes 崩溃。由于 Web server 阻断，baseline 和 candidate 均未打开 extra-long diff。

P4 离线内存准备测量未做：本阶段 Web host 无法运行，且该项为可选最后步骤。

## Validation 与清理

| 命令 / 动作 | 结果 |
|---|---|
| `git archive 8425dd0` + baseline `npm ci --include=dev --offline` | exit 0；413 packages；记录到 `inflight`、`rimraf`、`glob` deprecation warnings，以及 `esbuild` / `fsevents` install script allow-list warnings |
| provider `npm run setup` | exit 0；fixture root 写入本 worktree |
| provider `npm ci --include=dev --offline` | exit 1；`zod@4.6.5` tarball 不在离线 cache |
| provider 在线 `npm ci`（临时 cache） | exit 1；DNS `ENOTFOUND registry.npmjs.org`；未改 lockfile |
| candidate Phase A client diff SHA-256 | 读取完成；Phase B 未写 `client/` 或 `test/` |
| private daemon config/start/status、bc-bench install、baseline better-paseo install、candidate symlink reload | exit 0；候选插件状态回读 `running` |
| provider / better-paseo unregister、private daemon stop | exit 0；最终插件清单为空，6871 无 listener |
| 五个 guarded driver `node --check` | exit 0（端口 guard 更新后复查） |
| instrumented host server | exit 1；`listen EPERM`；未提权重试 |
| `xcrun simctl list` | CoreSimulatorService unavailable；未能确认指定 simulator 的 idle 状态 |
| `adb devices -l` | ADB server listener 被拒绝；命令 wrapper 曾屏蔽原始 exit code，未返回设备清单 |
| 500,000 项 Node/V8 spread probe | 捕获到 `RangeError`；probe 进程 exit 0；不外推 Hermes |

私有 daemon 已停止，临时插件已注销；临时 baseline archive、symlink、provider 生成路径均清理。未创建额外 fixture、未启动 Chrome/server/Metro、未添加 simulator/emulator host entry。私有 home 本身保留但 daemon 已停止。没有触碰 `client/`、`test/`、main checkout、三个禁止 daemon 或其他模拟器/设备。
