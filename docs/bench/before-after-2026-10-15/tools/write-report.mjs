import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const evidenceRoot = path.resolve(process.argv[2] ?? "docs/bench/before-after-2026-10-15");
const rawRoot = path.join(evidenceRoot, "raw");
const reportPath = process.argv[3] ?? "/tmp/bc-ba/report.md";
const analysis = JSON.parse(readFileSync(path.join(rawRoot, "analysis.json"), "utf8"));
const detailedResults = readFileSync(path.join(rawRoot, "analysis.md"), "utf8").trim();
const beforePatch = readFileSync(path.join(evidenceRoot, "before.patch"));
const patchSha256 = createHash("sha256").update(beforePatch).digest("hex");

const format = (value, digits = 3) => value == null || !Number.isFinite(value)
  ? "n/m"
  : Number(value.toFixed(digits)).toString();
const exceptional = [...analysis.webRows, ...analysis.iosRows].filter((row) => row.verdict !== "within noise");
const countVerdicts = (rows) => Object.fromEntries(["gain", "loss", "within noise"].map((verdict) => [
  verdict,
  rows.filter((row) => row.verdict === verdict).length,
]));
const webCounts = countVerdicts(analysis.webRows);
const iosCounts = countVerdicts(analysis.iosRows);

const exceptionTable = [
  "| 平台 | 场景 | 指标 | 单位 | before 中位数 | before2 中位数 | after 中位数 | max |A/A| | after−before | 判定 |",
  "| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |",
  ...exceptional.map((row) => [
    row.scenario === "" ? "—" : (analysis.webRows.includes(row) ? "Web" : "iOS"),
    row.scenario,
    row.metric,
    row.unit,
    format(row.medians.before),
    format(row.medians.before2),
    format(row.medians.after),
    format(row.maxAbsAA),
    format(row.afterMinusBefore),
    row.verdict,
  ].join(" | ")).map((row) => `| ${row} |`),
].join("\n");

const validation = analysis.validation;
const content = `# 2026-10-15 优化轮次前后性能对比

## Result / 结论

判定规则：仅当 after−before 中位差的绝对值大于该场景同 rep 的最大 |before2−before|，且 after−before 在所有 rep 中方向一致时，标记为 gain 或 loss。其余标记为 within noise；没有估算或外推。

- Web：${analysis.webRows.length} 个场景/指标组合，${webCounts.gain} 项 gain、${webCounts.loss} 项 loss、${webCounts["within noise"]} 项 within noise。
- iOS：${analysis.iosRows.length} 个场景/指标组合，${iosCounts.gain} 项 gain、${iosCounts.loss} 项 loss、${iosCounts["within noise"]} 项 within noise。

### 超出 A/A 噪声的差异

${exceptionTable}

README even-rule 只作为次级注释，未参与 gain/loss 判定；TaskDuration 的该注释列保留在下方完整 Web 表中。

## Execution / 执行

- 执行角色与模型：measurement runner，Codex / GPT-6 Luna，thinking max（parent-verified）。
- 测量窗口：2026-10-15 02:27:28Z–06:48:42Z（Studio UTC）。Web 阶段为 02:27:28Z–04:23:29Z；iOS 阶段为 04:24:25Z–06:48:42Z，期间修正 workspace readiness 后重启续跑。
- 所有 Web 批次完成后才开始 iOS；iOS 每次冷启动，构建模式按 before / before2 / after 轮换。
- Web timed protocol：单 session、构建顺序轮换，每个模式每场景 5 次；11 个 README fixture 按 \`web-ab.mjs\` 速度播放，heap/DOM 前强制 GC。diff-expand 用 diff-large max untimed replay 后展开 Edit、Show more、切 dark/light；images-repeat timed replay+4 秒，再 reload 并等待 7 秒。Counter probes 每模式/场景 3 次且不计时。
- iOS timed protocol：11 个 fixture × 3 modes × 3 reps；每个 rep cold launch，保存 host-probe dump；记录 allRows.sum 与 perCommit.p95。

## Builds / 构建

- after：commit \`389b04f37bfbcc4a3a3d7356ee0f1e248ed9160f\`，tree \`b38d421749cf5426c974f1619122c34d63789b31\`。
- before：在同一 commit 上按 \`git revert --no-commit bd68912 f55ad9a\` 生成 \`before.patch\`；合成 tree \`b1360b58cc778671097843e274e34ffc49170cf5\`。P0 commit \`c0db0b5\` 与 P2 debug counter 留在两侧；计时期间 debug counter 未启用。
- before2：before 的独立第二份构建，实际插件链接 realpath 为 \`/private/tmp/bc-ba/before2\`；before 与 before2 是相同源码、不同副本，用于 A/A。
- \`before.patch\` SHA-256：\`${patchSha256}\`。它触及 6 个文件：
  - \`client/components/syntax-highlight.tsx\`
  - \`client/highlight.ts\`
  - \`client/image-file.ts\`
  - 删除 \`test/unit/highlight-cache.test.ts\`
  - 删除 \`test/unit/image-file.test.ts\`
  - 删除 \`test/unit/syntax-highlight-performance.test.ts\`
- 三份 Studio 构建均从 \`git archive\` 创建并应用 \`npm ci --include=dev\`；构建与测试未对产品源码做额外改动。

## Environment / 环境

- 远端主机：\`rrd-mac-studio\`，macOS 27.0.1，Apple M5 Max；Node.js 24.15.0；Chrome 155.0.8059.40。
- Web：固定 host export \`/tmp/bc-perf-p0p1/web-dist\`（sha 前缀 \`9dd7eab4521434bc\`），Paseo CLI 0.11.2，私有 daemon home \`~/.paseo-bench-p0p1\`，监听 \`127.0.0.1:6871\`；本地测试页 \`127.0.0.1:8092\`。
- iOS：Paseo v0.11.2 clone \`/tmp/bc-ios/paseo\`，Metro port 8085，app id \`sh.paseo.debug\`，仅用 Simulator \`bc-perf-ios\` / UDID \`4497FFF9-93D1-4713-B55B-A9988BC2209E\`；未连接物理设备。
- 图像 fixture 为 \`images-repeat-p0\`，测试图片为 \`shot.png\` 与 \`shot2.png\`（各约 2.1 MB）。
- bench-provider 来自 \`/tmp/bc-ba/after/tools/bench-provider\`，执行 \`npm ci\` 与 \`npm run setup\`；images-repeat fixture 仅作为该 provider 的测试输入。

## Identity method / 身份确认

- 每次切换 Web 构建都 retarget \`/tmp/bc-ba/bench-active\`，等待私有 daemon 报告插件 \`running\` 后才测量；记录链接 realpath、plugin path、host marker 与 imageRpc marker。路径分别解析到 \`/private/tmp/bc-ba/before\`、\`/private/tmp/bc-ba/before2\`、\`/private/tmp/bc-ba/after\`，所以 before 与 before2 可区分。
- iOS 使用 host/fork marker、app title、插件路径与插件 row 数确认构建；所有 timed sample 的额外 P0/P2 probes 均为 off。身份采集放在定时窗口之外；另外执行的功能 counter probes 不计时。
- untimed 功能探针显示：after 在 diff-expand 的 highlight cache key / max line 计数从 expand 的 1 到两次 theme 更新后的 3；before 与 before2 在这些步骤为 0。images-repeat 的 imageRpc live 为 7→5、history load 为 4→2，duplicatesInFlight 均为 2→0（before / before2 → after）。

## Results / 结果

以下完整表格逐场景列出 before、before2、after 中位数、全部同 rep A/A 差值、全部 after−before 差值、max |A/A|、判定及 README even-rule 次级注释。单位按指标列标注。

表格数字显示最多 3 位小数；阈值与判定使用未舍入值。逐次原始值和完整精度汇总保存在 \`raw/\` 下的 JSON 文件中。

${detailedResults}

## Validation / 验收

- Web 主矩阵：11 个 README fixture × 3 builds × 5 reps = 165 个样本；diff-expand 15 个样本；images-repeat 15 次回放同时采 live 与 history-load 两阶段；共 195 个有效 Web 测量 session。功能 counter probes 为 18 次（2 场景 × 3 builds × 3 reps）。
- iOS：11 个 fixture × 3 builds × 3 reps = 99 个样本；每个 fixture/build 恰好 3 个。before2 / codeblock-streaming / rep 1 的已有有效样本复用，未重写。
- 最终分析验证：Web 每个场景/build 5 个；iOS 每个场景/build 3 个；counter probes 每个场景/build 3 个；Web 页面错误 0；身份不匹配 0；Web 与 iOS 的所有指标值均完整。
- 15 个初次 images-repeat history 结果因导航前后 CDP 计数器未重置而产生无效负增量，已保留在 \`raw/rejected-images-repeat-cdp-reset/\`，排除分析并按当前文档窗口定义重跑 15 次；修正版记录导航后当前 document 到 7 秒 settle 的绝对 CDP 累计值。
- iOS 初始有 3 次身份读取遇到 “Loading workspace”、plugin rows 为 0，未计入样本；固定到已有 workspace 并增加 AX ready gate 后恢复。分析脚本初次映射 iOS 字段时使用了错误层级，已修正到原始 JSON 的 \`fixture\`、顶层 \`allRows\` 与 \`perCommit\`，重算后的指标计数完整。
- 三份 \`npm ci\` 均完成；每份日志包含 25 条 npm audit advisories（6 moderate、16 high、3 critical）。本轮未运行产品测试套件。
- 收尾状态：私有插件配置已清空，私有 daemon 已停止；web server、Metro、control-server、serve-sim 均已停止；指定 UDID 已 shutdown。指定端口 \`6871/8085/8092/8099/3160\` 均无 listener。未清理 \`/tmp/bc-ba\`。

## Remaining / 边界

- iOS 测量期间，Studio 上观察到另一独立 Simulator/Metro task 使用不同 UDID 与端口；本任务未触碰它。其机器负载影响无法单独归因，A/A 配对噪声仍按本轮测量值报告。
- 结论仅覆盖这里列出的构建、fixture、浏览器与指定 Simulator 样本；不代表真实账号、生产环境或物理设备验收。
- 原始样本、截图、日志与汇总 JSON 保存在本目录的 \`raw/\`；完整表格也单独保存在 \`raw/analysis.md\`。
`;

mkdirSync(path.dirname(reportPath), { recursive: true });
writeFileSync(reportPath, content);
writeFileSync(path.join(evidenceRoot, "README.md"), content);
process.stdout.write(`Wrote ${reportPath} and ${path.join(evidenceRoot, "README.md")}\n`);
