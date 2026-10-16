# Complete long-history results

Execution changed by explicit user request: 60 samples used the original load gate and 20 used concurrent-max4 resource admission. Earlier iOS samples may also overlap lane preparation; see raw/concurrency-preparation.json. Mixed totals are descriptive, not a uniform serial or fixed-concurrency controlled comparison.

All values are median (minimum–maximum), in milliseconds. Whole-session return is not independent-block remount. No invalid group is silently filled or excluded.

| Platform | Scenario | Mode | Phase | n | Row work | JS-ready proxy | Timer gap |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| web | incident | candidate | open | 10 | 45.4 (43.3–56.4) | 570.4 (525.5–657.0) | 159.6 (138.6–169.7) |
| web | incident | candidate | older | 10 | 12.5 (9.1–18.2) | 61.8 (7.0–127.6) | 56.8 (38.4–63.3) |
| web | incident | candidate | sessionRemount | 10 | 64.1 (57.3–73.3) | 209.0 (188.0–223.1) | 208.9 (187.8–222.9) |
| web | incident | baseline | open | 5 | 1995.1 (1966.0–2040.8) | 1075.0 (1065.2–1129.0) | 700.8 (692.9–724.1) |
| web | incident | baseline | older | 5 | 527.8 (512.0–541.1) | 90.2 (64.7–141.4) | 288.5 (273.2–313.2) |
| web | incident | baseline | sessionRemount | 5 | 2164.8 (2119.2–2231.1) | 1030.3 (966.2–1090.0) | 1029.6 (965.6–1089.1) |
| web | incident | native | open | 5 | 89.3 (85.0–92.4) | 649.1 (614.2–678.4) | 222.5 (212.3–231.2) |
| web | incident | native | older | 5 | 15.9 (15.5–16.6) | 52.6 (7.3–124.9) | 54.8 (52.5–58.6) |
| web | incident | native | sessionRemount | 5 | 157.4 (155.4–164.1) | 349.5 (337.6–362.7) | 349.3 (337.5–362.5) |
| web | multi-turn | candidate | open | 10 | 46.6 (41.3–49.1) | 618.0 (532.9–668.4) | 150.7 (138.1–166.4) |
| web | multi-turn | candidate | older | 10 | 12.7 (9.2–14.2) | 85.6 (14.8–123.8) | 53.2 (38.2–56.8) |
| web | multi-turn | candidate | sessionRemount | 10 | 65.8 (61.4–81.1) | 214.9 (197.6–222.5) | 214.8 (197.5–222.4) |
| web | multi-turn | baseline | open | 5 | 2022.0 (1952.0–2035.4) | 1077.8 (1063.1–1181.9) | 692.4 (656.7–695.6) |
| web | multi-turn | baseline | older | 5 | 540.0 (526.9–550.2) | 84.0 (54.2–140.4) | 282.6 (279.8–324.3) |
| web | multi-turn | baseline | sessionRemount | 5 | 2198.2 (2080.7–2228.9) | 998.2 (975.5–1058.1) | 997.5 (974.9–1057.4) |
| web | multi-turn | native | open | 5 | 85.4 (84.9–87.5) | 645.9 (630.8–668.5) | 216.9 (215.9–224.8) |
| web | multi-turn | native | older | 5 | 21.4 (13.3–23.1) | 55.1 (17.8–121.6) | 52.9 (47.3–64.1) |
| web | multi-turn | native | sessionRemount | 5 | 158.0 (154.2–173.5) | 335.1 (333.8–350.1) | 335.0 (333.8–350.0) |
| ios | incident | candidate | open | 10 | 61.8 (60.4–64.9) | 561.2 (529.3–617.7) | 353.2 (349.8–396.1) |
| ios | incident | candidate | older | 10 | 174.1 (150.2–268.4) | — | 135.1 (121.2–151.9) |
| ios | incident | candidate | sessionRemount | 10 | 99.1 (97.9–111.4) | 425.4 (410.9–505.7) | 423.4 (407.0–503.9) |
| ios | incident | baseline | open | 5 | 190.8 (188.6–193.7) | 695.8 (685.2–716.8) | 463.8 (447.3–469.7) |
| ios | incident | baseline | older | 5 | 11.9 (9.8–13.3) | — | 145.8 (140.1–150.7) |
| ios | incident | baseline | sessionRemount | 5 | 355.9 (351.9–366.3) | 726.2 (718.0–739.2) | 720.6 (713.3–733.5) |
| ios | incident | native | open | 5 | 137.3 (136.0–147.9) | 624.0 (622.4–636.7) | 415.2 (414.6–438.9) |
| ios | incident | native | older | 5 | 183.3 (178.3–205.7) | — | 114.9 (99.0–117.6) |
| ios | incident | native | sessionRemount | 5 | 251.6 (247.7–301.0) | 626.4 (580.3–642.1) | 623.9 (575.9–639.8) |
| ios | multi-turn | candidate | open | 10 | 68.7 (61.8–73.5) | 626.8 (583.4–674.3) | 403.3 (376.2–434.1) |
| ios | multi-turn | candidate | older | 10 | 182.5 (150.7–237.0) | — | 137.2 (127.1–146.9) |
| ios | multi-turn | candidate | sessionRemount | 10 | 105.3 (97.8–118.2) | 471.0 (424.1–575.6) | 468.4 (422.6–573.6) |
| ios | multi-turn | baseline | open | 5 | 187.0 (177.7–189.6) | 717.8 (678.9–724.5) | 479.7 (463.0–485.9) |
| ios | multi-turn | baseline | older | 5 | 49.4 (43.8–74.4) | — | 179.6 (169.0–181.9) |
| ios | multi-turn | baseline | sessionRemount | 5 | 398.6 (381.8–415.7) | 791.1 (766.5–822.7) | 784.1 (729.8–818.7) |
| ios | multi-turn | native | open | 5 | 150.0 (146.4–156.2) | 661.8 (637.1–689.6) | 437.8 (432.7–470.8) |
| ios | multi-turn | native | older | 5 | 191.1 (189.1–221.5) | — | 111.6 (106.2–116.9) |
| ios | multi-turn | native | sessionRemount | 5 | 290.0 (251.5–294.5) | 657.0 (589.1–670.4) | 654.5 (584.6–667.4) |

Collected 80/80; failures 0.
