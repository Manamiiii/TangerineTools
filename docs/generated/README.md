# 版本化生成报告

本目录保存需要随代码版本一起审阅、但正文不应手工编辑的报告。

| 文件 | 生成命令 | 人工输入 |
|---|---|---|
| `nature-calibration-report.md` | `npm run check:nature` | `scripts/data/natureCalibrationSamples.json`、正式预置和当前性格规则 |
| `rocom-position-audit-plan.md` | `npm run audit:rocom` | `scripts/data/rocomAuditFindings.json`、正式预置和当前性格规则 |

生成报告和 `artifacts/` 的区别：这里的报告会进入 Git，作为规则评审和回归快照；`artifacts/` 只保存可随时重建的本地 BWiki 检查结果，不提交 Git。
