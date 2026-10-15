# Studio 图片交付 A/B：CLS 修复验证（2026-10-15）

## 结果

- `images-repeat-p0` 历史加载：fixed 的 CLS 中位数为 **0.256876**，等于 before，低于先前 Studio 参考值 0.257；per-commit p95 为 **16.5 ms**，before 为 16.3 ms；history image RPC 为 **2 次 / 0 次 in-flight duplicates**。
- `images-repeat-p0` 实时回放：fixed CLS 中位数 **0.069109**，before 为 0.203002、after 为 0.527904。fixed 五次最大值 0.196886，低于 before 五次最小值 0.203002；本次观测没有 live CLS 回归。
- `images-missing-p3` 历史加载：fixed CLS **0.254713**、per-commit p95 **21.6 ms**；before 分别为 0.254713、21.7 ms。fixed history image RPC 为 **2 / 0**。
- 三轮缺图探针没有观察到卡片 remount：before、after、fixed 的 user/assistant mount 计数均为 2/11；fixed 每轮 history RPC 都是 2 次，未出现提示中提到的 4 次；same-path RPC 在此前一次请求 resolve/reject 后再次启动的计数为 0/3。
- 上述判断只描述本轮五次计时和三次探针的观测值；未作估算或外推。

## 执行

- Studio 干净 A/B：2026-10-15 09:04:10–09:26:49 UTC。单会话按轮换顺序跑三版，probes 在计时段关闭；每场景、每版 5 次。另每版 3 次 untimed probes；每场景、每版各 1 次 layout-shift source 诊断。
- `images-repeat-p0` 每次含实时 replay 与页面 reload 后 7 秒 history-load 窗口；`images-missing-p3` 为 history-load 窗口。
- Studio：Apple M5 Max、18 核、64 GB、macOS 27.0.1；Node 24.15.0、Chrome 155.0.8059.40。私有 Paseo CLI 0.11.2；私有 daemon `~/.paseo-bench-p0p1` 只监听 127.0.0.1:6871，Web export 服务在 127.0.0.1:8092。干净批次起止 load average 分别为 1.28/1.28/1.75 和 1.53/1.27/1.41。
- 测量 build：
  - **before**：`7182232e5a017259d6d321d13d81f34c0d113c0b`，只将 `client/image-file.ts` 替换为 `bd68912^` 中版本；该文件 SHA-256 `f2602c635989b4287a380201a3426566e1ebf36d6e9c07bed59e72b9a034528f`。
  - **after**：`7182232e5a017259d6d321d13d81f34c0d113c0b` 原样；`client/image-file.ts` SHA-256 `ff37cb560fcdc03cf1549377fa40aa24a93029f8b18e79c16742ea7829240e39`。
  - **fixed**：同一 base 加入 `/tmp/bc-imgcls/step3/final.patch`；patch SHA-256 `1de5da78276d3de0bd28e955b531c92e1729450cef5c017cfd09c02b27388abf`。patch 改动 `client/image-file.ts` 和 `test/unit/image-file.test.ts`。`git apply --check` 在本机与 Studio 均通过。
- 三个 clean build 均在全新目录运行 `npm ci --include=dev`，每个安装 413 个 packages。构建时间记录在 `raw/logs/image-builds.log`。

## 身份与验证

- 计时样本记录 plugin link realpath 和 enabled/running 状态：before `/private/tmp/bc-v4/image-before`，after `/private/tmp/bc-v4/image-after`，fixed `/private/tmp/bc-v4/image-fixed`；每次均为 enabled、running。probes 使用对应带探针副本 `/private/tmp/bc-v4/image-probes/{before,after,fixed}`，这些副本的 `node_modules` 指向对应 clean build。
- 校验到 30 个 clean timed JSON、6 个 source diagnostic JSON、18 个 untimed probe JSON；每版每场景 timed 5 次、probe 3 次。build 身份字段与预期 realpath 相符。
- `images-missing-p3` 的 ENOENT 文本是缺图 fixture 的预期内容，保留在原始数据中；未把它当作 runner 失败。
- 08:32 UTC 观察到另一 Studio benchmark 活动后，先前一次 image 尝试在 08:33 UTC 停止；其 10 个 JSON 保存在 `raw/rejected-concurrent/` 并全部排除。干净重跑从 09:04 UTC 开始，期间没有观察到其它 benchmark、Metro 或 control-server 活动；未触碰其他会话或模拟器。

## 计时结果

下表为 clean timed runs 的中位数和 `[最小值, 最大值]`。CLS 为无量纲；p95 为 ms；Task/Script 为秒；heap 为 post-GC MB。探针与 source diagnostic runs 不计入此表。

### `images-repeat-p0`

| 窗口 | 指标 | before | after | fixed |
| --- | --- | ---: | ---: | ---: |
| live | CLS | 0.203 [0.203, 0.252] | 0.528 [0.416, 0.698] | 0.069 [0.069, 0.197] |
| live | per-commit p95 (ms) | 17.400 [14.300, 17.600] | 17.400 [16.800, 20.300] | 14.900 [14.500, 17.200] |
| live | row p95 (ms) | 12.000 [11.700, 14.300] | 14.400 [14.000, 17.200] | 13.800 [12.000, 14.100] |
| live | TaskDuration (s) | 0.563 [0.561, 0.571] | 0.554 [0.533, 0.558] | 0.543 [0.527, 0.575] |
| live | ScriptDuration (s) | 0.293 [0.286, 0.300] | 0.285 [0.279, 0.291] | 0.284 [0.278, 0.292] |
| live | post-GC heap (MB) | 141.297 [141.207, 149.123] | 135.345 [132.992, 141.255] | 135.612 [133.250, 135.977] |
| history | CLS | 0.256876 [0.256876, 0.256876] | 0.574978 [0.574978, 0.574978] | 0.256876 [0.256876, 0.256876] |
| history | per-commit p95 (ms) | 16.300 [16.100, 16.600] | 35.900 [35.700, 37.300] | 16.500 [16.000, 16.500] |
| history | row p95 (ms) | 10.700 [10.500, 10.800] | 6.700 [6.500, 6.800] | 10.700 [10.500, 11.200] |
| history | TaskDuration (s) | 0.935 [0.928, 0.939] | 0.918 [0.909, 0.926] | 0.922 [0.914, 0.934] |
| history | ScriptDuration (s) | 0.708 [0.706, 0.710] | 0.699 [0.697, 0.703] | 0.702 [0.700, 0.706] |
| history | post-GC heap (MB) | 137.865 [137.783, 137.893] | 132.439 [129.660, 132.499] | 132.458 [129.747, 132.533] |

### `images-missing-p3`

| 窗口 | 指标 | before | after | fixed |
| --- | --- | ---: | ---: | ---: |
| history | CLS | 0.254713 [0.254713, 0.254713] | 0.254713 [0.254713, 0.254713] | 0.254713 [0.254713, 0.254713] |
| history | per-commit p95 (ms) | 21.700 [21.000, 22.500] | 21.700 [20.900, 23.100] | 21.600 [20.300, 33.000] |
| history | row p95 (ms) | 4.300 [4.200, 4.700] | 4.300 [4.100, 4.700] | 4.500 [4.300, 6.500] |
| history | TaskDuration (s) | 0.516 [0.501, 0.518] | 0.510 [0.505, 0.520] | 0.520 [0.509, 0.525] |
| history | ScriptDuration (s) | 0.339 [0.328, 0.341] | 0.335 [0.329, 0.339] | 0.339 [0.336, 0.342] |
| history | post-GC heap (MB) | 116.004 [115.784, 116.179] | 115.897 [115.805, 116.213] | 115.901 [115.800, 116.193] |

## RPC 与卡片 remount 探针

RPC 显示为 `count / duplicatesInFlight`；每格为三次 untimed probes 的中位数。`same-path reread` 统计 history 中某路径已有 RPC resolve/reject 后，同一路径再次 `rpc-start` 的次数。

| Fixture | 版本 | live RPC | history RPC | history same-path reread | history host mounts（user / assistant） |
| --- | --- | ---: | ---: | ---: | ---: |
| `images-repeat-p0` | before | 7 / 2 | 4 / 2 | 0/3 | 2 / 13 |
| `images-repeat-p0` | after | 5 / 0 | 2 / 0 | 0/3 | 2 / 13 |
| `images-repeat-p0` | fixed | 5 / 0 | 2 / 0 | 0/3 | 2 / 13 |
| `images-missing-p3` | before | 3 / 1 | 3 / 1 | 0/3 | 2 / 11 |
| `images-missing-p3` | after | 2 / 0 | 2 / 0 | 0/3 | 2 / 11 |
| `images-missing-p3` | fixed | 2 / 0 | 2 / 0 | 0/3 | 2 / 11 |

`images-missing-p3` 的三次 fixed history 均只请求 2 次、duplicates 为 0；history 中 900px 图片数均为 1。没有观测到提醒中提到的 remount 后 4 次请求。此 remount 判读由 mount 计数和同路径重读追踪共同支持；原始 host 与 RPC event 数据均保留。

## Layout-shift 来源诊断

每个 fixture/build 各有一条 untimed source capture。entry 计数和 CLS sum 忽略 `hadRecentInput` 的条目；完整 `sources`、前后矩形及 DOM 摘要在 `raw/sources/{repeat,missing}/*.json`。

| Fixture | 版本 | live entries / CLS sum | history entries / CLS sum | 最大 history entry |
| --- | --- | ---: | ---: | ---: |
| `images-repeat-p0` | before | 8 / 0.075224 | 4 / 0.256876 | 0.250000 |
| `images-repeat-p0` | after | 7 / 0.372731 | 5 / 0.574978 | 0.318103 |
| `images-repeat-p0` | fixed | 6 / 0.054629 | 3 / 0.256887 | 0.250000 |
| `images-missing-p3` | before | 0 / 0.000000 | 4 / 0.254713 | 0.250000 |
| `images-missing-p3` | after | 0 / 0.000000 | 4 / 0.254713 | 0.250000 |
| `images-missing-p3` | fixed | 0 / 0.000000 | 4 / 0.254713 | 0.250000 |

`images-repeat-p0` after 的 history 最大额外位移为 0.318103（约 1016 ms）：source 记录到 `shot.png` 图片容器高度由 0 变为约 540 px、图片区域由 0 变为约 524 px，且同时包含 `shot2.png` 与后续文本卡片。before/fixed 没有这条图片高度变化；三版共同的 0.25 大项来自 `正在连接rrd-mac-studio` 侧栏容器宽度由 1280 px 变为 960 px。完整 entry source 不做筛选地保存在上述 JSON 中。

## 文件

- Clean timed raw：`raw/timed/repeat/`、`raw/timed/missing/`
- Untimed probes：`raw/probes/`
- Layout-shift source capture：`raw/sources/repeat/`、`raw/sources/missing/`
- Build 与执行日志：`raw/logs/image-builds.log`、`raw/logs/image-ab-clean.log`
- 被并发活动打断并排除的数据：`raw/rejected-concurrent/`
