# rocom-data 学习记录与 TangerineTools 引入边界

本文记录对 [`AofeiLi-code/rocom-data`](https://github.com/AofeiLi-code/rocom-data) 的学习结论，用于后续 session 继续优化洛克王国资料、性格推荐与未来扩展。

## 本轮结论

`rocom-data` 是一个 Python 项目，覆盖 BWIKI 数据爬取、精灵/技能资料、玩家阵容、战斗模拟、MCTS/LLM 智能体、PVP 自动化、MariaDB 战斗日志与 LLM 复盘。TangerineTools 仍保持本地优先的静态 Web App 定位，因此不能整体搬运它的战斗系统或后端能力。

本轮采用的原则：

1. **预置资料仍以 TangerineTools 自己的官方 `d.json` 同步结果为准**。`rocom-data` 或 BWIKI 数据只作为检查、补充与未来用户可选导入来源。
2. **学习爬虫思路，不直接复制数据源实现**。未来可以自行实现补充资料爬取脚本，但必须保持来源标记、增量合并、失败可恢复与不覆盖用户数据。
3. **阵容相关先不做**。阵容结构与现有资料库/owned/stock/nature 都不完全相同，后续需要单独设计；本轮只在性格推荐规则层预留“阵容需要某些性格可保留”的上下文入口。
4. **学习技能效果字段建模**。不引入完整战斗模拟，只把技能资料从“类型/威力/能耗/文本”扩展为轻量效果标签，服务资料查看与性格推荐解释。
5. **属性克制先不接入性格推荐**。未来可以单独做资料查询或阵容弱点统计，但它不应影响当前性格推荐。
6. **战斗属性公式保持占位**。可记录候选公式线索，但等用户继续确认官方/可信公式后再启用。
7. **学习 YAML 的“规则可配置化”思想**。Web 端不直接引入 YAML；未来使用本地 JSON/配置 UI 保存规则预设。
8. **战斗模拟、MCTS、LLM 自动组队、PVP 自动化、MariaDB 后端暂不做**。

## 可借鉴点

### 数据爬虫

`rocom-data` 的爬虫会输出精灵 JSON/CSV、技能 CSV、图片 URL 清单和阵容资料；它也处理请求头、请求间隔、重试和本地备份。TangerineTools 后续可参考这些工程实践实现自己的补充资料同步脚本，但应：

- 输出为可审计 JSON；
- 标记 `source` / `sourceUrl` / `syncedAt`；
- 与官方预置表分开或以补充字段呈现；
- 导入时遵守“同 id 覆盖、缺失保留”的合并语义；
- 不用补充源覆盖用户自定义非空值。

### 技能效果字段

`rocom-data` 的技能模型把技能效果拆成吸血、减伤、回复、能量、先手、脱离、迅捷、蓄力、攻防速增减、异常层数、应对攻击/防御/状态等字段。TangerineTools 不做完整模拟，但可以抽取轻量标签：

- `priority`：先手/优先级；
- `speed`：速度增减或速度收益；
- `healing`：回复、治疗、吸血；
- `damageReduction`：防御、护盾、减伤、承伤；
- `energyGain` / `energyDrain` / `costChange`：能量回复、偷取、失去、能耗变化；
- `statBoost` / `statDebuff`：自身强化或敌方削弱；
- `control`：中毒、灼烧、冻结、睡眠、恐惧、麻痹、混乱等；
- `counterAttack` / `counterDefense` / `counterStatus`：应对攻击/防御/状态；
- `pivot`：脱离、换入、换场、返场；
- `multiHit`：连击；
- `charge`：蓄力；
- `fieldEffect`：天气、场地、持续环境类效果。

这些标签应作为“资料派生字段”和“推荐解释输入”，不要直接变成不可解释的单一分数。

### 性格推荐

下一步优化应从“样例精灵校准”转为“技能效果先结构化”：

1. 从 `skillRefs` 读取技能行；
2. 读取预生成的 `effectTags`，缺失时按效果文本兜底解析；
3. 得到技能效果摘要；
4. 用摘要增强定位识别和候选理由：速度、续航、能量、控制、后手、应对等；
5. 保留全部 30 个候选展示。

### 规则配置

`rocom-data` 的 YAML 策略说明了“规则显式化”的价值。TangerineTools 后续可用 JSON/本地 UI 做规则预设，例如输出优先、速度优先、耐久优先、保守可留等；本轮不新增持久化 schema。

## 本轮不做

- 不做阵容资料库、阵容导入、队伍名册；
- 不做属性克制查询或推荐权重；
- 不做战斗模拟、MCTS、自动对战、MariaDB；
- 不直接采用 `rocom-data` 的战斗属性公式；
- 不复制无许可证确认的大段代码。

## 后续建议 Prompt

```text
请继续优化 TangerineTools 的洛克王国性格推荐。先阅读 docs/rocom-data-analysis.md、docs/nature-recommendation-redesign.md、docs/data-sync.md。

本轮重点：基于具体精灵样例校准规则权重。
- 预置资料仍以官方 d.json 同步结果为准；
- 技能效果标签 effectTags 已作为轻量输入，不做完整战斗模拟；
- 先运行 npm run check:nature 查看 docs/nature-calibration-report.md；
- 阵容、属性克制、战斗模拟暂不做；
- 可讨论阵容需要导致某些性格“可保留”的规则入口；
- 不引入 Dexie schema 版本变更；
- 修改后运行 npm run build 和 npm run lint。
```
