# TangerineTools · 参考数据源管理

本文记录洛克王国世界预置资料相关的数据源、使用边界与刷新方式。后续版本更新时，优先先审计 BWiki 可解析内容，再决定是否刷新预置 JSON。

## 数据源分级

| 级别 | 名称 | 当前定位 | 覆盖策略 |
|---|---|---|---|
| S0 | 用户本地 IndexedDB / 导入 JSON | 用户自己的资料、拥有记录、统计与手工修正 | 权重最高；预置迁移不得覆盖用户非空字段 |
| S1 | gamecenter compendium `d.json` | 当前已落地的历史预置来源，本质是图鉴静态 JSON | 保留为回退 / 对照源；后续不再简单称为“官方源” |
| S2 | BWiki 洛克王国世界页面 | 新版本主同步源 / 玩家共建 WIKI 源 | 版本更新时手动拉取；先生成审计或 staging；字段映射确认后可完全覆盖旧预置产物；不在应用运行时实时查询 |
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
| 精灵蛋图鉴 | https://wiki.biligame.com/rocom/%E7%B2%BE%E7%81%B5%E8%9B%8B%E5%9B%BE%E9%89%B4 | 精灵蛋图片字段参考；不单独建表 |
| 精灵蛋筛选 | https://wiki.biligame.com/rocom/%E7%B2%BE%E7%81%B5%E8%9B%8B%E7%AD%9B%E9%80%89 | 解析精灵蛋 / 果实图片并合并到精灵 staging 字段 |
| 精灵果实图鉴 | https://wiki.biligame.com/rocom/%E7%B2%BE%E7%81%B5%E6%9E%9C%E5%AE%9E%E5%9B%BE%E9%89%B4 | 精灵果实图片字段参考；不单独建表 |
| 蛋组计算器 | https://wiki.biligame.com/rocom/%E8%9B%8B%E7%BB%84%E8%AE%A1%E7%AE%97%E5%99%A8 | 蛋组枚举与繁育关系参考 |
| 孵蛋组别查询 | https://wiki.biligame.com/rocom/%E5%AD%B5%E8%9B%8B%E7%BB%84%E5%88%AB%E6%9F%A5%E8%AF%A2 | 当前 `npm run sync:breeding` 的蛋组快照来源 |

## BWiki 同步口径

- BWiki 是玩家共建页面，不命名为“官方源”；用户已确认后续以 BWiki 为主同步源。
- 应用运行时不实时查询 BWiki；当前模式是版本更新时由维护者手动运行脚本生成本地快照。
- BWiki staging 中相对旧预置新增的精灵 / 技能应纳入后续预置；字段映射和详情页解析确认后，可以用显式转换命令完全覆盖旧 `public/presets/rockKingdomRows.json` / `rockKingdomSkillRows.json`。
- 精灵详情页优先用于补齐特性详情、技能列表、血脉/互斥技能、进化链、蛋组与图片。
- 技能关系由精灵详情页的技能卡建立：精灵行写 `skillRefs`，技能行再反推 `learnerRefs`。
- “本来的样子”等本地形态名后续可以 BWiki 命名为准，迁移时需要做名称 / 形态归一化。
- 图片后续以 BWiki / patchwiki 页面图片为准；切换前应在 staging 产物中保留来源，避免不可逆覆盖。
- 系别选项图标使用 BWiki 精灵筛选页当前公开的无文字 `patchwiki` 图标；已有浏览器若仍使用旧 gamecenter 图标，会在未自定义该选项时安全更新。
- 精灵蛋 / 精灵果实不做独立资料表；作为精灵基础资料里的 `eggImage` / `fruitImage` 两个图片字段维护。

## 当前命令

| 命令 | 作用 |
|---|---|
| `npm run audit:bwiki` | 联网抓取已登记 BWiki 页面，生成 `docs/bwiki-source-audit.md`，只做可解析性与覆盖差异审计 |
| `npm run sync:bwiki:staging` | 从 BWiki 精灵筛选 / 技能查询 / 精灵蛋筛选生成 staging 与 `docs/history/bwiki-p4/bwiki-staging-report.md`；不直接替换预置 |
| `npm run sync:bwiki:details` | 从精灵 staging 抓取详情页，生成详情 staging 与 `docs/history/bwiki-p4/bwiki-detail-staging-report.md`；仍不替换预置 |
| `npm run sync:breeding` | 从 BWiki 孵蛋组别查询生成 `scripts/data/bwiki/rockKingdomBreedingRows.staging.json`；正式发布时合入精灵行 |
| `npm run sync:legacy-rock` | 从本地 `d.json` 生成隔离的旧版对照 preview，不覆盖正式预置 |

## 推荐落地顺序

1. 运行 `npm run audit:bwiki`，确认 BWiki 页面的行数、字段、命名差异与新增内容。
2. 运行 `npm run sync:bwiki:staging`，先保存精灵 / 技能 / 精灵蛋筛选页解析结果与来源，不直接替换现有预置。
3. 下一阶段用 staging 里的 `detailUrl` 抓取特性详情、技能学习关系、血脉技能、进化链、蛋组和详情图片。
4. 按 `docs/bwiki-field-mapping.md` 冻结字段映射、名称归一化、图片来源与技能关系后，先新增 preview 转换命令和报告。
5. preview 报告确认无误后，再新增显式覆盖命令完全覆盖 `rockKingdomRows.json` / `rockKingdomSkillRows.json`。
