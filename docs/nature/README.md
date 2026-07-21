# 性格推荐文档

本目录只保存需要人工维护的规则说明、模板和确认台账。运行脚本生成的大型报告统一放在 [`../generated/`](../generated/)。

| 文件 | 职责 | 更新时机 |
|---|---|---|
| `rules.md` | 规则目标、输入输出、设计背景、调参记录和未决问题 | 性格规则或解释口径发生变化时 |
| `single-creature-template.md` | “一只精灵一轮”的统一核对模板 | 输出结构发生变化时 |
| `confirmed-results.md` | 用户明确确认过的结果，作为规则回归基线 | 用户确认最终结论后 |
| `rule-iteration-log.md` | 尚待处理或已经落地的通用规则问题 | 发现规则偏差或完成规则修正时 |

维护边界：

- 当前运行逻辑以 `src/domain/nature.js` 为准，文档负责解释而不复制完整代码。
- 未经用户确认的单只结论不得写入 `confirmed-results.md`。
- 修改规则后运行 `npm run check:nature`，并复核 `confirmed-results.md` 中的既有结论。
