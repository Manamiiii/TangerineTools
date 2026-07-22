# BWiki 字段映射冻结说明

本文记录当前 BWiki staging / detail staging 到洛克王国资料库字段的正式映射口径。更新数据时先生成 preview 并校验，只有显式 apply 才覆盖 `public/presets/*`；不引入 Dexie schema version 变更。

## 输入与输出范围

| 输入 | 产物 | 当前用途 |
|---|---|---|
| `scripts/bwiki/data/staging/creatures.json` | 精灵筛选页 staging | 精灵基础信息、六维、形态、图片入口、蛋 / 果实图片、详情页链接 |
| `scripts/bwiki/data/staging/skills.json` | 技能查询 staging | 技能基础字段和独立技能行候选 |
| `scripts/bwiki/data/staging/eggs.json` | 精灵蛋筛选 staging | `eggImage` / `fruitImage` 图片来源 |
| `scripts/bwiki/data/staging/creature-details.json` | 精灵详情关系 staging | 特性描述、技能名、来源类型、解锁提示和进化链；完整技能正文统一由 `skills.json` 维护，避免每只精灵重复存储 |
| `artifacts/bwiki/rockKingdomPresetMigration.preview.json` | 临时三方迁移清单 | 仅记录变化字段的旧正式值 SHA-256；显式发布时写入 `public/presets`，不提交临时文件 |
| `public/presets/rockKingdomRows.json` | 当前精灵预置 | 正式基线 592 行 |
| `public/presets/rockKingdomSkillRows.json` | 当前技能预置 | 正式基线 553 行 |

## 精灵基础资料字段映射

| 现有字段 key | 字段名 | BWiki 来源 | 转换 / 合并口径 | preview 处理 |
|---|---|---|---|---|
| `image` | 精灵图 | 精灵筛选页头像；筛选页缺图时用精灵图鉴页同“编号 + 名称”或唯一名称卡片补齐 | 不拼接或猜测图片 URL；只接受 BWiki 页面实际解析出的 `patchwiki` 图片，记录筛选页 / 图鉴页来源 | 写入 preview；覆盖前列出图片来源变化 |
| `name` | 名称 | `creatures.rows[].name` | BWiki 名称作为目标名称；名称别名仅用于稳定 id 匹配 | 写入 preview；生成名称归一化差异表 |
| `no` | 编号 | `creatures.rows[].no` | 保持 `NO.001` 格式；同编号多形态不合并 | 写入 preview |
| `element` | 系别 | `creatures.rows[].elements` | 映射到现有 18 系选项；未知值进入报告，不自动新增选项 | 写入 preview |
| `form` | 形态 | `formCategoryLabel`、`stageLabel` | 首领分类映射为 `首领形态`；一阶、二阶、三阶依次映射为 `Ⅰ阶`、`Ⅱ阶`、`最终形态`。名称括号只描述外观变体，不参与形态派生 | 写入候选并报告来源策略；缺少同步阶段时只接受已有的规范形态值 |
| `bst` / `hp` / `patk` / `matk` / `pdef` / `mdef` / `spd` | 种族值 / 六维 | `creatures.rows[]` 数值字段 | 直接数值映射；空值或非数字进入报告 | 写入 preview |
| `shiny` | 异色形态 | `shinyLabel` | 只映射为当前 `yes` / `no` / `unknown` 选项；无法确认时保留 unknown | 写入 preview |
| `traitName` | 特性 | `creatures.rows[].traitName`；详情 `trait.name` 校验 | 筛选页与详情页不一致时进入冲突报告，不自动择一 | 生成冲突清单 |
| `traitIcon` | 特性图标 | 详情 `trait.image`，筛选页暂无稳定字段 | 有详情图标则写入 preview；无则留空或保留旧值候选 | 写入 preview 候选 |
| `traitDesc` | 特性描述 | 详情 `trait.description` | 详情页为主；空值不覆盖旧非空值，冲突进入报告 | 写入 preview 候选 |
| `traitTags` | 特性标签 | 当前规则派生 / 人工规则 | 不从 BWiki 直接照搬；由本地规则根据特性描述和六维再派生 | 可重跑派生，不作为源字段 |
| `skillTags` | 技能标签 | 当前规则派生 / 技能池分析 | 不从 BWiki 直接照搬；由技能关系与技能效果再派生 | 可重跑派生，不作为源字段 |
| `skillRefs` | 可用技能 | 详情 `skills[].name` 与 `skills[].sourceType` | 按技能名称匹配 preview 技能行 id；保留来源标签用于审计，但现有字段仍只存 row id 数组 | 写入 preview；输出未匹配技能名 |
| `eggGroups` | 蛋组 | `sync:breeding` 版本化快照 | 精灵筛选页 `data-param8` 是归属赛季而不是蛋组；稳定匹配行保留非空值，空值或新行按安全名称匹配从孵蛋快照补齐 | 写入 preview 候选并报告来源 |
| `speciesGroup` | 繁育谱系 | 当前孵蛋快照 / 名称归并 | 保持文本字段；由蛋组快照和同谱系规则生成 | 写入 preview 候选 |
| `evolutionLine` | 进化链 | 详情 `evolution[]` | 写为可读长文本；结构化需求必须复用现有字段能力或单独获得 Dexie schema 变更授权 | 写入 preview 长文本 |
| `eggImage` / `fruitImage` | 精灵蛋 / 精灵果实图片 | `creatures.rows[].eggImage` / `fruitImage` | 作为精灵行图片字段；不新增独立资料表。界面将 `fruitImage` 紧凑标记为「种子」 | 写入正式精灵资料；源页面缺图时保留空值 |
| `previewMeta.seasonLabel` | 归属赛季（审计元数据） | `creatures.rows[].seasonLabel` / 筛选页 `data-param8` | 只留在 preview 审计元数据，不映射到运行时精灵字段 | 不进入正式 preset 行 values |

## 技能资料字段映射

| 现有字段 key | 字段名 | BWiki 来源 | 转换 / 合并口径 | preview 处理 |
|---|---|---|---|---|
| `image` | 技能图标 | `skills.rows[].image` | 以技能查询 staging 为唯一正文来源；详情技能卡只维护学习关系 | 写入 preview |
| `name` | 技能名称 | `skills.rows[].name`、详情 `skills[].name` | 名称是技能匹配主键；重名或缺失进入报告 | 写入 preview |
| `element` | 系别 | `skills.rows[].element` | 映射到现有 18 系选项；详情卡中的值仅保留在关系 staging 供来源审计 | 写入 preview |
| `category` | 类型 | `skills.rows[].category` | 映射到现有 物攻 / 魔攻 / 状态 / 防御 等选项；详情卡中的值仅供关系审计 | 写入 preview |
| `power` | 威力 | `skills.rows[].power` | 数字映射；空值表示无威力技能 | 写入 preview |
| `cost` | 能耗 | `skills.rows[].cost` | 以技能查询 staging 为唯一正文来源 | 写入 preview |
| `priority` | 先制/速度 | 暂无稳定 staging 字段 | 保留现有正式值或留空；不得猜测 | 报告缺口 |
| `effectTags` | 效果标签 | 本地规则根据 `effect` 派生 | 不从 BWiki 直接照搬 | 可重跑派生 |
| `effect` | 效果 | `skills.rows[].effect` | 以技能查询 staging 为唯一正文来源，避免详情快照重复保存长文本 | 写入 preview |
| `learnerRefs` | 可学精灵 | 由全部 preview 精灵 `skillRefs` 反推 | 不从技能页反爬学习者；完整详情 staging 更新全部 `skillRefs`，再对完整 preview 重建反向引用 | 写入 preview，并报告全量双向一致性 |

## 稳定 id 与迁移边界

- 精灵 preview 应优先复用现有 `rock-creature-src-*` 稳定 id，但只在“编号 + 名称”或唯一名称可确认匹配时复用；同编号但名称不同的 BWiki 形态 / 新增精灵必须分配新稳定 id，避免覆盖普通形态。
- 技能 preview 应优先复用现有技能 row id；新增 BWiki 技能再分配新稳定 id。
- 名称归一化只影响 preview 生成和迁移候选，不应绕过显式发布流程直接改 `public/presets/*`。
- 浏览器迁移采用基线正式值 SHA-256、目标预置值和浏览器当前值的三方判断：空值、无效值或匹配基线指纹时更新，其他非空值视为用户自定义并保留。
- 不新增 IndexedDB 表，不改 Dexie schema version；结构化关系仍用现有 `references` 字段表达。

## Preview 验收门槛

Preview 命令只允许生成候选数据和报告，不覆盖正式预置。报告至少需要包含：

1. 精灵行数、技能行数、复用 id 数、新增 id 数。
2. BWiki 名称到现有预置名称的匹配 / 改名 / 未匹配清单。
3. `traitName` / `traitDesc` / 六维 / 系别冲突清单。
4. 技能关系覆盖率：精灵详情技能卡总数、成功匹配技能数、未匹配技能名。
5. `eggGroups` / `speciesGroup` 来源和冲突清单。
6. 图片字段来源统计：BWiki / patchwiki / 兼容 compendium / 空值。
7. 明确声明 preview 未触碰 `public/presets/*`、Dexie、用户数据和 UI。
8. 列出当前稳定 id 未进入 preview 的行，并在覆盖前明确兼容策略。
9. 分开报告“详情技能卡名称匹配率”和 preview 全量 `skillRefs` / `learnerRefs` 双向一致性。

## 当前发布基线

- 精灵详情覆盖 592 行，技能资料覆盖 553 行。
- `public/presets/*` 只包含显式发布的 `id` / `values` 和正式迁移清单。
- 每次数据更新都必须重新生成 staging、preview 和审计报告，再通过显式发布命令落盘。
