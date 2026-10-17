# Same-round replay results

Execution: concurrent-max4. All primary/control groups use five runs. Current-main A/A repeats remain separate; these are observed medians under varying actual overlap, not uniform fixed-concurrency throughput. Row work is milliseconds; Web Task time is seconds; heap is post-GC MB.

| Platform | Scenario | Mode | n | Row work median (min–max) | Web Task median (min–max) | Heap median (min–max) | Diagnostic |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| web | codeblock-streaming | native | 5 | 827.80 (785.20–853.70) | 2.40 (2.28–2.48) | 107.52 (105.83–107.93) | no |
| web | codeblock-streaming | upstream | 5 | 802.40 (757.30–836.90) | 2.15 (2.12–2.26) | 106.49 (103.86–107.24) | no |
| web | codeblock-streaming | fork | 5 | 147.10 (142.60–152.80) | 1.27 (1.23–1.35) | 106.11 (102.96–106.75) | no |
| web | codeblock-streaming | aa | 5 | 146.80 (108.90–151.50) | 1.31 (1.06–1.37) | 106.03 (103.67–107.14) | no |
| web | codeblock-streaming | parent | 5 | 148.00 (113.00–151.60) | 1.27 (1.04–1.36) | 106.22 (103.60–106.72) | no |
| web | diff-large | native | 5 | 21.90 (18.90–26.90) | 0.23 (0.22–0.31) | 98.78 (98.70–101.70) | no |
| web | diff-large | upstream | 5 | 549.80 (517.70–576.70) | 1.41 (1.34–1.43) | 204.79 (203.86–207.22) | no |
| web | diff-large | fork | 5 | 15.90 (11.80–16.60) | 0.22 (0.19–0.26) | 103.42 (101.06–105.56) | no |
| web | diff-large | aa | 5 | 10.70 (10.30–14.70) | 0.20 (0.19–0.23) | 103.96 (102.30–105.68) | no |
| web | diff-large | parent | 5 | 12.20 (10.80–16.70) | 0.22 (0.20–0.27) | 103.19 (102.38–105.75) | no |
| web | history-100 | native | 5 | 164.20 (157.10–180.60) | 0.71 (0.70–0.76) | 104.98 (104.50–107.91) | no |
| web | history-100 | upstream | 5 | 4562.60 (4419.50–4633.70) | 4.40 (4.38–4.42) | 232.15 (226.81–233.42) | no |
| web | history-100 | fork | 5 | 218.30 (189.00–239.40) | 0.78 (0.78–0.86) | 109.83 (108.76–112.22) | no |
| web | history-100 | aa | 5 | 203.90 (173.10–241.50) | 0.77 (0.72–0.91) | 110.43 (109.37–112.40) | no |
| web | history-100 | parent | 5 | 220.50 (189.30–225.90) | 0.80 (0.76–0.87) | 110.08 (109.51–112.25) | no |
| web | markdown-long | native | 5 | 1133.30 (990.90–1254.30) | 4.77 (4.19–5.24) | 148.89 (146.18–149.06) | no |
| web | markdown-long | upstream | 5 | 2093.60 (1975.70–2162.80) | 5.58 (5.27–5.73) | 108.10 (104.88–109.58) | no |
| web | markdown-long | fork | 5 | 236.60 (215.40–308.90) | 2.75 (2.51–3.29) | 115.73 (112.38–116.51) | no |
| web | markdown-long | aa | 5 | 229.80 (217.10–260.60) | 2.69 (2.53–2.98) | 115.28 (113.31–116.40) | no |
| web | markdown-long | parent | 5 | 243.50 (219.00–306.00) | 2.82 (2.52–3.43) | 114.71 (112.50–116.34) | no |
| web | mixed-turn | native | 5 | 121.30 (104.20–129.30) | 0.84 (0.78–0.89) | 103.85 (101.69–104.79) | no |
| web | mixed-turn | upstream | 5 | 326.30 (266.20–370.20) | 2.00 (1.63–2.22) | 113.76 (111.88–114.23) | no |
| web | mixed-turn | fork | 5 | 53.20 (37.90–65.30) | 0.73 (0.55–0.82) | 106.24 (103.75–107.02) | no |
| web | mixed-turn | aa | 5 | 46.90 (42.60–59.10) | 0.65 (0.61–0.70) | 106.31 (103.72–107.54) | no |
| web | mixed-turn | parent | 5 | 58.10 (40.60–65.20) | 0.78 (0.64–0.84) | 106.24 (103.87–106.93) | no |
| web | reads-20 | native | 5 | 92.20 (68.10–108.60) | 0.72 (0.55–0.82) | 102.65 (102.23–105.09) | no |
| web | reads-20 | upstream | 5 | 786.60 (776.40–837.60) | 2.70 (2.56–2.79) | 231.68 (230.10–234.60) | no |
| web | reads-20 | fork | 5 | 52.10 (45.70–54.90) | 0.52 (0.50–0.53) | 108.16 (106.87–110.27) | no |
| web | reads-20 | aa | 5 | 46.30 (43.50–63.00) | 0.52 (0.47–0.66) | 107.05 (106.76–110.47) | no |
| web | reads-20 | parent | 5 | 60.20 (55.80–65.90) | 0.61 (0.54–0.65) | 107.71 (107.39–110.75) | no |
| web | reasoning-long-prose | native | 5 | 276.20 (207.20–297.70) | 1.41 (1.09–1.56) | 98.61 (98.08–101.35) | no |
| web | reasoning-long-prose | upstream | 5 | 647.10 (506.30–660.10) | 2.30 (1.84–2.30) | 101.98 (101.29–104.03) | no |
| web | reasoning-long-prose | fork | 5 | 63.60 (53.90–78.50) | 0.93 (0.78–1.12) | 102.49 (100.88–104.86) | no |
| web | reasoning-long-prose | aa | 5 | 61.00 (56.00–66.90) | 0.87 (0.76–0.90) | 102.28 (101.57–104.69) | no |
| web | reasoning-long-prose | parent | 5 | 67.10 (55.40–94.10) | 0.97 (0.82–1.24) | 102.77 (101.64–104.10) | no |
| web | reasoning-long-sections | native | 5 | 281.80 (206.50–346.10) | 1.47 (1.07–1.76) | 100.23 (97.52–100.77) | no |
| web | reasoning-long-sections | upstream | 5 | 989.00 (910.50–1035.80) | 2.62 (2.46–2.70) | 103.04 (101.14–104.79) | no |
| web | reasoning-long-sections | fork | 5 | 60.50 (50.90–66.10) | 0.86 (0.76–0.94) | 103.97 (101.44–104.64) | no |
| web | reasoning-long-sections | aa | 5 | 62.00 (53.30–69.20) | 0.81 (0.69–0.90) | 103.97 (101.39–104.59) | no |
| web | reasoning-long-sections | parent | 5 | 65.60 (41.20–88.70) | 0.92 (0.63–1.06) | 103.22 (101.37–105.10) | no |
| web | shell-log-large | native | 5 | 23.70 (15.90–28.30) | 0.57 (0.54–0.66) | 100.35 (98.63–101.22) | no |
| web | shell-log-large | upstream | 5 | 185.80 (166.20–194.80) | 1.33 (1.25–1.44) | 116.54 (114.14–117.37) | no |
| web | shell-log-large | fork | 5 | 13.70 (11.50–15.50) | 0.43 (0.39–0.51) | 103.90 (101.25–104.18) | no |
| web | shell-log-large | aa | 5 | 14.00 (13.40–18.10) | 0.40 (0.36–0.53) | 104.05 (101.68–105.08) | no |
| web | shell-log-large | parent | 5 | 11.40 (10.20–21.70) | 0.43 (0.32–0.54) | 104.13 (101.29–104.93) | no |
| web | table-streaming | native | 5 | 686.20 (603.60–896.90) | 1.74 (1.59–2.19) | 103.58 (102.76–106.03) | no |
| web | table-streaming | upstream | 5 | 232.00 (219.10–323.90) | 1.16 (1.08–1.53) | 104.43 (103.18–106.77) | no |
| web | table-streaming | fork | 5 | 156.00 (129.80–177.50) | 1.08 (0.91–1.21) | 105.09 (104.76–107.62) | no |
| web | table-streaming | aa | 5 | 153.50 (111.30–165.10) | 1.04 (0.85–1.21) | 105.13 (104.68–108.22) | no |
| web | table-streaming | parent | 5 | 138.90 (109.70–187.40) | 0.99 (0.85–1.26) | 105.41 (104.60–106.94) | no |
| web | tool-expanded-streaming | native | 5 | 37.40 (34.00–41.00) | 0.99 (0.90–1.08) | 100.56 (99.88–103.61) | no |
| web | tool-expanded-streaming | upstream | 5 | 559.20 (521.80–594.90) | 2.62 (2.49–2.78) | 111.56 (110.84–114.55) | no |
| web | tool-expanded-streaming | fork | 5 | 51.10 (41.80–57.50) | 0.84 (0.73–0.92) | 106.22 (105.69–108.58) | no |
| web | tool-expanded-streaming | aa | 5 | 53.30 (46.40–64.20) | 0.86 (0.72–1.04) | 106.05 (105.51–108.00) | no |
| web | tool-expanded-streaming | parent | 5 | 48.20 (45.30–62.20) | 0.83 (0.71–1.04) | 106.23 (105.40–108.17) | no |
| ios | codeblock-streaming | native | 5 | 2321.71 (2258.19–2363.88) | N/A | N/A | no |
| ios | codeblock-streaming | upstream | 5 | 4802.11 (4667.47–4947.48) | N/A | N/A | no |
| ios | codeblock-streaming | fork | 5 | 754.39 (740.74–783.24) | N/A | N/A | no |
| ios | codeblock-streaming | aa | 5 | 755.24 (740.09–792.04) | N/A | N/A | yes |
| ios | codeblock-streaming | parent | 5 | 734.00 (731.87–790.03) | N/A | N/A | yes |
| ios | diff-large | native | 5 | 46.91 (39.49–48.67) | N/A | N/A | no |
| ios | diff-large | upstream | 5 | 3151.09 (3018.55–4176.37) | N/A | N/A | no |
| ios | diff-large | fork | 5 | 55.68 (37.95–60.34) | N/A | N/A | yes |
| ios | diff-large | aa | 5 | 61.33 (44.84–66.58) | N/A | N/A | yes |
| ios | diff-large | parent | 5 | 54.11 (40.18–64.11) | N/A | N/A | no |
| ios | history-100 | native | 5 | 198.91 (185.85–227.08) | N/A | N/A | no |
| ios | history-100 | upstream | 5 | 260.66 (187.58–281.37) | N/A | N/A | no |
| ios | history-100 | fork | 5 | 193.34 (116.86–222.03) | N/A | N/A | yes |
| ios | history-100 | aa | 5 | 204.80 (115.66–210.57) | N/A | N/A | yes |
| ios | history-100 | parent | 5 | 208.50 (196.70–217.34) | N/A | N/A | no |
| ios | markdown-long | native | 5 | 5113.15 (4993.65–5413.79) | N/A | N/A | no |
| ios | markdown-long | upstream | 5 | 13914.38 (13472.75–14158.94) | N/A | N/A | no |
| ios | markdown-long | fork | 5 | 1561.59 (1447.91–1634.59) | N/A | N/A | yes |
| ios | markdown-long | aa | 5 | 1525.03 (1478.30–1579.59) | N/A | N/A | yes |
| ios | markdown-long | parent | 5 | 1490.01 (1483.33–1563.48) | N/A | N/A | no |
| ios | mixed-turn | native | 5 | 267.11 (253.05–279.47) | N/A | N/A | no |
| ios | mixed-turn | upstream | 5 | 647.55 (635.19–665.25) | N/A | N/A | no |
| ios | mixed-turn | fork | 5 | 229.84 (220.59–239.47) | N/A | N/A | yes |
| ios | mixed-turn | aa | 5 | 238.71 (228.80–265.99) | N/A | N/A | no |
| ios | mixed-turn | parent | 5 | 219.82 (215.94–233.67) | N/A | N/A | no |
| ios | reads-20 | native | 5 | 278.42 (266.43–286.78) | N/A | N/A | no |
| ios | reads-20 | upstream | 5 | 2640.92 (2367.70–2822.29) | N/A | N/A | no |
| ios | reads-20 | fork | 5 | 265.78 (255.74–305.18) | N/A | N/A | no |
| ios | reads-20 | aa | 5 | 269.08 (234.66–292.80) | N/A | N/A | yes |
| ios | reads-20 | parent | 5 | 276.69 (258.73–287.64) | N/A | N/A | no |
| ios | reasoning-long-prose | native | 5 | 262.35 (243.97–269.80) | N/A | N/A | no |
| ios | reasoning-long-prose | upstream | 5 | 1477.32 (1442.11–1551.62) | N/A | N/A | no |
| ios | reasoning-long-prose | fork | 5 | 259.45 (241.90–263.48) | N/A | N/A | no |
| ios | reasoning-long-prose | aa | 5 | 259.13 (242.76–278.88) | N/A | N/A | yes |
| ios | reasoning-long-prose | parent | 5 | 259.71 (252.65–267.01) | N/A | N/A | yes |
| ios | reasoning-long-sections | native | 5 | 241.39 (200.44–252.44) | N/A | N/A | no |
| ios | reasoning-long-sections | upstream | 5 | 2536.09 (2477.87–2599.88) | N/A | N/A | no |
| ios | reasoning-long-sections | fork | 5 | 230.15 (209.65–234.25) | N/A | N/A | yes |
| ios | reasoning-long-sections | aa | 5 | 223.80 (208.75–262.14) | N/A | N/A | no |
| ios | reasoning-long-sections | parent | 5 | 222.03 (201.78–236.47) | N/A | N/A | no |
| ios | shell-log-large | native | 5 | 47.76 (44.26–51.25) | N/A | N/A | no |
| ios | shell-log-large | upstream | 5 | 369.89 (354.74–372.81) | N/A | N/A | no |
| ios | shell-log-large | fork | 5 | 55.13 (40.74–59.21) | N/A | N/A | no |
| ios | shell-log-large | aa | 5 | 47.02 (41.55–57.17) | N/A | N/A | no |
| ios | shell-log-large | parent | 5 | 50.23 (41.54–53.92) | N/A | N/A | no |
| ios | table-streaming | native | 5 | 937.32 (889.40–996.17) | N/A | N/A | no |
| ios | table-streaming | upstream | 5 | 1107.72 (1072.95–1151.43) | N/A | N/A | no |
| ios | table-streaming | fork | 5 | 552.55 (528.86–582.16) | N/A | N/A | yes |
| ios | table-streaming | aa | 5 | 545.09 (526.12–585.38) | N/A | N/A | no |
| ios | table-streaming | parent | 5 | 547.35 (534.91–628.60) | N/A | N/A | yes |
| ios | tool-expanded-streaming | native | 5 | 165.86 (154.36–168.17) | N/A | N/A | no |
| ios | tool-expanded-streaming | upstream | 5 | 3155.39 (3059.60–3186.67) | N/A | N/A | no |
| ios | tool-expanded-streaming | fork | 5 | 171.86 (159.08–195.46) | N/A | N/A | no |
| ios | tool-expanded-streaming | aa | 5 | 180.68 (168.36–189.41) | N/A | N/A | yes |
| ios | tool-expanded-streaming | parent | 5 | 183.40 (157.34–199.80) | N/A | N/A | yes |

## A/A pairs

Diagnostic pairs retain their recorded values for investigation and do not establish numeric acceptance.

| Platform | Scenario | Pairs | Diagnostic pairs | Over 10% | Maximum absolute difference |
| --- | --- | ---: | ---: | ---: | ---: |
| web | codeblock-streaming | 5 | 0 | 1 | 25.97% |
| web | diff-large | 5 | 0 | 4 | 33.96% |
| web | history-100 | 5 | 0 | 4 | 27.78% |
| web | markdown-long | 5 | 0 | 3 | 24.70% |
| web | mixed-turn | 5 | 0 | 3 | 34.30% |
| web | reads-20 | 5 | 0 | 5 | 36.11% |
| web | reasoning-long-prose | 5 | 0 | 2 | 22.29% |
| web | reasoning-long-sections | 5 | 0 | 3 | 19.36% |
| web | shell-log-large | 5 | 0 | 2 | 57.39% |
| web | table-streaming | 5 | 0 | 4 | 32.67% |
| web | tool-expanded-streaming | 5 | 0 | 3 | 23.44% |
| ios | codeblock-streaming | 5 | 1 | 0 | 4.73% |
| ios | diff-large | 5 | 2 | 4 | 20.87% |
| ios | history-100 | 5 | 1 | 0 | 8.28% |
| ios | markdown-long | 5 | 1 | 0 | 9.56% |
| ios | mixed-turn | 5 | 1 | 1 | 20.58% |
| ios | reads-20 | 5 | 2 | 1 | 10.17% |
| ios | reasoning-long-prose | 5 | 1 | 1 | 14.23% |
| ios | reasoning-long-sections | 5 | 1 | 1 | 13.90% |
| ios | shell-log-large | 5 | 0 | 3 | 20.14% |
| ios | table-streaming | 5 | 1 | 1 | 10.69% |
| ios | tool-expanded-streaming | 5 | 1 | 0 | 5.84% |

Collected 550/550 replay + 80/80 history attempts. Replay structural failures: 0; history structural failures: 0; history quality-gate failures: 7; maximum actual timed groups: 4.

- incident-candidate-3-2: collection/display failure
- incident-candidate-3-2: agent archival state not verified
- incident-candidate-3-2: whole-session unmount/return not proven
- incident-candidate-3-2: older reveal missing
- incident-candidate-3-2: exact-copy gate
- incident-candidate-3-2: older missing/empty
- incident-candidate-3-2: sessionRemount missing/empty
