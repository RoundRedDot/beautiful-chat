### Web（中位数；差值均为 after − before）


| 场景 | 指标 | 单位 | 样本数 b/b2/a | before | before2 | after | A/A：before2−before（按 rep） | after−before（按 rep） | max |A/A| | after−before 中位差 | 判定 | README 次级规则 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| codeblock-streaming | TaskDuration | s | 5/5/5 | 2.745 | 2.714 | 2.684 | r1:0.257, r2:-0.008, r3:-0.422, r4:-0.044, r5:-0.031 | r1:0.303, r2:-0.042, r3:-0.017, r4:-0.037, r5:-0.452 | 0.422 | -0.061 | within noise | even |
| codeblock-streaming | ScriptDuration | s | 5/5/5 | 1.72 | 1.699 | 1.705 | r1:0.228, r2:0.004, r3:-0.267, r4:-0.031, r5:-0.049 | r1:0.195, r2:-0.008, r3:0.007, r4:-0.004, r5:-0.337 | 0.267 | -0.015 | within noise | — |
| codeblock-streaming | Layout+Style | s | 5/5/5 | 0.223 | 0.219 | 0.222 | r1:0.003, r2:0, r3:-0.033, r4:-0.001, r5:-0.004 | r1:0.023, r2:0.003, r3:-0.001, r4:-0.005, r5:-0.031 | 0.033 | -0.002 | within noise | — |
| codeblock-streaming | host row p95 | ms | 5/5/5 | 1.9 | 1.9 | 1.9 | r1:0.2, r2:0, r3:-0.1, r4:0.1, r5:-0.1 | r1:0.2, r2:0, r3:0.1, r4:0, r5:-0.3 | 0.2 | 0 | within noise | — |
| codeblock-streaming | per-commit p95 | ms | 5/5/5 | 2 | 2 | 1.9 | r1:0.1, r2:-0.1, r3:-0.2, r4:0.1, r5:0 | r1:0.1, r2:-0.1, r3:0, r4:0, r5:-0.3 | 0.2 | -0.1 | within noise | — |
| codeblock-streaming | row render total | ms | 5/5/5 | 371.5 | 363.9 | 369.4 | r1:59.9, r2:-0.7, r3:-63, r4:-4.9, r5:-11.4 | r1:46.4, r2:0.7, r3:6.4, r4:-4.4, r5:-67.6 | 63 | -2.1 | within noise | — |
| codeblock-streaming | long task count | count | 5/5/5 | 0 | 0 | 0 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| codeblock-streaming | long task total | ms | 5/5/5 | 0 | 0 | 0 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| codeblock-streaming | CLS | ratio | 5/5/5 | 0.011 | 0.012 | 0.012 | r1:0, r2:0, r3:0, r4:-0.001, r5:0.001 | r1:0, r2:0, r3:0, r4:-0.001, r5:0 | 0.001 | 0 | within noise | — |
| codeblock-streaming | post-GC JS heap | MB | 5/5/5 | 114.649 | 114.241 | 114.207 | r1:0.283, r2:0.14, r3:-0.407, r4:-0.287, r5:-0.214 | r1:-0.33, r2:-0.071, r3:-0.442, r4:-0.644, r5:-0.493 | 0.407 | -0.442 | gain | — |
| codeblock-streaming | post-GC DOM | nodes | 5/5/5 | 3742 | 3742 | 3584 | r1:1221, r2:0, r3:-1031, r4:-1178, r5:0 | r1:1020, r2:0, r3:-1031, r4:0, r5:-1178 | 1221 | -158 | within noise | — |
| diff-large | TaskDuration | s | 5/5/5 | 0.313 | 0.32 | 0.326 | r1:0.018, r2:-0.041, r3:0.004, r4:-0.001, r5:0 | r1:0.011, r2:-0.044, r3:0.002, r4:0.011, r5:0.045 | 0.041 | 0.013 | within noise | even |
| diff-large | ScriptDuration | s | 5/5/5 | 0.142 | 0.152 | 0.154 | r1:0.007, r2:0.003, r3:0.002, r4:0.011, r5:0 | r1:0.004, r2:0.001, r3:0.001, r4:0.013, r5:0.029 | 0.011 | 0.012 | loss | — |
| diff-large | Layout+Style | s | 5/5/5 | 0.032 | 0.033 | 0.033 | r1:0.003, r2:0.001, r3:0.001, r4:0.001, r5:-0.002 | r1:0.002, r2:0, r3:0, r4:0.002, r5:0.004 | 0.003 | 0.001 | within noise | — |
| diff-large | host row p95 | ms | 5/5/5 | 2.4 | 2.5 | 2.5 | r1:0.9, r2:0.3, r3:-0.1, r4:-0.1, r5:0.7 | r1:0.8, r2:0, r3:0, r4:0.1, r5:1.2 | 0.9 | 0.1 | within noise | — |
| diff-large | per-commit p95 | ms | 5/5/5 | 2.8 | 2.7 | 2.7 | r1:0.2, r2:0.3, r3:-3.2, r4:-0.1, r5:0.6 | r1:0.3, r2:-0.2, r3:-3.3, r4:-0.3, r5:1.5 | 3.2 | -0.1 | within noise | — |
| diff-large | row render total | ms | 5/5/5 | 19.2 | 19.7 | 19.8 | r1:1.5, r2:0.7, r3:0.3, r4:1, r5:3.8 | r1:1.5, r2:0.5, r3:0.4, r4:-0.5, r5:8.4 | 3.8 | 0.6 | within noise | — |
| diff-large | long task count | count | 5/5/5 | 0 | 0 | 0 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| diff-large | long task total | ms | 5/5/5 | 0 | 0 | 0 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| diff-large | CLS | ratio | 5/5/5 | 0 | 0 | 0 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| diff-large | post-GC JS heap | MB | 5/5/5 | 112.726 | 112.234 | 112.49 | r1:0.238, r2:0.216, r3:-0.493, r4:0.207, r5:0.191 | r1:-0.218, r2:0.469, r3:-0.236, r4:-0.18, r5:-0.297 | 0.493 | -0.236 | within noise | — |
| diff-large | post-GC DOM | nodes | 5/5/5 | 1423 | 1423 | 1423 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| history-100 | TaskDuration | s | 5/5/5 | 0.708 | 0.688 | 0.736 | r1:-0.098, r2:-0.033, r3:-0.048, r4:0.096, r5:0.05 | r1:0.03, r2:0.104, r3:-0.029, r4:0.117, r5:0.026 | 0.098 | 0.028 | within noise | even |
| history-100 | ScriptDuration | s | 5/5/5 | 0.599 | 0.549 | 0.619 | r1:-0.085, r2:-0.031, r3:-0.074, r4:0.091, r5:0.04 | r1:0.027, r2:0.084, r3:-0.021, r4:0.111, r5:0.013 | 0.091 | 0.02 | within noise | — |
| history-100 | Layout+Style | s | 5/5/5 | 0.04 | 0.037 | 0.04 | r1:-0.007, r2:0, r3:-0.003, r4:0.006, r5:0.002 | r1:-0.001, r2:0.006, r3:-0.001, r4:0.007, r5:0.001 | 0.007 | 0.001 | within noise | — |
| history-100 | host row p95 | ms | 5/5/5 | 0.2 | 0.2 | 0.1 | r1:0, r2:0.1, r3:0.1, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:-0.1, r5:0 | 0.1 | -0.1 | within noise | — |
| history-100 | per-commit p95 | ms | 5/5/5 | 3.6 | 2.7 | 4.6 | r1:-1.4, r2:-0.4, r3:-1, r4:1.4, r5:-0.4 | r1:0.5, r2:1.3, r3:0.2, r4:2, r5:0.2 | 1.4 | 1 | within noise | — |
| history-100 | row render total | ms | 5/5/5 | 172.3 | 137 | 179.3 | r1:-53.6, r2:-15.1, r3:-35.3, r4:54, r5:-3.7 | r1:5.3, r2:43.4, r3:2, r4:57.8, r5:-7.4 | 54 | 7 | within noise | — |
| history-100 | long task count | count | 5/5/5 | 1 | 0 | 1 | r1:-1, r2:0, r3:-1, r4:1, r5:0 | r1:0, r2:1, r3:0, r4:1, r5:0 | 1 | 0 | within noise | — |
| history-100 | long task total | ms | 5/5/5 | 57 | 0 | 58 | r1:-62, r2:0, r3:-59, r4:57, r5:4 | r1:-2, r2:56, r3:3, r4:58, r5:0 | 62 | 1 | within noise | — |
| history-100 | CLS | ratio | 5/5/5 | 0 | 0 | 0 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| history-100 | post-GC JS heap | MB | 5/5/5 | 120.046 | 119.163 | 119.85 | r1:-0.245, r2:-0.135, r3:-0.883, r4:0.04, r5:-0.071 | r1:0.164, r2:0.2, r3:-0.196, r4:-0.061, r5:-0.066 | 0.883 | -0.196 | within noise | — |
| history-100 | post-GC DOM | nodes | 5/5/5 | 2215 | 2215 | 2215 | r1:0, r2:0, r3:45, r4:0, r5:0 | r1:0, r2:0, r3:-9, r4:0, r5:0 | 45 | 0 | within noise | — |
| markdown-long | TaskDuration | s | 5/5/5 | 5.838 | 5.767 | 5.739 | r1:0.15, r2:2.772, r3:-0.5, r4:0.026, r5:-0.092 | r1:0.302, r2:0.415, r3:-0.099, r4:-0.051, r5:-0.361 | 2.772 | -0.099 | within noise | even |
| markdown-long | ScriptDuration | s | 5/5/5 | 3.2 | 3.162 | 3.179 | r1:0.054, r2:1.665, r3:-0.336, r4:-0.03, r5:-0.114 | r1:0.187, r2:0.228, r3:-0.018, r4:-0.053, r5:-0.226 | 1.665 | -0.021 | within noise | — |
| markdown-long | Layout+Style | s | 5/5/5 | 0.57 | 0.559 | 0.561 | r1:0.024, r2:0.254, r3:-0.034, r4:0.006, r5:0.003 | r1:0.032, r2:0.046, r3:-0.014, r4:0, r5:-0.019 | 0.254 | -0.009 | within noise | — |
| markdown-long | host row p95 | ms | 5/5/5 | 1.5 | 1.5 | 1.5 | r1:0.1, r2:0.8, r3:0, r4:0.1, r5:0 | r1:0.1, r2:0.2, r3:0, r4:0, r5:0 | 0.8 | 0 | within noise | — |
| markdown-long | per-commit p95 | ms | 5/5/5 | 1.5 | 1.5 | 1.5 | r1:0.1, r2:0.8, r3:0, r4:0.1, r5:0 | r1:0.1, r2:0.2, r3:0, r4:0, r5:0 | 0.8 | 0 | within noise | — |
| markdown-long | row render total | ms | 5/5/5 | 483 | 466.2 | 470 | r1:8.9, r2:255.2, r3:-45.1, r4:17.7, r5:6.4 | r1:47.7, r2:37.1, r3:-21.2, r4:-11.4, r5:-22.3 | 255.2 | -13 | within noise | — |
| markdown-long | long task count | count | 5/5/5 | 0 | 0 | 0 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| markdown-long | long task total | ms | 5/5/5 | 0 | 0 | 0 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| markdown-long | CLS | ratio | 5/5/5 | 0 | 0 | 0 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| markdown-long | post-GC JS heap | MB | 5/5/5 | 117.301 | 117.266 | 117.419 | r1:0.354, r2:0.154, r3:-0.035, r4:-0.226, r5:0.094 | r1:-0.078, r2:-0.03, r3:0.118, r4:-0.244, r5:0.046 | 0.354 | 0.118 | within noise | — |
| markdown-long | post-GC DOM | nodes | 5/5/5 | 3260 | 3260 | 3260 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| mixed-turn | TaskDuration | s | 5/5/5 | 1.21 | 1.192 | 1.173 | r1:-0.076, r2:0.078, r3:0.005, r4:-0.078, r5:0.074 | r1:-0.095, r2:0.031, r3:0.014, r4:-0.076, r5:0.033 | 0.078 | -0.037 | within noise | even |
| mixed-turn | ScriptDuration | s | 5/5/5 | 0.564 | 0.554 | 0.529 | r1:-0.009, r2:0.014, r3:-0.011, r4:-0.016, r5:0.006 | r1:-0.034, r2:0.018, r3:-0.036, r4:-0.011, r5:0.012 | 0.016 | -0.034 | within noise | — |
| mixed-turn | Layout+Style | s | 5/5/5 | 0.144 | 0.142 | 0.145 | r1:0, r2:0.002, r3:0.005, r4:0.002, r5:-0.007 | r1:0.001, r2:0.005, r3:0, r4:0.001, r5:-0.002 | 0.007 | 0.001 | within noise | — |
| mixed-turn | host row p95 | ms | 5/5/5 | 1.7 | 1.7 | 1.6 | r1:-0.2, r2:-0.1, r3:0, r4:0, r5:0 | r1:-0.3, r2:0, r3:0, r4:-0.2, r5:0 | 0.2 | -0.1 | within noise | — |
| mixed-turn | per-commit p95 | ms | 5/5/5 | 2.7 | 2.9 | 2.7 | r1:-0.1, r2:-0.1, r3:0.4, r4:0.2, r5:-0.4 | r1:-0.4, r2:-0.4, r3:-0.2, r4:0, r5:-0.3 | 0.4 | 0 | within noise | — |
| mixed-turn | row render total | ms | 5/5/5 | 97.8 | 94 | 91.4 | r1:-3.3, r2:3.6, r3:-1.3, r4:-4.7, r5:-2.2 | r1:-8.1, r2:3.3, r3:-3.9, r4:-4.3, r5:-3.9 | 4.7 | -6.4 | within noise | — |
| mixed-turn | long task count | count | 5/5/5 | 0 | 0 | 0 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| mixed-turn | long task total | ms | 5/5/5 | 0 | 0 | 0 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| mixed-turn | CLS | ratio | 5/5/5 | 0.027 | 0.027 | 0.027 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| mixed-turn | post-GC JS heap | MB | 5/5/5 | 115.174 | 115.18 | 115.323 | r1:0.583, r2:0.659, r3:0.006, r4:-0.616, r5:-0.539 | r1:-0.084, r2:0.684, r3:0.149, r4:-0.642, r5:-0.406 | 0.659 | 0.149 | within noise | — |
| mixed-turn | post-GC DOM | nodes | 5/5/5 | 1749 | 1749 | 1749 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| reads-20 | TaskDuration | s | 5/5/5 | 1.023 | 1.01 | 1.014 | r1:-0.039, r2:0.063, r3:0.016, r4:0.01, r5:-0.025 | r1:-0.011, r2:-0.011, r3:-0.109, r4:0.022, r5:-0.005 | 0.063 | -0.009 | within noise | even |
| reads-20 | ScriptDuration | s | 5/5/5 | 0.58 | 0.575 | 0.578 | r1:-0.036, r2:-0.012, r3:0.012, r4:-0.003, r5:0.002 | r1:-0.005, r2:0.001, r3:-0.07, r4:0.002, r5:-0.004 | 0.036 | -0.002 | within noise | — |
| reads-20 | Layout+Style | s | 5/5/5 | 0.097 | 0.096 | 0.097 | r1:0.001, r2:-0.002, r3:0.001, r4:-0.001, r5:-0.003 | r1:-0.001, r2:0.002, r3:-0.012, r4:0, r5:-0.002 | 0.003 | 0 | within noise | — |
| reads-20 | host row p95 | ms | 5/5/5 | 1.2 | 1.3 | 1.2 | r1:0, r2:0.1, r3:0.1, r4:0.1, r5:0 | r1:0.1, r2:0, r3:-0.1, r4:0.1, r5:0 | 0.1 | 0 | within noise | — |
| reads-20 | per-commit p95 | ms | 5/5/5 | 1.8 | 1.7 | 1.7 | r1:0, r2:0, r3:0, r4:-0.1, r5:-0.3 | r1:0.2, r2:0, r3:-0.2, r4:-0.1, r5:-0.3 | 0.3 | -0.1 | within noise | — |
| reads-20 | row render total | ms | 5/5/5 | 110.8 | 110.5 | 111 | r1:-13.8, r2:2, r3:1.9, r4:5.3, r5:-0.3 | r1:-3.3, r2:5.7, r3:-19.4, r4:2.1, r5:-2.3 | 13.8 | 0.2 | within noise | — |
| reads-20 | long task count | count | 5/5/5 | 0 | 0 | 0 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| reads-20 | long task total | ms | 5/5/5 | 0 | 0 | 0 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| reads-20 | CLS | ratio | 5/5/5 | 0.001 | 0.001 | 0.001 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| reads-20 | post-GC JS heap | MB | 5/5/5 | 117.28 | 117.465 | 117.106 | r1:0.175, r2:-0.244, r3:0.185, r4:0.134, r5:-0.339 | r1:0.303, r2:-0.02, r3:-0.174, r4:0.348, r5:-0.158 | 0.339 | -0.174 | within noise | — |
| reads-20 | post-GC DOM | nodes | 5/5/5 | 2081 | 2081 | 2081 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| reasoning-long-prose | TaskDuration | s | 5/5/5 | 1.814 | 1.959 | 1.921 | r1:-0.008, r2:-0.057, r3:0.221, r4:0.341, r5:0.054 | r1:-0.073, r2:0.082, r3:0.248, r4:0.189, r5:0.09 | 0.341 | 0.106 | within noise | even |
| reasoning-long-prose | ScriptDuration | s | 5/5/5 | 1.019 | 1.078 | 1.072 | r1:-0.012, r2:-0.076, r3:0.185, r4:0.228, r5:0 | r1:-0.002, r2:0.026, r3:0.184, r4:0.185, r5:0.01 | 0.228 | 0.053 | within noise | — |
| reasoning-long-prose | Layout+Style | s | 5/5/5 | 0.17 | 0.175 | 0.173 | r1:-0.001, r2:-0.01, r3:0.021, r4:0.021, r5:0.002 | r1:-0.005, r2:0.001, r3:0.015, r4:0.013, r5:-0.001 | 0.021 | 0.003 | within noise | — |
| reasoning-long-prose | host row p95 | ms | 5/5/5 | 0.8 | 0.8 | 0.8 | r1:0, r2:0, r3:0.1, r4:0.1, r5:0 | r1:0.1, r2:0, r3:0.1, r4:0.1, r5:0 | 0.1 | 0 | within noise | — |
| reasoning-long-prose | per-commit p95 | ms | 5/5/5 | 0.9 | 0.9 | 0.8 | r1:0, r2:0, r3:0, r4:0.1, r5:-0.1 | r1:0, r2:0, r3:0, r4:0, r5:-0.1 | 0.1 | -0.1 | within noise | — |
| reasoning-long-prose | row render total | ms | 5/5/5 | 144.8 | 146.2 | 144.4 | r1:0.6, r2:-10.3, r3:31.5, r4:36.4, r5:-5.4 | r1:8, r2:-1, r3:29.7, r4:23.2, r5:1.7 | 36.4 | -0.4 | within noise | — |
| reasoning-long-prose | long task count | count | 5/5/5 | 0 | 0 | 0 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| reasoning-long-prose | long task total | ms | 5/5/5 | 0 | 0 | 0 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| reasoning-long-prose | CLS | ratio | 5/5/5 | 0.001 | 0.001 | 0.001 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| reasoning-long-prose | post-GC JS heap | MB | 5/5/5 | 113.632 | 113.548 | 113.586 | r1:-0.012, r2:0.173, r3:-0.084, r4:-0.007, r5:0.046 | r1:-0.093, r2:0.026, r3:-0.046, r4:-0.04, r5:-0.684 | 0.173 | -0.046 | within noise | — |
| reasoning-long-prose | post-GC DOM | nodes | 5/5/5 | 1404 | 1404 | 1404 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| reasoning-long-sections | TaskDuration | s | 5/5/5 | 1.498 | 1.601 | 1.584 | r1:-0.043, r2:0.052, r3:0.124, r4:-0.058, r5:0.083 | r1:-0.058, r2:-0.513, r3:0.106, r4:-0.003, r5:-0.01 | 0.124 | 0.085 | within noise | even |
| reasoning-long-sections | ScriptDuration | s | 5/5/5 | 0.896 | 0.961 | 0.911 | r1:0.024, r2:-0.017, r3:0.068, r4:-0.011, r5:0.016 | r1:0.002, r2:-0.349, r3:0.018, r4:-0.007, r5:0.001 | 0.068 | 0.014 | within noise | — |
| reasoning-long-sections | Layout+Style | s | 5/5/5 | 0.129 | 0.13 | 0.124 | r1:-0.001, r2:-0.001, r3:0.01, r4:0, r5:0.002 | r1:-0.001, r2:-0.035, r3:0.004, r4:0.003, r5:-0.002 | 0.01 | -0.005 | within noise | — |
| reasoning-long-sections | host row p95 | ms | 5/5/5 | 0.8 | 0.8 | 0.8 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:-0.2, r3:0, r4:-0.1, r5:0 | 0 | 0 | within noise | — |
| reasoning-long-sections | per-commit p95 | ms | 5/5/5 | 0.8 | 0.9 | 0.8 | r1:0, r2:0, r3:0, r4:0, r5:0.1 | r1:0, r2:-0.1, r3:-0.1, r4:-0.1, r5:0 | 0.1 | 0 | within noise | — |
| reasoning-long-sections | row render total | ms | 5/5/5 | 123.7 | 131.7 | 128.8 | r1:6.3, r2:-0.3, r3:11.2, r4:-9.7, r5:1.7 | r1:4.2, r2:-46.1, r3:8.3, r4:-5.8, r5:0.8 | 11.2 | 5.1 | within noise | — |
| reasoning-long-sections | long task count | count | 5/5/5 | 0 | 0 | 0 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| reasoning-long-sections | long task total | ms | 5/5/5 | 0 | 0 | 0 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| reasoning-long-sections | CLS | ratio | 5/5/5 | 0.001 | 0.001 | 0.001 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| reasoning-long-sections | post-GC JS heap | MB | 5/5/5 | 113.62 | 113.617 | 113.546 | r1:-0.185, r2:0.16, r3:-0.002, r4:-0.106, r5:0.004 | r1:-0.095, r2:0.012, r3:-0.074, r4:0.011, r5:-0.014 | 0.185 | -0.074 | within noise | — |
| reasoning-long-sections | post-GC DOM | nodes | 5/5/5 | 1406 | 1406 | 1406 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| shell-log-large | TaskDuration | s | 5/5/5 | 0.701 | 0.66 | 0.671 | r1:-0.058, r2:-0.055, r3:0.147, r4:0.038, r5:0.008 | r1:-0.001, r2:-0.084, r3:0.144, r4:0.118, r5:-0.052 | 0.147 | -0.029 | within noise | even |
| shell-log-large | ScriptDuration | s | 5/5/5 | 0.182 | 0.184 | 0.191 | r1:0.001, r2:-0.014, r3:0.037, r4:0.013, r5:0.005 | r1:0.012, r2:-0.006, r3:0.034, r4:0.024, r5:0 | 0.037 | 0.009 | within noise | — |
| shell-log-large | Layout+Style | s | 5/5/5 | 0.094 | 0.096 | 0.097 | r1:0.004, r2:-0.003, r3:0.019, r4:0.015, r5:0.002 | r1:0.003, r2:0.002, r3:0.008, r4:0.019, r5:0.003 | 0.019 | 0.003 | within noise | — |
| shell-log-large | host row p95 | ms | 5/5/5 | 2.6 | 2.3 | 2.5 | r1:-0.7, r2:-0.4, r3:-0.2, r4:0, r5:-0.3 | r1:-0.1, r2:-0.9, r3:-0.1, r4:0, r5:-0.1 | 0.7 | -0.1 | within noise | — |
| shell-log-large | per-commit p95 | ms | 5/5/5 | 4.7 | 5.4 | 5.5 | r1:-2.8, r2:2.4, r3:-0.2, r4:1.5, r5:1 | r1:0.1, r2:-1.2, r3:-0.1, r4:3.1, r5:1.3 | 2.8 | 0.8 | within noise | — |
| shell-log-large | row render total | ms | 5/5/5 | 18.5 | 18.7 | 18.7 | r1:-0.9, r2:-3.3, r3:4.5, r4:2.8, r5:0.2 | r1:0.7, r2:-3.9, r3:3.6, r4:4.2, r5:0.3 | 4.5 | 0.2 | within noise | — |
| shell-log-large | long task count | count | 5/5/5 | 0 | 0 | 0 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| shell-log-large | long task total | ms | 5/5/5 | 0 | 0 | 0 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| shell-log-large | CLS | ratio | 5/5/5 | 0 | 0 | 0 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| shell-log-large | post-GC JS heap | MB | 5/5/5 | 113.422 | 113.472 | 113.364 | r1:0.069, r2:-0.284, r3:0.05, r4:0.312, r5:-0.131 | r1:0.181, r2:-0.222, r3:-0.058, r4:0.316, r5:0.203 | 0.312 | -0.058 | within noise | — |
| shell-log-large | post-GC DOM | nodes | 5/5/5 | 1416 | 1416 | 1416 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| table-streaming | TaskDuration | s | 5/5/5 | 1.922 | 1.907 | 1.902 | r1:-0.015, r2:-0.158, r3:0.098, r4:-0.086, r5:-0.038 | r1:0.034, r2:-0.163, r3:0.04, r4:-0.029, r5:-0.035 | 0.158 | -0.02 | within noise | even |
| table-streaming | ScriptDuration | s | 5/5/5 | 1.108 | 1.138 | 1.119 | r1:0.012, r2:-0.067, r3:0.034, r4:-0.057, r5:0.012 | r1:-0.012, r2:-0.084, r3:0.015, r4:-0.044, r5:0.01 | 0.067 | 0.011 | within noise | — |
| table-streaming | Layout+Style | s | 5/5/5 | 0.175 | 0.171 | 0.172 | r1:0, r2:-0.015, r3:0.004, r4:-0.009, r5:-0.001 | r1:-0.003, r2:-0.015, r3:0.007, r4:-0.007, r5:0 | 0.015 | -0.003 | within noise | — |
| table-streaming | host row p95 | ms | 5/5/5 | 2.6 | 2.6 | 2.7 | r1:0, r2:-0.1, r3:0.2, r4:-0.3, r5:0.1 | r1:0.2, r2:-0.1, r3:0.1, r4:-0.2, r5:0.1 | 0.3 | 0.1 | within noise | — |
| table-streaming | per-commit p95 | ms | 5/5/5 | 2.6 | 2.6 | 2.7 | r1:0, r2:-0.1, r3:0.2, r4:-0.3, r5:0.1 | r1:0.2, r2:-0.1, r3:0.1, r4:-0.2, r5:0.1 | 0.3 | 0.1 | within noise | — |
| table-streaming | row render total | ms | 5/5/5 | 267.9 | 274.6 | 275.7 | r1:-1.4, r2:-21.1, r3:10.4, r4:-14, r5:4.7 | r1:-2.4, r2:-18.8, r3:11.5, r4:-7.9, r5:4.3 | 21.1 | 7.8 | within noise | — |
| table-streaming | long task count | count | 5/5/5 | 0 | 0 | 0 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| table-streaming | long task total | ms | 5/5/5 | 0 | 0 | 0 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| table-streaming | CLS | ratio | 5/5/5 | 0.011 | 0.011 | 0.011 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| table-streaming | post-GC JS heap | MB | 5/5/5 | 115.152 | 115.037 | 114.881 | r1:-0.246, r2:0.088, r3:-0.115, r4:0.574, r5:0.02 | r1:-0.774, r2:-0.213, r3:-0.271, r4:0.476, r5:0.057 | 0.574 | -0.271 | within noise | — |
| table-streaming | post-GC DOM | nodes | 5/5/5 | 1696 | 1696 | 1696 | r1:0, r2:312, r3:-312, r4:-312, r5:0 | r1:312, r2:0, r3:-312, r4:-312, r5:0 | 312 | 0 | within noise | — |
| tool-expanded-streaming | TaskDuration | s | 5/5/5 | 1.518 | 1.473 | 1.503 | r1:0.052, r2:-0.215, r3:-0.007, r4:0.015, r5:-0.073 | r1:0.081, r2:-0.015, r3:-0.077, r4:-0.094, r5:0.017 | 0.215 | -0.015 | within noise | even |
| tool-expanded-streaming | ScriptDuration | s | 5/5/5 | 0.748 | 0.748 | 0.753 | r1:0.007, r2:-0.083, r3:0.013, r4:-0.031, r5:0.007 | r1:0.012, r2:-0.014, r3:0.01, r4:-0.087, r5:0.008 | 0.083 | 0.005 | within noise | — |
| tool-expanded-streaming | Layout+Style | s | 5/5/5 | 0.136 | 0.134 | 0.135 | r1:-0.002, r2:-0.013, r3:0.001, r4:0.006, r5:0 | r1:0.001, r2:-0.003, r3:-0.004, r4:-0.005, r5:0 | 0.013 | -0.001 | within noise | — |
| tool-expanded-streaming | host row p95 | ms | 5/5/5 | 0.8 | 0.8 | 0.7 | r1:0.1, r2:0, r3:-0.1, r4:0, r5:0 | r1:0, r2:0, r3:-0.1, r4:-0.1, r5:0 | 0.1 | -0.1 | within noise | — |
| tool-expanded-streaming | per-commit p95 | ms | 5/5/5 | 0.9 | 1 | 0.9 | r1:0.1, r2:0.1, r3:0, r4:-0.1, r5:0.1 | r1:0.1, r2:0, r3:-0.1, r4:-0.1, r5:0.1 | 0.1 | 0 | within noise | — |
| tool-expanded-streaming | row render total | ms | 5/5/5 | 106.8 | 107.4 | 105.3 | r1:2.8, r2:-11.7, r3:-5.2, r4:-9, r5:5.6 | r1:-1.9, r2:0.3, r3:-7.3, r4:-15.4, r5:2.5 | 11.7 | -1.5 | within noise | — |
| tool-expanded-streaming | long task count | count | 5/5/5 | 0 | 0 | 0 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| tool-expanded-streaming | long task total | ms | 5/5/5 | 0 | 0 | 0 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| tool-expanded-streaming | CLS | ratio | 5/5/5 | 0 | 0 | 0 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| tool-expanded-streaming | post-GC JS heap | MB | 5/5/5 | 116.044 | 115.96 | 115.876 | r1:0.239, r2:-0.717, r3:-0.085, r4:0.494, r5:-0.157 | r1:0.082, r2:0.039, r3:-0.168, r4:0.348, r5:0.334 | 0.717 | -0.168 | within noise | — |
| tool-expanded-streaming | post-GC DOM | nodes | 5/5/5 | 1416 | 1416 | 1416 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| diff-expand | TaskDuration | s | 5/5/5 | 1.07 | 1.088 | 1.073 | r1:-0.026, r2:0.01, r3:0.035, r4:-0.081, r5:0.013 | r1:0.018, r2:-0.006, r3:-0.049, r4:-0.002, r5:0.009 | 0.081 | 0.002 | within noise | even |
| diff-expand | ScriptDuration | s | 5/5/5 | 0.436 | 0.439 | 0.427 | r1:-0.022, r2:0.004, r3:0.014, r4:-0.023, r5:0.018 | r1:-0.01, r2:-0.009, r3:0, r4:-0.004, r5:0.008 | 0.023 | -0.008 | within noise | — |
| diff-expand | Layout+Style | s | 5/5/5 | 0.206 | 0.206 | 0.213 | r1:0.002, r2:0.001, r3:0.01, r4:-0.008, r5:0.005 | r1:0.007, r2:-0.002, r3:0.021, r4:0.011, r5:0 | 0.01 | 0.007 | within noise | — |
| diff-expand | host row p95 | ms | 5/5/5 | 11.9 | 10.3 | 10.3 | r1:-2.2, r2:-1, r3:2.1, r4:-2.5, r5:-1.9 | r1:-1.3, r2:-0.2, r3:0.2, r4:-0.8, r5:-2.3 | 2.5 | -1.6 | within noise | — |
| diff-expand | per-commit p95 | ms | 5/5/5 | 12.2 | 10.6 | 12 | r1:-1.8, r2:0.4, r3:1.2, r4:-3.8, r5:-1.9 | r1:0, r2:-0.1, r3:0.3, r4:-3.2, r5:1.5 | 3.8 | -0.2 | within noise | — |
| diff-expand | row render total | ms | 5/5/5 | 154.5 | 149.4 | 148.8 | r1:-12.8, r2:-5.1, r3:3.7, r4:-13, r5:-7.1 | r1:-4.8, r2:-5.7, r3:0.5, r4:-13.1, r5:-15 | 13 | -5.7 | within noise | — |
| diff-expand | long task count | count | 5/5/5 | 2 | 2 | 2 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| diff-expand | long task total | ms | 5/5/5 | 254 | 254 | 258 | r1:-1, r2:3, r3:3, r4:-19, r5:22 | r1:3, r2:2, r3:-2, r4:7, r5:23 | 22 | 4 | within noise | — |
| diff-expand | CLS | ratio | 5/5/5 | 0 | 0 | 0 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| diff-expand | post-GC JS heap | MB | 5/5/5 | 135.145 | 135.014 | 136.265 | r1:-0.888, r2:0.704, r3:-0.223, r4:-0.397, r5:0.851 | r1:-0.601, r2:0.089, r3:1.12, r4:0.296, r5:-0.124 | 0.888 | 1.12 | within noise | — |
| diff-expand | post-GC DOM | nodes | 5/5/5 | 41037 | 41037 | 41043 | r1:0, r2:0, r3:0, r4:6, r5:-6 | r1:-6, r2:0, r3:6, r4:491, r5:0 | 6 | 6 | within noise | — |
| images-repeat-live | TaskDuration | s | 5/5/5 | 0.564 | 0.558 | 0.534 | r1:-0.012, r2:0.042, r3:-0.012, r4:0.007, r5:-0.024 | r1:-0.017, r2:-0.008, r3:-0.025, r4:-0.02, r5:-0.046 | 0.042 | -0.03 | within noise | even |
| images-repeat-live | ScriptDuration | s | 5/5/5 | 0.293 | 0.298 | 0.284 | r1:-0.012, r2:-0.001, r3:0.007, r4:0.007, r5:0.014 | r1:-0.005, r2:-0.012, r3:-0.009, r4:-0.003, r5:0.001 | 0.014 | -0.009 | within noise | — |
| images-repeat-live | Layout+Style | s | 5/5/5 | 0.07 | 0.07 | 0.07 | r1:-0.002, r2:0.005, r3:-0.002, r4:0.001, r5:-0.007 | r1:-0.002, r2:0.001, r3:0, r4:0.001, r5:-0.005 | 0.007 | 0 | within noise | — |
| images-repeat-live | host row p95 | ms | 5/5/5 | 12 | 12.1 | 16 | r1:0.1, r2:0.3, r3:-0.4, r4:-1.5, r5:0.4 | r1:2.5, r2:5.7, r3:5.2, r4:0.5, r5:2.1 | 1.5 | 4 | loss | — |
| images-repeat-live | per-commit p95 | ms | 5/5/5 | 17.4 | 17.1 | 17.5 | r1:-2.4, r2:-2.5, r3:0, r4:2.9, r5:1.5 | r1:-1.8, r2:-2, r3:0.1, r4:3.2, r5:4.1 | 2.9 | 0.1 | within noise | — |
| images-repeat-live | row render total | ms | 5/5/5 | 115.3 | 115.3 | 113.5 | r1:-5, r2:-3.3, r3:3.3, r4:0.4, r5:3.8 | r1:-6.3, r2:-5.1, r3:-1, r4:-1.3, r5:3.1 | 5 | -1.8 | within noise | — |
| images-repeat-live | long task count | count | 5/5/5 | 0 | 0 | 0 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| images-repeat-live | long task total | ms | 5/5/5 | 0 | 0 | 0 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| images-repeat-live | CLS | ratio | 5/5/5 | 0.374 | 0.203 | 0.416 | r1:-0.177, r2:-0.148, r3:-0.159, r4:-0.052, r5:-0.038 | r1:0.037, r2:0.161, r3:0.282, r4:0.161, r5:0.309 | 0.177 | 0.043 | within noise | — |
| images-repeat-live | post-GC JS heap | MB | 5/5/5 | 154.07 | 154.102 | 148.659 | r1:-0.536, r2:-0.099, r3:0.017, r4:0.035, r5:0.137 | r1:-5.719, r2:-5.381, r3:-8.093, r4:-5.328, r5:-7.919 | 0.536 | -5.411 | gain | — |
| images-repeat-live | post-GC DOM | nodes | 5/5/5 | 1620 | 1620 | 1620 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |
| images-repeat-history | TaskDuration | s | 5/5/5 | 0.945 | 0.941 | 0.931 | r1:-0.004, r2:-0.002, r3:0.005, r4:-0.008, r5:-0.003 | r1:-0.024, r2:-0.016, r3:-0.014, r4:-0.015, r5:-0.009 | 0.008 | -0.015 | gain | even |
| images-repeat-history | ScriptDuration | s | 5/5/5 | 0.714 | 0.713 | 0.705 | r1:0.004, r2:-0.003, r3:-0.003, r4:-0.002, r5:-0.003 | r1:-0.01, r2:-0.011, r3:-0.009, r4:-0.006, r5:-0.003 | 0.004 | -0.009 | gain | — |
| images-repeat-history | Layout+Style | s | 5/5/5 | 0.041 | 0.041 | 0.041 | r1:0, r2:0.001, r3:0.002, r4:-0.001, r5:0 | r1:0.001, r2:0.001, r3:-0.001, r4:-0.001, r5:-0.001 | 0.002 | 0 | within noise | — |
| images-repeat-history | host row p95 | ms | 5/5/5 | 10.5 | 10.7 | 6.5 | r1:0.1, r2:0.2, r3:0.2, r4:0, r5:0.1 | r1:-4.3, r2:-4.1, r3:-3.9, r4:-4.4, r5:-4.2 | 0.2 | -4 | gain | — |
| images-repeat-history | per-commit p95 | ms | 5/5/5 | 16.3 | 16.4 | 36.8 | r1:0, r2:0.2, r3:0.1, r4:-0.4, r5:0.2 | r1:20.8, r2:20.7, r3:19.6, r4:20.6, r5:19.5 | 0.4 | 20.5 | loss | — |
| images-repeat-history | row render total | ms | 5/5/5 | 89.8 | 88.8 | 89 | r1:0.6, r2:-0.6, r3:0.1, r4:-1, r5:-0.1 | r1:0.5, r2:-0.7, r3:-0.3, r4:-0.8, r5:-1.1 | 1 | -0.8 | within noise | — |
| images-repeat-history | long task count | count | 5/5/5 | 5 | 4 | 5 | r1:0, r2:-1, r3:-1, r4:0, r5:0 | r1:-1, r2:-1, r3:1, r4:1, r5:1 | 1 | 0 | within noise | — |
| images-repeat-history | long task total | ms | 5/5/5 | 462 | 400 | 462 | r1:6, r2:-72, r3:-67, r4:-2, r5:1 | r1:-67, r2:-69, r3:49, r4:63, r5:68 | 72 | 0 | within noise | — |
| images-repeat-history | CLS | ratio | 5/5/5 | 0.257 | 0.257 | 0.583 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0.326, r2:0.326, r3:0.326, r4:0.326, r5:0.326 | 0 | 0.326 | loss | — |
| images-repeat-history | post-GC JS heap | MB | 5/5/5 | 150.9 | 150.837 | 142.766 | r1:-0.012, r2:-0.103, r3:-0.064, r4:-0.024, r5:-0.023 | r1:-8.098, r2:-8.173, r3:-5.398, r4:-8.128, r5:-5.313 | 0.103 | -8.134 | gain | — |
| images-repeat-history | post-GC DOM | nodes | 5/5/5 | 1619 | 1619 | 1619 | r1:0, r2:0, r3:0, r4:0, r5:0 | r1:0, r2:0, r3:0, r4:0, r5:0 | 0 | 0 | within noise | — |


### iOS（中位数；差值均为 after − before）


| 场景 | 指标 | 样本数 b/b2/a | before | before2 | after | A/A：before2−before（按 rep） | after−before（按 rep） | max |A/A| | after−before 中位差 | 判定 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| codeblock-streaming | row render total | 3/3/3 | 958.289 | 966.4 | 954.402 | r1:8.111, r2:-5.139, r3:13.048 | r1:-26.466, r2:8.736, r3:10.357 | 13.048 | -3.886 | within noise |
| codeblock-streaming | per-commit p95 | 3/3/3 | 5.8 | 5.845 | 5.917 | r1:-0.257, r2:0.077, r3:0.166 | r1:-0.204, r2:0.161, r3:0.117 | 0.257 | 0.117 | within noise |
| diff-large | row render total | 3/3/3 | 46.031 | 49.692 | 47.129 | r1:5.018, r2:7.11, r3:-2.872 | r1:2.455, r2:4.074, r3:-5.972 | 7.11 | 1.098 | within noise |
| diff-large | per-commit p95 | 3/3/3 | 16.366 | 18.815 | 18.35 | r1:2.461, r2:3.281, r3:-4.79 | r1:1.984, r2:5.895, r3:-3.335 | 4.79 | 1.984 | within noise |
| history-100 | row render total | 3/3/3 | 204.761 | 226.105 | 238.349 | r1:24.855, r2:13.258, r3:2.229 | r1:42.327, r2:10.829, r3:14.593 | 24.855 | 33.588 | loss |
| history-100 | per-commit p95 | 3/3/3 | 76.504 | 76.46 | 77.879 | r1:1.081, r2:-0.063, r3:-0.044 | r1:1.905, r2:-0.507, r3:1.375 | 1.081 | 1.375 | within noise |
| markdown-long | row render total | 3/3/3 | 1941.357 | 1981.847 | 1956.642 | r1:44.484, r2:30.746, r3:5.216 | r1:-40.229, r2:5.541, r3:67.441 | 44.484 | 15.285 | within noise |
| markdown-long | per-commit p95 | 3/3/3 | 6.163 | 6.096 | 5.855 | r1:-0.133, r2:-0.067, r3:-0.267 | r1:-0.507, r2:-0.1, r3:-0.254 | 0.267 | -0.308 | gain |
| mixed-turn | row render total | 3/3/3 | 247.706 | 231.868 | 239.211 | r1:-15.838, r2:-45.058, r3:-3.474 | r1:-8.495, r2:-55.559, r3:10.404 | 45.058 | -8.495 | within noise |
| mixed-turn | per-commit p95 | 3/3/3 | 10.634 | 7.702 | 8.085 | r1:-1.092, r2:-3.764, r3:-1.347 | r1:-0.709, r2:-4.853, r3:-0.461 | 3.764 | -2.548 | within noise |
| reads-20 | row render total | 3/3/3 | 321.942 | 332.531 | 323.067 | r1:17.29, r2:11.362, r3:2.639 | r1:33.578, r2:1.125, r3:-13.269 | 17.29 | 1.125 | within noise |
| reads-20 | per-commit p95 | 3/3/3 | 6.465 | 7.159 | 7.744 | r1:0.296, r2:2.197, r3:-0.147 | r1:1.57, r2:1.558, r3:-1.221 | 2.197 | 1.279 | within noise |
| reasoning-long-prose | row render total | 3/3/3 | 338.277 | 329.617 | 346.928 | r1:11.471, r2:-20.223, r3:-8.66 | r1:31.261, r2:-18.111, r3:8.651 | 20.223 | 8.651 | within noise |
| reasoning-long-prose | per-commit p95 | 3/3/3 | 3.26 | 3.292 | 3.304 | r1:0.083, r2:0.033, r3:-0.101 | r1:0.1, r2:-0.139, r3:-0.002 | 0.101 | 0.044 | within noise |
| reasoning-long-sections | row render total | 3/3/3 | 280.606 | 282.407 | 293.114 | r1:6.697, r2:0.876, r3:-0.74 | r1:15.76, r2:-9.543, r3:22.802 | 6.697 | 12.508 | within noise |
| reasoning-long-sections | per-commit p95 | 3/3/3 | 3.096 | 3.133 | 3.228 | r1:-0.009, r2:-0.008, r3:0.037 | r1:0.084, r2:-0.146, r3:0.132 | 0.037 | 0.132 | within noise |
| shell-log-large | row render total | 3/3/3 | 42.796 | 41.615 | 43.127 | r1:-5.31, r2:0.387, r3:1.374 | r1:-4.574, r2:0.331, r3:5.37 | 5.31 | 0.331 | within noise |
| shell-log-large | per-commit p95 | 3/3/3 | 17.353 | 16.965 | 17.881 | r1:-2.742, r2:2.878, r3:-0.388 | r1:0.103, r2:-0.034, r3:2.396 | 2.878 | 0.528 | within noise |
| table-streaming | row render total | 3/3/3 | 638.971 | 643.037 | 653.885 | r1:-17.409, r2:15.442, r3:-18.537 | r1:14.914, r2:11.695, r3:-26.819 | 18.537 | 14.914 | within noise |
| table-streaming | per-commit p95 | 3/3/3 | 7.248 | 7.684 | 7.319 | r1:0.214, r2:0.437, r3:0.058 | r1:0.268, r2:0.071, r3:-0.088 | 0.437 | 0.071 | within noise |
| tool-expanded-streaming | row render total | 3/3/3 | 245.302 | 240.146 | 238.259 | r1:-10.627, r2:-5.156, r3:12.587 | r1:-16.14, r2:-7.043, r3:22.861 | 12.587 | -7.043 | within noise |
| tool-expanded-streaming | per-commit p95 | 3/3/3 | 3.487 | 3.387 | 3.418 | r1:-0.1, r2:-0.154, r3:0.081 | r1:-0.45, r2:0.055, r3:-0.101 | 0.154 | -0.068 | within noise |


### 未计时功能计数（3 次/构建；原始值）


| 场景 | 步骤/时机 | 计数器 | before | before2 | after | 中位数 before / before2 / after |
| --- | --- | --- | --- | --- | --- | --- |
| diff-expand | expand | highlightCacheKey | 0 / 0 / 0 | 0 / 0 / 0 | 1 / 1 / 1 | 0 / 0 / 1 |
| diff-expand | expand | codeMaxLineNumber | 0 / 0 / 0 | 0 / 0 / 0 | 1 / 1 / 1 | 0 / 0 / 1 |
| diff-expand | show-all | highlightCacheKey | 0 / 0 / 0 | 0 / 0 / 0 | 1 / 1 / 1 | 0 / 0 / 1 |
| diff-expand | show-all | codeMaxLineNumber | 0 / 0 / 0 | 0 / 0 / 0 | 1 / 1 / 1 | 0 / 0 / 1 |
| diff-expand | show-less | highlightCacheKey | 0 / 0 / 0 | 0 / 0 / 0 | 1 / 1 / 1 | 0 / 0 / 1 |
| diff-expand | show-less | codeMaxLineNumber | 0 / 0 / 0 | 0 / 0 / 0 | 1 / 1 / 1 | 0 / 0 / 1 |
| diff-expand | theme-dark | highlightCacheKey | 0 / 0 / 0 | 0 / 0 / 0 | 2 / 2 / 2 | 0 / 0 / 2 |
| diff-expand | theme-dark | codeMaxLineNumber | 0 / 0 / 0 | 0 / 0 / 0 | 2 / 2 / 2 | 0 / 0 / 2 |
| diff-expand | theme-light | highlightCacheKey | 0 / 0 / 0 | 0 / 0 / 0 | 3 / 3 / 3 | 0 / 0 / 3 |
| diff-expand | theme-light | codeMaxLineNumber | 0 / 0 / 0 | 0 / 0 / 0 | 3 / 3 / 3 | 0 / 0 / 3 |
| images-repeat | live | imageRpc.count | 7 / 7 / 7 | 7 / 7 / 7 | 5 / 5 / 5 | 7 / 7 / 5 |
| images-repeat | live | imageRpc.duplicatesInFlight | 2 / 2 / 2 | 2 / 2 / 2 | 0 / 0 / 0 | 2 / 2 / 0 |
| images-repeat | historyLoad | imageRpc.count | 4 / 4 / 4 | 4 / 4 / 4 | 2 / 2 / 2 | 4 / 4 / 2 |
| images-repeat | historyLoad | imageRpc.duplicatesInFlight | 2 / 2 / 2 | 2 / 2 / 2 | 0 / 0 / 0 | 2 / 2 / 0 |
| images-repeat | afterExpandingReadRow | imageRpc.count | 5 / 5 / 5 | 5 / 5 / 5 | 3 / 3 / 3 | 5 / 5 / 3 |
| images-repeat | afterExpandingReadRow | imageRpc.duplicatesInFlight | 2 / 2 / 2 | 2 / 2 / 2 | 0 / 0 / 0 | 2 / 2 / 0 |


### 样本数


```json
{
  "webRunCounts": {
    "codeblock-streaming": {
      "before": 5,
      "before2": 5,
      "after": 5
    },
    "diff-large": {
      "before": 5,
      "before2": 5,
      "after": 5
    },
    "history-100": {
      "before": 5,
      "before2": 5,
      "after": 5
    },
    "markdown-long": {
      "before": 5,
      "before2": 5,
      "after": 5
    },
    "mixed-turn": {
      "before": 5,
      "before2": 5,
      "after": 5
    },
    "reads-20": {
      "before": 5,
      "before2": 5,
      "after": 5
    },
    "reasoning-long-prose": {
      "before": 5,
      "before2": 5,
      "after": 5
    },
    "reasoning-long-sections": {
      "before": 5,
      "before2": 5,
      "after": 5
    },
    "shell-log-large": {
      "before": 5,
      "before2": 5,
      "after": 5
    },
    "table-streaming": {
      "before": 5,
      "before2": 5,
      "after": 5
    },
    "tool-expanded-streaming": {
      "before": 5,
      "before2": 5,
      "after": 5
    },
    "diff-expand": {
      "before": 5,
      "before2": 5,
      "after": 5
    },
    "images-repeat-live": {
      "before": 5,
      "before2": 5,
      "after": 5
    },
    "images-repeat-history": {
      "before": 5,
      "before2": 5,
      "after": 5
    }
  },
  "iosRunCounts": {
    "codeblock-streaming": {
      "before": 3,
      "before2": 3,
      "after": 3
    },
    "diff-large": {
      "before": 3,
      "before2": 3,
      "after": 3
    },
    "history-100": {
      "before": 3,
      "before2": 3,
      "after": 3
    },
    "markdown-long": {
      "before": 3,
      "before2": 3,
      "after": 3
    },
    "mixed-turn": {
      "before": 3,
      "before2": 3,
      "after": 3
    },
    "reads-20": {
      "before": 3,
      "before2": 3,
      "after": 3
    },
    "reasoning-long-prose": {
      "before": 3,
      "before2": 3,
      "after": 3
    },
    "reasoning-long-sections": {
      "before": 3,
      "before2": 3,
      "after": 3
    },
    "shell-log-large": {
      "before": 3,
      "before2": 3,
      "after": 3
    },
    "table-streaming": {
      "before": 3,
      "before2": 3,
      "after": 3
    },
    "tool-expanded-streaming": {
      "before": 3,
      "before2": 3,
      "after": 3
    }
  },
  "probeRunCounts": {
    "diff-expand": {
      "before": 3,
      "before2": 3,
      "after": 3
    },
    "images-repeat": {
      "before": 3,
      "before2": 3,
      "after": 3
    }
  },
  "webPageErrors": 0,
  "identityMismatches": 0
}
```
