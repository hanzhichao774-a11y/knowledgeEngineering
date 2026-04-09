# Graph Report - .  (2026-04-09)

## Corpus Check
- Corpus is ~1,871 words - fits in a single context window. You may not need a graph.

## Summary
- 128 nodes · 134 edges · 11 communities detected
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `热力简报（2026年2月8日-2月9日）` - 19 edges
2. `北京市域内独网气耗情况排名表` - 14 edges
3. `北京市域内独网水耗情况排名表` - 14 edges
4. `北京市域内独网电耗情况排名表` - 14 edges
5. `2月8日（供热季第86日）0-24时北京热力诉求总量` - 14 edges
6. `北京市政热网热耗情况排名表（非计量）` - 10 edges
7. `北京市政热网水耗情况排名表` - 9 edges
8. `北京市政热网电耗情况排名表` - 9 edges
9. `室温分布` - 7 edges
10. `室温监测和客服工单` - 6 edges

## Surprising Connections (you probably didn't know these)
- `热力简报（2026年2月8日-2月9日）` --references--> `北京市政热网水耗情况排名表`  [EXTRACTED]
  2026-04-09T03-28-15-693Z-68211456-4933-4433-8788-8ca204c1afa5-热力简报_2月9日_.pdf → 2026-04-09T03-28-15-693Z-68211456-4933-4433-8788-8ca204c1afa5-热力简报_2月9日_.pdf  _Bridges community 0 → community 6_
- `热力简报（2026年2月8日-2月9日）` --references--> `北京市政热网热耗情况排名表（非计量）`  [EXTRACTED]
  2026-04-09T03-28-15-693Z-68211456-4933-4433-8788-8ca204c1afa5-热力简报_2月9日_.pdf → 2026-04-09T03-28-15-693Z-68211456-4933-4433-8788-8ca204c1afa5-热力简报_2月9日_.pdf  _Bridges community 0 → community 5_
- `热力简报（2026年2月8日-2月9日）` --references--> `北京市政热网电耗情况排名表`  [EXTRACTED]
  2026-04-09T03-28-15-693Z-68211456-4933-4433-8788-8ca204c1afa5-热力简报_2月9日_.pdf → 2026-04-09T03-28-15-693Z-68211456-4933-4433-8788-8ca204c1afa5-热力简报_2月9日_.pdf  _Bridges community 0 → community 7_
- `热力简报（2026年2月8日-2月9日）` --references--> `北京市域内独网气耗情况排名表`  [EXTRACTED]
  2026-04-09T03-28-15-693Z-68211456-4933-4433-8788-8ca204c1afa5-热力简报_2月9日_.pdf → 2026-04-09T03-28-15-693Z-68211456-4933-4433-8788-8ca204c1afa5-热力简报_2月9日_.pdf  _Bridges community 0 → community 2_
- `热力简报（2026年2月8日-2月9日）` --references--> `北京市域内独网水耗情况排名表`  [EXTRACTED]
  2026-04-09T03-28-15-693Z-68211456-4933-4433-8788-8ca204c1afa5-热力简报_2月9日_.pdf → 2026-04-09T03-28-15-693Z-68211456-4933-4433-8788-8ca204c1afa5-热力简报_2月9日_.pdf  _Bridges community 0 → community 3_

## Hyperedges (group relationships)
- **热线工单派单量对比** — series_2025_12345_work_orders, series_2026_12345_work_orders, series_2025_96069_work_orders, series_2026_96069_work_orders [EXTRACTED 1.00]

## Communities

### Community 0 - "运行缺陷与事件"
Cohesion: 0.1
Nodes (22): 水碓线10#北侧疑似漏点, 左安门线12#南侧穿墙套管疑似漏点, 前东线23#北支DN200供水管泄漏, 附件1：市政一次热网隐患清单, 附件2：市政一次热网在施项目清单, 附件3：热力站及二次系统抢修明细, 热力简报（2026年2月8日-2月9日）, 一批表计 | 113141 | 16638 | 14.71% | 92.73% (+14 more)

### Community 1 - "分公司诉求分布"
Cohesion: 0.13
Nodes (15): 2月8日（供热季第86日）0-24时北京热力诉求总量, 朝二分公司, 通州分公司, 房山热力公司, 延庆热力公司, 其他（输配等）, 朝一分公司, 西城分公司 (+7 more)

### Community 2 - "独网气耗排名"
Cohesion: 0.14
Nodes (14): 京能房山 | 570万㎡ | 12700GJ | 427619Nm3 | 33.67 | 0.0572 | 3.86%, 门头沟 | 1262万㎡ | 30749GJ | 905566Nm3 | 29.45 | 0.0574 | 9.08%, 丰台 | 694万㎡ | 15810GJ | 495001Nm3 | 31.20 | 0.0586 | 9.21%, 西城 | 75万㎡ | 1910GJ | 58694Nm3 | 30.73 | 0.0655 | 14.36%, 弘益 | 410万㎡ | 8170GJ | 221871Nm3 | 27.16 | 0.0445 | 11.27%, 京能延庆 | 708万㎡ | 17822GJ | 591311Nm3 | 33.18 | 0.0454 | 6.93%, 华源 | 1076万㎡ | 23012GJ | 691941Nm3 | 30.07 | 0.0499 | 7.62%, 海淀 | 1022万㎡ | 21710GJ | 698436Nm3 | 32.17 | 0.0530 | -1.27% (+6 more)

### Community 3 - "独网水耗排名"
Cohesion: 0.14
Nodes (14): 朝二 | 388万㎡ | 112t | 0.0288 | -8.20%, 通州 | 317万㎡ | 154t | 0.0485 | -1.28%, 西城 | 75万㎡ | 49t | 0.0650 | 19.51%, 东城 | 254万㎡ | 176t | 0.0692 | -30.98%, 京能延庆 | 708万㎡ | 79t | 0.0112 | -7.06%, 华源 | 1036万㎡ | 140t | 0.0135 | 9.15%, 门头沟 | 1262万㎡ | 189t | 0.0150 | 18.87%, 丰台 | 695万㎡ | 132t | 0.0190 | 6.45% (+6 more)

### Community 4 - "独网电耗排名"
Cohesion: 0.14
Nodes (14): 弘益 | 402万㎡ | 54811KWh | 0.0136 | -37.89%, 朝二 | 384万㎡ | 55029KWh | 0.0143 | -1.61%, 西城 | 75万㎡ | 13643KWh | 0.0182 | 0.94%, 东城 | 254万㎡ | 57268KWh | 0.0225 | 0.08%, 京能延庆 | 708万㎡ | 45843KWh | 0.0065 | 2.39%, 京能房山 | 570万㎡ | 37610KWh | 0.0066 | 1.76%, 石景山 | 506万㎡ | 38481KWh | 0.0076 | 11.57%, 门头沟 | 1262万㎡ | 106097KWh | 0.0084 | -0.89% (+6 more)

### Community 5 - "市政热耗排名"
Cohesion: 0.2
Nodes (10): 华源 | 2177万㎡ | 4.25万GJ | 0.0016 | 8.02%, 朝二 | 1739万㎡ | 3.48万GJ | 0.0016 | 8.14%, 东城 | 1146万㎡ | 2.27万GJ | 0.0016 | 4.78%, 丰台 | 965万㎡ | 1.93万GJ | 0.0016 | 12.76%, 门头沟 | 193万㎡ | 0.40万GJ | 0.0016 | 1.96%, 西城 | 1895万㎡ | 3.84万GJ | 0.0017 | 5.73%, 朝一 | 1789万㎡ | 3.77万GJ | 0.0017 | 6.36%, 海淀 | 2452万㎡ | 5.43万GJ | 0.0017 | 2.76% (+2 more)

### Community 6 - "市政水耗排名"
Cohesion: 0.22
Nodes (9): 丰台 | 1052万㎡ | 195t | 0.0185 | -45.07%, 门头沟 | 194万㎡ | 45t | 0.0232 | -18.18%, 东城 | 1100万㎡ | 282t | 0.0256 | 5.62%, 朝一 | 1684万㎡ | 494t | 0.0293 | -17.20%, 朝二 | 1796万㎡ | 532t | 0.0296 | -6.27%, 西城 | 1587万㎡ | 514t | 0.0324 | 8.90%, 石景山 | 1365万㎡ | 464t | 0.0340 | 2.88%, 海淀 | 1878万㎡ | 675t | 0.0360 | -1.53% (+1 more)

### Community 7 - "市政电耗排名"
Cohesion: 0.22
Nodes (9): 海淀 | 1812万㎡ | 189062KWh | 0.0104 | -0.73%, 丰台 | 1032万㎡ | 110430KWh | 0.0107 | 5.75%, 门头沟 | 194万㎡ | 21570KWh | 0.0111 | 0.71%, 朝二 | 1692万㎡ | 200935KWh | 0.0119 | -1.84%, 朝一 | 1650万㎡ | 197868KWh | 0.0120 | -1.03%, 石景山 | 1273万㎡ | 153776KWh | 0.0121 | 0.19%, 西城 | 1350万㎡ | 168397KWh | 0.0125 | -2.67%, 东城 | 952万㎡ | 123595KWh | 0.0130 | -1.99% (+1 more)

### Community 8 - "室温分布"
Cohesion: 0.29
Nodes (7): 一批表计 18-22℃ | 6936 | 41.69%, 一批表计 >22℃ | 8492 | 51.04%, 一批表计 <18℃ | 1210 | 7.27%, 二批表计 18-22℃ | 63883 | 45.76%, 二批表计 >22℃ | 63385 | 45.40%, 二批表计 <18℃ | 12349 | 8.84%, 室温分布

### Community 9 - "热线与室温统计"
Cohesion: 0.43
Nodes (7): 12345热线 | 95件 | 接通率/一次解决率未披露, 96069热线 | 331件 | 接通率99.9% | 一次解决率13.3%, 微循环热线 | 311件 | 派发310件 | 环比5.8%, 小循环热线 | 437件 | 一次解决率7.7%, 室温监测和客服工单, 热线接听情况, 室温与工单统计

### Community 10 - "热线趋势对比"
Cohesion: 0.38
Nodes (7): 12345工单量在2月7日至8日明显增长, 96069工单量后期快速上升, 北京热力12345及96069热线工单派单量15日同期比, 2025年12345工单量, 2025年96069工单量, 2026年12345工单量, 2026年96069工单量

## Knowledge Gaps
- **96 isolated node(s):** `大网热耗后三位`, `大网水耗后三位`, `独网气耗后三位`, `独网水耗后三位`, `供热突发情况` (+91 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `热力简报（2026年2月8日-2月9日）` connect `运行缺陷与事件` to `独网气耗排名`, `独网水耗排名`, `独网电耗排名`, `市政热耗排名`, `市政水耗排名`, `市政电耗排名`, `室温分布`, `热线与室温统计`?**
  _High betweenness centrality (0.625) - this node is a cross-community bridge._
- **Why does `北京市域内独网气耗情况排名表` connect `独网气耗排名` to `运行缺陷与事件`?**
  _High betweenness centrality (0.159) - this node is a cross-community bridge._
- **Why does `北京市域内独网水耗情况排名表` connect `独网水耗排名` to `运行缺陷与事件`?**
  _High betweenness centrality (0.159) - this node is a cross-community bridge._
- **What connects `大网热耗后三位`, `大网水耗后三位`, `独网气耗后三位` to the rest of the system?**
  _96 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `运行缺陷与事件` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `分公司诉求分布` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._
- **Should `独网气耗排名` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._