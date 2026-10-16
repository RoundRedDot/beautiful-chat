# 已部署五项修复：并发验证

正式 core **100/100**、iOS 风险 **60/60**、Web 风险 **60/60** 全部完成，审计失败均为 **0**，无正式样本排除。iOS 风险六项相对 parent 的中位数变化为 -11.84%、-8.69%、-6.72%、-5.55%、+1.53%、+0.55%；Web 六项为 -3.85%、-21.71%、-10.71%、-12.24%、-16.13%、-1.35%，本批未观测超过 10% 的新增回退。采集制度为 `concurrent-max4`，不能与历史串行结果合并，也不能据此声称 iPhone 15 Pro 真机 Release 已验收。完整范围表见 [RESULTS.md](campaign/RESULTS.md)，协议见 [PROTOCOL.md](PROTOCOL.md)，未舍入数据见 [core-summary.json](campaign/raw/core-summary.json)、[risk-summary.json](campaign/raw/risk-summary.json)、[web-risk-summary.json](campaign/raw/web-risk-summary.json)。

源码直接比较：parent `7f01b2d95c87cb6879adf701571de3778a167060` → fixed `722238de2fcc1ade46d542a7a540868932d9dc89`。两者保留相同模型名复制修复；旧 c4/48a6646 数值仅为历史诊断。每个夹具 native/parent/fixed-a/fixed-b 各五次，同 rep 四模式位于同一 lane，轮换模式顺序。fixed 汇总含两个相同源码模式的十个样本；每模式、每 lane 与所有配对值仍单独保留。

| 夹具 | Native 中位数 ms | Parent 中位数 ms | Fixed 中位数 ms | Fixed 对 native | Fixed 对 parent | A/A 超过10%的对数 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| diff-large | 48.60734665393829 | 52.38617265224457 | 56.118112087249756 | +15.45% | +7.12% | 2/5 |
| reads-20 | 277.95054137706757 | 331.45866775512695 | 275.745484828949 | -0.79% | -16.81% | 2/5 |
| reasoning-long-prose | 249.2528738975525 | 324.6124920845032 | 249.64250195026398 | +0.16% | -23.10% | 0/5 |
| reasoning-long-sections | 239.52392506599426 | 292.12604534626007 | 223.4504896402359 | -6.71% | -23.51% | 2/5 |
| tool-expanded-streaming | 154.97392451763153 | 254.40139651298523 | 182.93412309885025 | +18.04% | -28.09% | 2/5 |

指标为同一宿主 React Profiler 的 `allRows.sum`，不是 per-commit p95。门槛用未舍入中位数，相差不足 10% 记持平。三项观测中位数进入该范围，但 25 对 A/A 有 8 对超过 10%，最大 31.31%；除 prose 外存在明显稳定性标记，不能把本批观测直接表述为稳定提升已证实。diff 与默认工具日志仍超过 native 门槛，五项全部修复的目标尚未达成。所有波动样本保留，不重跑成功任务以替换结果。建议另立低并发确认批次来确认波动项目，不能把本批改称串行结果。

## 根因、补丁和剩余成本

- 三项工具夹具共有的冗余路径：singleton 工具组在当前 props 已有新值时仍读旧 store 数组，layout effect 再发布同一内容。`client/timeline-order.ts` 直接返回当前 singleton 数组；实际 renderer/store 回归测试证明一次更新由两次 renderer 调用减为一次，并覆盖多面板和分组合并。正式分项探针中，diff 的 tool renderer 调用中位数 6→4，reads 139→93，默认工具日志 194→97–98。
- 两项 reasoning：宿主 `useRevealedText` 的 passive settlement 重渲染父层，相同 card props 又触发子树计算。`client/live-renderers.tsx` 仅 memo `ReasoningCard`，保留完整文本 hook 输入、预览、流式节奏和复制来源。单测证明子树重复计算消失；正式 reasoning 提交次数基本不变，prose reasoning 行耗时中位数约 299.77→218.76–223.11 ms，sections 269.32→187.77–192.18 ms。不能宣称消除了全部父层提交。
- **diff 未解决**：工具行耗时中位数 native 12.78 ms，parent 25.18 ms，fixed-a/b 23.18/25.04 ms；工具行提交 4/10/9/9。冗余 renderer 调用已减少，但剩余耗时仍集中于插件工具行；总耗时本批未改善，A/A 与 native 范围也有明显波动。尚未用保持功能的消融验证细分剩余成本。
- **默认工具日志未解决**：工具行提交中位数 parent 197→fixed 100–101，接近 native 98；工具行耗时 parent 229.35→fixed 153.39–160.97 ms，native 128.07 ms。重复提交大幅下降后仍有每次工具行的剩余成本。该夹具没有执行展开操作，不能将差距归因为实际展开体渲染。
- 分项数据是观测分解，分项中位数不能相加当成总体中位数，也不是因果消融。完整数据见 [core-cost-attribution.json](campaign/raw/core-cost-attribution.json)。本轮不扩展已授权的两文件生产补丁范围。

## 功能与证据边界

三组都通过独立 daemon/serverId/UDID/Metro/source smoke：流中保持默认折叠，调用实际已挂载展开 handler 后保留已有正文，再调用实际复制 handler，通过原生 clipboard 精确读回当前来源（沿用现有 trim 契约），完成后仍展开。该检查使用 React handler 诊断输入，不代表物理 HID 或 expanded-body 性能计时。准备失败另存，未计入 formal。

生产单测、typecheck、Hermes 与部署证据沿用本报告上层已记录的精确 722238d 结果，本阶段没有改生产源码或重复运行这些检查。真正长历史冷打开、上翻、remount 与完整复制补齐由主会话负责；这里的 `history-100` 仅是风险夹具名，不代表 100 个真实 provider turn，也不代替该验收。

启动准备于 06:39:42 UTC 开始，三组 Metro 首次默认约 33 个 worker，造成启动负载峰值；06:46:12 UTC 仅重启本任务三组为各 `--max-workers 2`。这些准备和 smoke 均不作 formal。core 从 06:53:22 UTC 开始；group1 在 07:11 前采完，其所有者于 07:12:05 UTC 清理，之后最多本任务三组。旧 activity 可能残留 idle，进程记录用于解释实际重叠。统一门槛为 pressureLevel=1、memoryFree>=10%、CPUidle>=15%；load 仅记录。

## 最终核验、资源和清理

[源码核验](campaign/raw/final-source-verification.json)：六份完整 parent/fixed 快照、三份 host patch/probe 与 220 条正式样本的执行 harness hash 均无差异。Web 使用 Chrome `155.0.8059.40`；其余硬件、Node、宿主和 native build 身份随每条样本记录。生产源码本阶段没有修改，也没有新增提交或部署。

[资源汇总](campaign/raw/resource-summary.json)：220 条正式样本零失败、零结束门槛越界，所有记录 pressureLevel=1；起止 CPU idle 范围 54.27–92.70%，memory free 57–75%；开始时一分钟 load 1.40–5.65。正式计时范围为 06:53:43.051–07:43:11.764 UTC。group1 的结束和并发重叠变化按实际记录保留。

**元数据限制**：Web 的进程过滤只匹配裸 `node`，漏掉 `resume-web.mjs` 以 `/opt/homebrew/bin/node` 启动的三组 runner。不能把原始 `processes=[]` 解释成没有并发；各样本 `concurrentTasks` 中的 lane/PID/state/time、调度日志和样本起止区间仍保留。另行生成 [derived-overlap.json](campaign/raw/derived-overlap.json)：仅本任务三组的 Web 计时重叠为 1 路 148.633 秒、2 路 183.047 秒、3 路 135.319 秒，另有 25.725 秒都在准备阶段。该重建不包含 group1 或其他非计时工作，不修改原始快照。维护版 `tools/web-resources.mjs` 已修正绝对路径匹配，两个回归测试通过；修正版未执行性能重测，正式实际执行代码仍原样保留在 `campaign/tools/` 及归档中。

[清理读回](campaign/raw/cleanup.json)：07:43:45 UTC 开始，仅停止本任务三组服务；6882/6883/6884、8182/8183/8184、8282/8283/8284 均无 listener，三个新模拟器均 Shutdown。各自 active 恢复 fixed，两插件 enabled/running 读回后停止私有 daemon；保留新 home/源码/数据/Shutdown 模拟器供复现。Align205 为 Booted，两个受保护 AVD PID 94521/94889 保留，group1 专用模拟器仍 Shutdown；没有连接或修改日常 6767。

全部原始记录、准备失败、日志与实际执行工具保存在 [campaign-evidence.tar.gz](campaign-evidence.tar.gz)。首次深链失败的三个 parent smoke、三个 barrier 失败日志及更早 native 准备失败均保留；成功样本未重跑。[download-integrity.json](download-integrity.json) 证明下载前后 100 个已完成 core 样本 hash 不变。`campaign/raw/{resource-summary,derived-overlap}.json` 为归档后的只读分析派生物，未改任何原始样本。
