# TangerineTools · 参考数据源管理

本文记录洛克王国世界预置资料相关的数据源、使用边界与刷新方式。后续版本更新时，优先先审计 BWiki 可解析内容，再决定是否刷新预置 JSON。

## 数据源分级

| 级别 | 名称 | 当前定位 | 覆盖策略 |
|---|---|---|---|
| S0 | 用户本地 IndexedDB / 导入 JSON | 用户自己的资料、拥有记录、统计与手工修正 | 权重最高；预置迁移不得覆盖用户非空字段 |
| S1 | gamecenter compendium `d.json` | 当前已落地的精灵 / 技能预置主同步源，本质是图鉴静态 JSON | 可生成预置产物；后续不再简单称为“官方源” |
| S2 | BWiki 洛克王国世界页面 | 新版本主同步候选源 / 玩家共建 WIKI 源 | 版本更新时手动拉取；先生成审计或 staging，不在应用运行时实时查询 |
| S3 | 外部攻略 / 社区定位资料 | 性格推荐规则校准与定位旁证 | 只记录定位、机制、强弱评价；不直接覆盖预置字段 |
| S4 | 生成报告 | 审计、校准、回归材料 | 不作为事实源反向覆盖主数据 |

## 已登记 BWiki 页面

| 页面 | URL | 当前用途 |
|---|---|---|
| 首页 | https://wiki.biligame.com/rocom/%E9%A6%96%E9%A1%B5 | 入口索引，可发现图鉴、筛选、蛋组、精灵蛋、果实等页面 |
| 精灵图鉴 | https://wiki.biligame.com/rocom/%E7%B2%BE%E7%81%B5%E5%9B%BE%E9%89%B4 | 精灵图鉴展示页；可作为详情入口来源 |
| 精灵筛选 | https://wiki.biligame.com/rocom/%E7%B2%BE%E7%81%B5%E7%AD%9B%E9%80%89 | 可解析编号、名称、属性、特性名、六维、总种族值 |
| 精灵详情样例 | https://wiki.biligame.com/rocom/%E9%9B%AA%E7%BB%92%E9%B8%9F%EF%BC%88%E6%98%A5%E5%A4%A9%E7%9A%84%E6%A0%B7%E5%AD%90%EF%BC%89 | 验证详情页可解析特性详情、会的技能、进化链、蛋组、图片 |
| 技能图鉴 | https://wiki.biligame.com/rocom/%E6%8A%80%E8%83%BD%E5%9B%BE%E9%89%B4 | 技能展示页；可作为技能详情入口来源 |
| 技能查询 | https://wiki.biligame.com/rocom/%E6%8A%80%E8%83%BD%E6%9F%A5%E8%AF%A2 | 可解析技能名、属性、分类、能耗、威力、效果 |
| 精灵蛋图鉴 | https://wiki.biligame.com/rocom/%E7%B2%BE%E7%81%B5%E8%9B%8B%E5%9B%BE%E9%89%B4 | 可作为后续独立资料表候选 |
| 精灵蛋筛选 | https://wiki.biligame.com/rocom/%E7%B2%BE%E7%81%B5%E8%9B%8B%E7%AD%9B%E9%80%89 | 可作为后续独立资料表候选 |
| 精灵果实图鉴 | https://wiki.biligame.com/rocom/%E7%B2%BE%E7%81%B5%E6%9E%9C%E5%AE%9E%E5%9B%BE%E9%89%B4 | 可作为后续独立资料表候选 |
| 蛋组计算器 | https://wiki.biligame.com/rocom/%E8%9B%8B%E7%BB%84%E8%AE%A1%E7%AE%97%E5%99%A8 | 蛋组枚举与繁育关系参考 |
| 孵蛋组别查询 | https://wiki.biligame.com/rocom/%E5%AD%B5%E8%9B%8B%E7%BB%84%E5%88%AB%E6%9F%A5%E8%AF%A2 | 当前 `npm run sync:breeding` 的蛋组快照来源 |

## BWiki 同步口径

- BWiki 是玩家共建页面，不命名为“官方源”；后续可作为“主同步候选源 / 最新社区数据源”。
- 应用运行时不实时查询 BWiki；当前模式是版本更新时由维护者手动运行脚本生成本地快照。
- 精灵详情页优先用于补齐特性详情、技能列表、血脉/互斥技能、进化链、蛋组与图片。
- 技能关系由精灵详情页的技能卡建立：精灵行写 `skillRefs`，技能行再反推 `learnerRefs`。
- “本来的样子”等本地形态名后续可以 BWiki 命名为准，迁移时需要做名称 / 形态归一化。
- 图片后续以 BWiki / patchwiki 页面图片为准；切换前应在 staging 产物中保留来源，避免不可逆覆盖。
- 精灵蛋图鉴、精灵蛋筛选、精灵果实图鉴可以加入资料库，但应作为独立资料表，不混入“精灵基础资料”。

## 当前命令

| 命令 | 作用 |
|---|---|
| `npm run audit:bwiki` | 联网抓取已登记 BWiki 页面，生成 `docs/bwiki-source-audit.md`，只做可解析性与覆盖差异审计 |
| `npm run sync:breeding` | 从 BWiki 孵蛋组别查询生成 `public/presets/rockKingdomBreedingRows.json` |
| `npm run sync:rock scripts/data/rockKingdom.d.json` | 从当前本地 `d.json` 生成精灵 / 技能预置，并合并孵蛋补充快照 |

## 推荐落地顺序

1. 运行 `npm run audit:bwiki`，确认 BWiki 页面的行数、字段、命名差异与新增内容。
2. 后续新增 BWiki staging JSON，先保存解析结果与来源，不直接替换现有预置。
3. 人工确认字段映射、名称归一化、图片来源与技能关系后，再替换 `rockKingdomRows.json` / `rockKingdomSkillRows.json`。
