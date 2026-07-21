# 性格推荐文档

本目录只保存需要人工维护的规则说明、模板和确认台账。`npm run check:nature` 生成的校验报告位于 Git 忽略的 `artifacts/nature/calibration-report.md`。

| 文件 | 职责 | 更新时机 |
|---|---|---|
| `rules.md` | 当前规则目标、输入输出、判断层级和校准约束 | 性格规则或解释口径发生变化时 |
| `single-creature-template.md` | “一只精灵一轮”的统一核对模板 | 输出结构发生变化时 |
| `confirmed-results.md` | 用户明确确认过的结果，作为规则回归基线 | 用户确认最终结论后 |
| `open-issues.md` | 尚未形成稳定规则的通用问题 | 发现或关闭规则问题时 |

维护边界：

- 当前运行逻辑以 `src/domain/nature.js` 为准，文档负责解释而不复制完整代码。
- 未经用户确认的单只结论不得写入 `confirmed-results.md`。
- 已解决问题不保留实现过程；最终规则写入 `rules.md`，实现历史由 Git 保存。
- 修改规则后运行 `npm run check:nature`，并复核 `confirmed-results.md` 中的既有结论。
