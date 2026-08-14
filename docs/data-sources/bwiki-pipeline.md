# BWiki 数据生产与发布链路

洛克王国世界正式预置的数据链路是：BWiki 页面快照 → staging → preview → 显式发布。应用运行时不联网抓取 BWiki。

## 数据优先级

| 优先级 | 数据 | 用途 |
|---|---|---|
| 最高 | 用户 IndexedDB / 导入 JSON | 用户自己的资料、收集记录和手工修正；预置迁移不得覆盖非空自定义值 |
| 正式 | `public/presets/*.json` | 浏览器运行时读取的版本化精灵、技能和三方迁移清单 |
| 生产 | `scripts/bwiki/data/staging/*.json` | 从 BWiki 页面解析出的当前源快照 |
| 审阅 | `scripts/bwiki/data/preview/*.json` | 对齐正式预置结构、供发布前审阅和校验 |
| 旁证 | 外部攻略 / 社区资料 | 只用于性格定位和机制核对，不覆盖正式资料字段 |

## 当前 BWiki 页面

| 页面 | URL | 用途 |
|---|---|---|
| 精灵筛选 | https://wiki.biligame.com/rocom/精灵筛选 | 编号、名称、系别、形态、六维、特性名、图片入口 |
| 精灵图鉴 | https://wiki.biligame.com/rocom/精灵图鉴 | 普通精灵图与实际异色图片；异色图片只读取页面提供的图片层，不生成或模拟 |
| 精灵详情 | 由精灵 staging 的 `detailUrl` 提供 | 特性描述、技能关系、进化链和详情图片；技能卡只保留关系审计字段，完整技能正文由技能 staging 统一维护 |
| 技能查询 | https://wiki.biligame.com/rocom/技能查询 | 技能名、系别、分类、能耗、威力、效果 |
| 精灵蛋筛选 | https://wiki.biligame.com/rocom/精灵蛋筛选 | 精灵蛋与果实图片 |
| 孵蛋组别查询 | https://wiki.biligame.com/rocom/孵蛋组别查询 | 蛋组和繁育谱系 staging |

详细字段对应关系见 `docs/data-sources/bwiki-field-mapping.md`。

## 当前产物

```text
scripts/bwiki/data/
├─ staging/
│  ├─ creatures.json
│  ├─ skills.json
│  ├─ eggs.json
│  ├─ creature-details.json
│  └─ breeding-rows.json
└─ preview/
   ├─ creature-rows.json
   └─ skill-rows.json

public/presets/
├─ rockKingdomRows.json
├─ rockKingdomSkillRows.json
└─ rockKingdomPresetMigration.json
```

命令产生的审计报告和临时迁移清单写入 `artifacts/bwiki/`；该目录不提交 Git。

## 官方公告发现

`npm run check:official-announcements` 从腾讯游戏内容开放平台读取「洛克王国世界」官方公告列表（游戏 ID `467`、公告标签 `135110`），以稳定公告 ID 读取版本 / 平衡候选的正文，并生成：

- `artifacts/bwiki/official-announcements.json`：结构化候选、正文信号和图片链接。
- `artifacts/bwiki/official-announcements.md`：人工复核清单与官方详情页链接。

列表源是腾讯域名下的 [GICP 公告接口](https://apps.game.qq.com/wmp/v3.1/?p0=467&p1=searchNewsKeywordsList&page=1&pagesize=50&order=sIdxTime&r0=script&r1=NewsObj&type=iTag&id=135110&source=web_pc)，报告中的可读链接指向 `rocom.qq.com` 官方详情页。脚本只为标题命中“版本更新、赛季更新、平衡 / 技能 / 精灵 / 数值调整”等规则的公告读取详情；接口失败或响应结构变化时命令以非零状态退出，并且不会覆盖已有报告。

可用 `ROCOM_ANNOUNCEMENT_SINCE` 限制起始日期，用 `ROCOM_ANNOUNCEMENT_LIMIT` 调整列表条数。例如 PowerShell：

```powershell
$env:ROCOM_ANNOUNCEMENT_SINCE='2026-07-01'
npm run check:official-announcements
```

公告发现只确定可能受影响的精灵、技能、特性和字段。正文只有图片或缺少明确文字信号时，报告会要求人工查看；流程不做 OCR 猜测。官方公告不直接写入 staging 或正式预置，确认范围后仍需回到 BWiki 核对结构化字段。

## 刷新与发布顺序

1. `npm run check:official-announcements`：确定版本 / 平衡变更的人工复核范围。
2. `npm run sync:bwiki:staging`：刷新精灵、技能和精灵蛋 staging。
3. `npm run sync:bwiki:details`：刷新精灵详情 staging；默认复用已有成功行。
4. `npm run sync:breeding`：刷新蛋组和繁育谱系 staging。
5. `npm run preview:bwiki`：生成精灵与技能 preview，并输出临时审计报告。
6. `npm run check:bwiki:preset`：dry-run 校验行数、稳定 id、技能双向引用和迁移字段。
7. 用户确认后，设置 `BWIKI_PRESET_OVERWRITE=CONFIRM_BWIKI_PRESET` 并运行 `npm run apply:bwiki:preset`。
8. 运行 `npm test`、`npm run check:nature`、`npm run lint`、`npm run build`。

## 发布边界

- preview 和 dry-run 不修改 `public/presets/*`。
- apply 只写入精灵、技能和迁移清单，不直接操作 IndexedDB。
- 稳定 id 必须保持；用户已有 owned / stock 引用不能因发布断裂。
- 正式迁移只更新空值、无效值或仍匹配旧正式值指纹的字段。
- BWiki 图片 URL 必须来自实际解析结果，不拼接或猜测。
- 特性标签、技能标签和性格结论仍由本地规则派生，不直接照搬外部推荐。
