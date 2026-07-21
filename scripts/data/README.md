# 脚本人工输入数据

本目录保存校验脚本需要的、小型且适合人工维护的结构化输入。

| 文件 | 用途 | 消费脚本 |
|---|---|---|
| `natureCalibrationSamples.json` | 性格推荐校准样例和关注点 | `scripts/check-nature-recommendations.mjs` |

修改样例后运行 `npm run check:nature`，并检查 Git 忽略的 `artifacts/nature/calibration-report.md`。
