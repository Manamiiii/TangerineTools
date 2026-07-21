# 脚本人工输入数据

本目录保存生成脚本需要的、小型且适合人工维护的结构化输入。

| 文件 | 用途 | 消费脚本 |
|---|---|---|
| `natureCalibrationSamples.json` | 性格推荐校准样例和关注点 | `scripts/check-nature-recommendations.mjs`、`scripts/generate-rocom-position-audit-plan.mjs` |
| `rocomAuditFindings.json` | 已核对精灵的状态、外部定位摘要和来源 | `scripts/generate-rocom-position-audit-plan.mjs` |

不要直接在生成的 Markdown 报告里维护这些结论；修改 JSON 后重新运行对应命令。
