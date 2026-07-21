# TangerineTools · BWiki 数据链路

洛克王国世界正式预置只维护一条数据链路：BWiki 页面快照 → staging → preview → 显式发布。应用运行时不联网抓取 BWiki，也不再保留旧 `d.json` 数据源。

## 数据优先级

| 优先级 | 数据 | 用途 |
|---|---|---|
| 最高 | 用户 IndexedDB / 导入 JSON | 用户自己的资料、收集记录和手工修正；预置迁移不得覆盖非空自定义值 |
| 正式 | `public/presets/*.json` | 浏览器运行时读取的版本化精灵、技能和三方迁移清单 |
| 生产 | `scripts/data/bwiki/*.staging.json` | 从 BWiki 页面解析出的当前源快照 |
| 审阅 | `scripts/data/bwiki/*preview.json` | 对齐正式预置结构、供发布前审阅和校验 |
| 旁证 | 外部攻略 / 社区资料 | 只用于性格定位和机制核对，不覆盖正式资料字段 |

## 当前 BWiki 页面

| 页面 | URL | 用途 |
|---|---|---|
| 精灵筛选 | https://wiki.biligame.com/rocom/精灵筛选 | 编号、名称、系别、形态、六维、特性名、图片入口 |
| 精灵详情 | 由精灵 staging 的 `detailUrl` 提供 | 特性描述、技能关系、进化链和详情图片 |
| 技能查询 | https://wiki.biligame.com/rocom/技能查询 | 技能名、系别、分类、能耗、威力、效果 |
| 精灵蛋筛选 | https://wiki.biligame.com/rocom/精灵蛋筛选 | 精灵蛋与果实图片 |
| 孵蛋组别查询 | https://wiki.biligame.com/rocom/孵蛋组别查询 | 蛋组和繁育谱系 staging |

详细字段对应关系见 `docs/bwiki-field-mapping.md`。

## 当前产物

```text
scripts/data/bwiki/
├─ creatures.staging.json
├─ skills.staging.json
├─ eggs.staging.json
├─ creature-details.staging.json
├─ rockKingdomBreedingRows.staging.json
├─ rockKingdomRows.preview.json
└─ rockKingdomSkillRows.preview.json

public/presets/
├─ rockKingdomRows.json
├─ rockKingdomSkillRows.json
└─ rockKingdomPresetMigration.json
```

命令产生的审计报告和临时迁移清单写入 `artifacts/bwiki/`；该目录不提交 Git。

## 刷新与发布顺序

1. `npm run sync:bwiki:staging`：刷新精灵、技能和精灵蛋 staging。
2. `npm run sync:bwiki:details`：刷新精灵详情 staging；默认复用已有成功行。
3. `npm run sync:breeding`：刷新蛋组和繁育谱系 staging。
4. `npm run preview:bwiki`：生成精灵与技能 preview，并输出临时审计报告。
5. `npm run check:bwiki:preset`：dry-run 校验行数、稳定 id、技能双向引用和迁移字段。
6. 用户确认后，设置 `BWIKI_PRESET_OVERWRITE=CONFIRM_BWIKI_PRESET` 并运行 `npm run apply:bwiki:preset`。
7. 运行 `npm test`、`npm run check:nature`、`npm run lint`、`npm run build`。

## 发布边界

- preview 和 dry-run 不修改 `public/presets/*`。
- apply 只写入精灵、技能和迁移清单，不直接操作 IndexedDB。
- 稳定 id 必须保持；用户已有 owned / stock 引用不能因发布断裂。
- 正式迁移只更新空值、无效值或仍匹配旧正式值指纹的字段。
- BWiki 图片 URL 必须来自实际解析结果，不拼接或猜测。
- 特性标签、技能标签和性格结论仍由本地规则派生，不直接照搬外部推荐。
